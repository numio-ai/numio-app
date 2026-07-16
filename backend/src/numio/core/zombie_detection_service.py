"""Zombie hunter and idle resource detection service.

Detects orphaned and underutilized AWS resources across registered accounts.
Creates findings via the findings repository (P4.3 handles deduplication).

Zombie detection covers:
  - Unattached EBS volumes (from resource inventory)
  - Unused Elastic IPs (from resource inventory)
  - Stopped EC2 instances beyond threshold (from inventory + AWS API for stop time)
  - Old EBS snapshots (direct AWS API)
  - Empty load balancers (direct AWS API)

Idle detection covers:
  - EC2 instances with low CPU and network utilization (CloudWatch metrics)
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from botocore.exceptions import ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.finding_repository import FindingRepository
from numio.models.cloud_resource import CloudResource
from numio.models.zombie_threshold import ZombieThreshold
from numio.schemas.finding import CreateFindingRequest

logger = logging.getLogger("numio.core.zombie_detection")

# ---------------------------------------------------------------------------
# Threshold defaults (matching task spec)
# ---------------------------------------------------------------------------

THRESHOLD_DEFAULTS: dict[str, Decimal] = {
    "stopped_instance_days": Decimal("7"),
    "snapshot_age_days": Decimal("90"),
    "idle_cpu_percent": Decimal("5"),
    "idle_network_mb_day": Decimal("1"),
    "idle_window_days": Decimal("7"),
}

THRESHOLD_KEYS = list(THRESHOLD_DEFAULTS.keys())

# ---------------------------------------------------------------------------
# Approximate pricing tables (us-east-1 on-demand, for waste estimation)
# ---------------------------------------------------------------------------

HOURS_PER_MONTH = Decimal("730")

# EBS monthly rate per GB by volume type
EBS_RATE_PER_GB: dict[str, Decimal] = {
    "gp3": Decimal("0.08"),
    "gp2": Decimal("0.10"),
    "io1": Decimal("0.125"),
    "io2": Decimal("0.125"),
    "st1": Decimal("0.045"),
    "sc1": Decimal("0.015"),
    "standard": Decimal("0.05"),
}

# EBS snapshot storage rate per GB/month
EBS_SNAPSHOT_RATE_PER_GB = Decimal("0.05")

# Unused Elastic IP monthly charge
UNUSED_EIP_MONTHLY_COST = Decimal("3.60")

# Load balancer hourly rates
LB_HOURLY_RATES: dict[str, Decimal] = {
    "application": Decimal("0.0225"),
    "network": Decimal("0.0225"),
    "gateway": Decimal("0.0225"),
}

# Common EC2 on-demand hourly rates (us-east-1)
EC2_HOURLY_RATES: dict[str, Decimal] = {
    "t2.micro": Decimal("0.0116"),
    "t2.small": Decimal("0.023"),
    "t2.medium": Decimal("0.0464"),
    "t2.large": Decimal("0.0928"),
    "t2.xlarge": Decimal("0.1856"),
    "t3.micro": Decimal("0.0104"),
    "t3.small": Decimal("0.0208"),
    "t3.medium": Decimal("0.0416"),
    "t3.large": Decimal("0.0832"),
    "t3.xlarge": Decimal("0.1664"),
    "m5.large": Decimal("0.096"),
    "m5.xlarge": Decimal("0.192"),
    "m5.2xlarge": Decimal("0.384"),
    "m6i.large": Decimal("0.096"),
    "m6i.xlarge": Decimal("0.192"),
    "c5.large": Decimal("0.085"),
    "c5.xlarge": Decimal("0.170"),
    "c6i.large": Decimal("0.085"),
    "c6i.xlarge": Decimal("0.170"),
    "r5.large": Decimal("0.126"),
    "r5.xlarge": Decimal("0.252"),
    "r6i.large": Decimal("0.126"),
    "r6i.xlarge": Decimal("0.252"),
}


# ---------------------------------------------------------------------------
# Pure helper functions
# ---------------------------------------------------------------------------


def parse_stop_time(state_transition_reason: str | None) -> datetime | None:
    """Parse EC2 stop timestamp from StateTransitionReason.

    AWS format: "User initiated (2026-03-20 10:30:00 GMT)"
    """
    if not state_transition_reason:
        return None
    match = re.search(r"\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) GMT\)", state_transition_reason)
    if match:
        return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return None


def estimate_ec2_monthly_cost(instance_type: str | None) -> Decimal | None:
    """Estimate monthly on-demand cost for an EC2 instance type."""
    if instance_type and instance_type in EC2_HOURLY_RATES:
        return EC2_HOURLY_RATES[instance_type] * HOURS_PER_MONTH
    return None


def estimate_ebs_monthly_cost(size_gb: int | None, volume_type: str | None) -> Decimal | None:
    """Estimate monthly cost for an EBS volume."""
    if not size_gb:
        return None
    rate = EBS_RATE_PER_GB.get(volume_type or "gp3", EBS_RATE_PER_GB["gp3"])
    return Decimal(str(size_gb)) * rate


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ZombieDetectionService:
    """Detects orphaned and idle cloud resources for a workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def run_detection(self, account_id: str, boto_session, regions: list[str]) -> int:
        """Run all zombie and idle detections for one account.

        Returns the total number of new findings created.
        """
        thresholds = await self._load_thresholds()
        finding_count = 0

        # Inventory-based zombie detection
        for detect_fn in [self._detect_unattached_ebs, self._detect_unused_eips]:
            try:
                finding_count += await detect_fn(account_id, thresholds)
            except Exception as e:
                logger.error("%s failed for account %s: %s", detect_fn.__name__, account_id, e)

        # Stopped instances (inventory + AWS API for stop time)
        try:
            finding_count += await self._detect_stopped_instances(
                account_id, boto_session, thresholds
            )
        except Exception as e:
            logger.error("Stopped instance detection failed for account %s: %s", account_id, e)

        # AWS API-based zombie detection (per region)
        for region in regions:
            for detect_fn in [
                self._detect_old_snapshots,
                self._detect_empty_load_balancers,
            ]:
                try:
                    finding_count += await detect_fn(account_id, boto_session, region, thresholds)
                except ClientError as e:
                    error_code = e.response.get("Error", {}).get("Code", "")
                    if error_code in (
                        "AuthFailure",
                        "OptInRequired",
                        "InvalidClientTokenId",
                    ):
                        logger.info(
                            "Account %s region %s: %s not available, skipping",
                            account_id,
                            region,
                            detect_fn.__name__,
                        )
                    else:
                        logger.warning(
                            "Account %s region %s: %s failed: %s",
                            account_id,
                            region,
                            detect_fn.__name__,
                            e,
                        )
                except Exception as e:
                    logger.warning(
                        "Account %s region %s: %s failed: %s",
                        account_id,
                        region,
                        detect_fn.__name__,
                        e,
                    )

        # Idle detection via CloudWatch
        try:
            finding_count += await self._detect_idle_instances(
                account_id, boto_session, regions, thresholds
            )
        except Exception as e:
            logger.error("Idle detection failed for account %s: %s", account_id, e)

        return finding_count

    # ------------------------------------------------------------------
    # Threshold loading
    # ------------------------------------------------------------------

    async def _load_thresholds(self) -> dict[str, Decimal]:
        """Load thresholds from DB, falling back to defaults."""
        result = await self._session.execute(
            select(ZombieThreshold).where(ZombieThreshold.workspace_id == self._workspace_id)
        )
        overrides = {t.threshold_key: t.threshold_value for t in result.scalars().all()}
        thresholds = dict(THRESHOLD_DEFAULTS)
        thresholds.update(overrides)
        return thresholds

    # ------------------------------------------------------------------
    # Zombie: Unattached EBS volumes (from inventory)
    # ------------------------------------------------------------------

    async def _detect_unattached_ebs(self, account_id: str, thresholds: dict[str, Decimal]) -> int:
        result = await self._session.execute(
            select(CloudResource).where(
                CloudResource.account_id == account_id,
                CloudResource.workspace_id == self._workspace_id,
                CloudResource.service == "ebs",
                CloudResource.resource_type == "volume",
                CloudResource.state == "available",
                CloudResource.terminated_at.is_(None),
            )
        )
        volumes = list(result.scalars().all())
        if not volumes:
            return 0

        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)

        for vol in volumes:
            meta = vol.resource_metadata or {}
            size_gb = meta.get("size_gb")
            volume_type = meta.get("volume_type")
            waste = estimate_ebs_monthly_cost(size_gb, volume_type)

            size_text = f"{size_gb} GB " if size_gb else ""
            type_text = f"{volume_type} " if volume_type else ""

            _, created = await repo.create_or_update(
                CreateFindingRequest(
                    type="zombie",
                    severity="medium",
                    title=f"Unattached EBS volume {vol.resource_id}",
                    description=(
                        f"{size_text}{type_text}volume not attached to any instance in {vol.region}"
                    ),
                    resource_id=vol.resource_id,
                    detection_source="zombie_detection",
                    suggested_action=(
                        f"Review and delete if no longer needed.\n"
                        f"`aws ec2 delete-volume --volume-id {vol.resource_id} "
                        f"--region {vol.region}`"
                    ),
                    estimated_cost_impact=waste,
                )
            )
            if created:
                finding_count += 1

        return finding_count

    # ------------------------------------------------------------------
    # Zombie: Unused Elastic IPs (from inventory)
    # ------------------------------------------------------------------

    async def _detect_unused_eips(self, account_id: str, thresholds: dict[str, Decimal]) -> int:
        result = await self._session.execute(
            select(CloudResource).where(
                CloudResource.account_id == account_id,
                CloudResource.workspace_id == self._workspace_id,
                CloudResource.service == "eip",
                CloudResource.state == "unassociated",
                CloudResource.terminated_at.is_(None),
            )
        )
        eips = list(result.scalars().all())
        if not eips:
            return 0

        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)

        for eip in eips:
            public_ip = (eip.resource_metadata or {}).get("public_ip", eip.resource_id)

            _, created = await repo.create_or_update(
                CreateFindingRequest(
                    type="zombie",
                    severity="low",
                    title=f"Unused Elastic IP {public_ip}",
                    description=(
                        f"Elastic IP {public_ip} ({eip.resource_id}) allocated but "
                        f"not associated to any instance in {eip.region}"
                    ),
                    resource_id=eip.resource_id,
                    detection_source="zombie_detection",
                    suggested_action=(
                        f"Release if no longer needed.\n"
                        f"`aws ec2 release-address --allocation-id {eip.resource_id} "
                        f"--region {eip.region}`"
                    ),
                    estimated_cost_impact=UNUSED_EIP_MONTHLY_COST,
                )
            )
            if created:
                finding_count += 1

        return finding_count

    # ------------------------------------------------------------------
    # Zombie: Stopped EC2 instances (inventory + AWS API for stop time)
    # ------------------------------------------------------------------

    async def _detect_stopped_instances(
        self,
        account_id: str,
        boto_session,
        thresholds: dict[str, Decimal],
    ) -> int:
        result = await self._session.execute(
            select(CloudResource).where(
                CloudResource.account_id == account_id,
                CloudResource.workspace_id == self._workspace_id,
                CloudResource.service == "ec2",
                CloudResource.resource_type == "instance",
                CloudResource.state == "stopped",
                CloudResource.terminated_at.is_(None),
            )
        )
        stopped = list(result.scalars().all())
        if not stopped:
            return 0

        threshold_days = int(thresholds["stopped_instance_days"])
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=threshold_days)

        # Group by region to batch AWS API calls
        by_region: dict[str, list[CloudResource]] = {}
        for inst in stopped:
            by_region.setdefault(inst.region, []).append(inst)

        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)

        for region, instances in by_region.items():
            # Get stop times via AWS API
            instance_ids = [inst.resource_id for inst in instances]
            stop_times = _get_instance_stop_times(boto_session, region, instance_ids)

            for inst in instances:
                stop_time = stop_times.get(inst.resource_id)
                if stop_time is None:
                    # Fallback: use first_seen_at as conservative proxy
                    stop_time = inst.first_seen_at

                if stop_time > cutoff:
                    continue  # Not stopped long enough

                stopped_days = (now - stop_time).days
                instance_type = (inst.resource_metadata or {}).get("instance_type")
                waste = estimate_ec2_monthly_cost(instance_type)

                _, created = await repo.create_or_update(
                    CreateFindingRequest(
                        type="zombie",
                        severity="high",
                        title=f"Stopped EC2 instance {inst.resource_id}",
                        description=(
                            f"Instance {inst.resource_id} ({instance_type or 'unknown'}) "
                            f"has been stopped for {stopped_days} days in {region}"
                        ),
                        resource_id=inst.resource_id,
                        detection_source="zombie_detection",
                        suggested_action=(
                            f"Terminate if no longer needed.\n"
                            f"`aws ec2 terminate-instances --instance-ids "
                            f"{inst.resource_id} --region {region}`"
                        ),
                        estimated_cost_impact=waste,
                    )
                )
                if created:
                    finding_count += 1

        return finding_count

    # ------------------------------------------------------------------
    # Zombie: Old EBS snapshots (direct AWS API)
    # ------------------------------------------------------------------

    async def _detect_old_snapshots(
        self,
        account_id: str,
        boto_session,
        region: str,
        thresholds: dict[str, Decimal],
    ) -> int:
        ec2 = boto_session.client("ec2", region_name=region)
        paginator = ec2.get_paginator("describe_snapshots")

        threshold_days = int(thresholds["snapshot_age_days"])
        cutoff = datetime.now(timezone.utc) - timedelta(days=threshold_days)
        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)

        for page in paginator.paginate(OwnerIds=["self"]):
            for snap in page.get("Snapshots", []):
                start_time = snap.get("StartTime")
                if not start_time or start_time >= cutoff:
                    continue

                snap_id = snap["SnapshotId"]
                size_gb = snap.get("VolumeSize", 0)
                waste = Decimal(str(size_gb)) * EBS_SNAPSHOT_RATE_PER_GB if size_gb > 0 else None
                age_days = (datetime.now(timezone.utc) - start_time).days

                _, created = await repo.create_or_update(
                    CreateFindingRequest(
                        type="zombie",
                        severity="low",
                        title=f"Old EBS snapshot {snap_id}",
                        description=(
                            f"{size_gb} GB snapshot created {start_time.date()}, "
                            f"{age_days} days old (threshold: {threshold_days} days) "
                            f"in {region}"
                        ),
                        resource_id=snap_id,
                        detection_source="zombie_detection",
                        suggested_action=(
                            f"Delete if no longer needed.\n"
                            f"`aws ec2 delete-snapshot --snapshot-id {snap_id} "
                            f"--region {region}`"
                        ),
                        estimated_cost_impact=waste,
                    )
                )
                if created:
                    finding_count += 1

        return finding_count

    # ------------------------------------------------------------------
    # Zombie: Empty load balancers (direct AWS API)
    # ------------------------------------------------------------------

    async def _detect_empty_load_balancers(
        self,
        account_id: str,
        boto_session,
        region: str,
        thresholds: dict[str, Decimal],
    ) -> int:
        elbv2 = boto_session.client("elbv2", region_name=region)
        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)

        paginator = elbv2.get_paginator("describe_load_balancers")
        for page in paginator.paginate():
            for lb in page.get("LoadBalancers", []):
                lb_arn = lb["LoadBalancerArn"]
                lb_name = lb.get("LoadBalancerName", lb_arn)
                lb_type = lb.get("Type", "application")

                # Check target groups for this LB
                tg_resp = elbv2.describe_target_groups(LoadBalancerArn=lb_arn)
                target_groups = tg_resp.get("TargetGroups", [])

                if not target_groups:
                    is_empty = True
                else:
                    is_empty = True
                    for tg in target_groups:
                        tg_arn = tg["TargetGroupArn"]
                        th_resp = elbv2.describe_target_health(TargetGroupArn=tg_arn)
                        if th_resp.get("TargetHealthDescriptions", []):
                            is_empty = False
                            break

                if not is_empty:
                    continue

                hourly_rate = LB_HOURLY_RATES.get(lb_type, LB_HOURLY_RATES["application"])
                waste = hourly_rate * HOURS_PER_MONTH

                _, created = await repo.create_or_update(
                    CreateFindingRequest(
                        type="zombie",
                        severity="medium",
                        title=f"Empty load balancer {lb_name}",
                        description=(
                            f"{lb_type.capitalize()} load balancer with no registered "
                            f"targets in {region}"
                        ),
                        resource_id=lb_arn,
                        detection_source="zombie_detection",
                        suggested_action=(
                            f"Delete if no longer needed.\n"
                            f"`aws elbv2 delete-load-balancer "
                            f"--load-balancer-arn {lb_arn}`"
                        ),
                        estimated_cost_impact=waste,
                    )
                )
                if created:
                    finding_count += 1

        return finding_count

    # ------------------------------------------------------------------
    # Idle: EC2 instances with low utilization (CloudWatch)
    # ------------------------------------------------------------------

    async def _detect_idle_instances(
        self,
        account_id: str,
        boto_session,
        regions: list[str],
        thresholds: dict[str, Decimal],
    ) -> int:
        cpu_threshold = float(thresholds["idle_cpu_percent"])
        network_threshold_bytes = float(thresholds["idle_network_mb_day"]) * 1024 * 1024
        window_days = int(thresholds["idle_window_days"])

        # Get running instances from inventory
        result = await self._session.execute(
            select(CloudResource).where(
                CloudResource.account_id == account_id,
                CloudResource.workspace_id == self._workspace_id,
                CloudResource.service == "ec2",
                CloudResource.resource_type == "instance",
                CloudResource.state == "running",
                CloudResource.terminated_at.is_(None),
            )
        )
        running = list(result.scalars().all())
        if not running:
            return 0

        # Group by region
        by_region: dict[str, list[CloudResource]] = {}
        for inst in running:
            by_region.setdefault(inst.region, []).append(inst)

        finding_count = 0
        repo = FindingRepository(self._session, self._workspace_id)
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=window_days)

        for region, instances in by_region.items():
            try:
                cw = boto_session.client("cloudwatch", region_name=region)
            except Exception as e:
                logger.warning("CloudWatch client failed in %s: %s", region, e)
                continue

            for inst in instances:
                try:
                    idle = _check_instance_idle(
                        cw,
                        inst.resource_id,
                        start_time,
                        now,
                        window_days,
                        cpu_threshold,
                        network_threshold_bytes,
                    )
                except ClientError as e:
                    error_code = e.response.get("Error", {}).get("Code", "")
                    if error_code in ("AccessDenied", "AccessDeniedException"):
                        logger.warning(
                            "CloudWatch permission denied for account %s, skipping idle detection",
                            account_id,
                        )
                        return finding_count
                    logger.warning("CloudWatch error for %s: %s", inst.resource_id, e)
                    continue

                if not idle:
                    continue

                instance_type = (inst.resource_metadata or {}).get("instance_type")
                waste = estimate_ec2_monthly_cost(instance_type)

                _, created = await repo.create_or_update(
                    CreateFindingRequest(
                        type="idle",
                        severity="info",
                        title=f"Idle EC2 instance {inst.resource_id}",
                        description=(
                            f"Instance {inst.resource_id} ({instance_type or 'unknown'}) "
                            f"has CPU < {cpu_threshold}% and network < "
                            f"{thresholds['idle_network_mb_day']} MB/day "
                            f"over the last {window_days} days in {region}"
                        ),
                        resource_id=inst.resource_id,
                        detection_source="idle_detection",
                        suggested_action=(
                            f"Review usage and consider stopping or right-sizing.\n"
                            f"`aws ec2 stop-instances --instance-ids "
                            f"{inst.resource_id} --region {region}`"
                        ),
                        estimated_cost_impact=waste,
                    )
                )
                if created:
                    finding_count += 1

        return finding_count


# ---------------------------------------------------------------------------
# AWS API helpers (synchronous boto3 calls)
# ---------------------------------------------------------------------------


def _get_instance_stop_times(
    boto_session, region: str, instance_ids: list[str]
) -> dict[str, datetime]:
    """Get stop timestamps for EC2 instances via DescribeInstances."""
    ec2 = boto_session.client("ec2", region_name=region)
    stop_times: dict[str, datetime] = {}

    # DescribeInstances handles batches; keep reasonable batch size
    for i in range(0, len(instance_ids), 100):
        batch = instance_ids[i : i + 100]
        try:
            resp = ec2.describe_instances(InstanceIds=batch)
        except ClientError as e:
            logger.warning("DescribeInstances failed in %s: %s", region, e)
            continue

        for reservation in resp.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                iid = instance["InstanceId"]
                reason = instance.get("StateTransitionReason", "")
                stop_time = parse_stop_time(reason)
                if stop_time:
                    stop_times[iid] = stop_time

    return stop_times


def _check_instance_idle(
    cw_client,
    instance_id: str,
    start_time: datetime,
    end_time: datetime,
    window_days: int,
    cpu_threshold: float,
    network_threshold_bytes: float,
) -> bool:
    """Check if an EC2 instance is idle based on CloudWatch metrics.

    Returns True if both CPU and network are below their thresholds.
    """
    # CPU utilization
    cpu_resp = cw_client.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="CPUUtilization",
        Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,
        Statistics=["Average"],
    )
    cpu_datapoints = cpu_resp.get("Datapoints", [])
    if not cpu_datapoints:
        return False  # No data — cannot determine idle state

    avg_cpu = sum(dp["Average"] for dp in cpu_datapoints) / len(cpu_datapoints)
    if avg_cpu >= cpu_threshold:
        return False

    # Network I/O (NetworkIn + NetworkOut)
    net_in_resp = cw_client.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="NetworkIn",
        Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,
        Statistics=["Sum"],
    )
    net_out_resp = cw_client.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="NetworkOut",
        Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,
        Statistics=["Sum"],
    )

    net_in_total = sum(dp["Sum"] for dp in net_in_resp.get("Datapoints", []))
    net_out_total = sum(dp["Sum"] for dp in net_out_resp.get("Datapoints", []))
    avg_daily_network = (net_in_total + net_out_total) / max(window_days, 1)

    return avg_daily_network < network_threshold_bytes
