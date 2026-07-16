"""Resource inventory sync service.

Discovers cloud resources from AWS service APIs (EC2, RDS, S3, EBS, EIP, Lambda)
across all enabled regions and upserts them into the cloud_resources table.
Resources that disappear between syncs are marked as terminated.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from botocore.exceptions import ClientError
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.aws_service import _get_session as get_boto_session
from numio.core.aws_service import validate_connectivity
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.session import AsyncSessionLocal
from numio.models.cloud_resource import CloudResource
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace

logger = logging.getLogger("numio.core.resource_inventory_service")

BATCH_SIZE = 500

# Regions to scan for regional resources.
DEFAULT_REGIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "ap-southeast-1",
    "ap-northeast-1",
]


async def _get_default_workspace_id(session: AsyncSession) -> str:
    """Look up the default workspace ID by slug."""
    result = await session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
    return str(workspace.id)


async def resource_inventory_sync_job(account_id: str) -> int:
    """Entry point for the job runner.

    Creates its own DB session for per-account isolation.
    Returns total resources upserted.
    After sync completes, triggers a compliance audit.
    """
    async with AsyncSessionLocal() as session:
        count = await _run_resource_inventory_sync(account_id, session)

    # Trigger compliance audit after resource sync
    try:
        from numio.core.compliance_service import run_compliance_audit

        async with AsyncSessionLocal() as session:
            workspace_id = await _get_default_workspace_id(session)
            await run_compliance_audit(session, workspace_id)
            logger.info("Compliance audit triggered after resource inventory sync")
    except Exception as e:
        logger.warning("Post-sync compliance audit failed: %s", e)

    # Evaluate guardrail policies immediately after resource sync
    try:
        from numio.core.infra_policy_service import InfraPolicyEvaluationService

        async with AsyncSessionLocal() as session:
            workspace_id = await _get_default_workspace_id(session)
            service = InfraPolicyEvaluationService(session, workspace_id)
            new_violations = await service.evaluate_guardrails()
            if new_violations:
                logger.info(
                    "Guardrail evaluation after resource sync: %d new violations", new_violations
                )
    except Exception as e:
        logger.warning("Post-sync guardrail evaluation failed: %s", e)

    return count


async def _run_resource_inventory_sync(account_id: str, session: AsyncSession) -> int:
    """Run resource inventory sync for one AWS account."""
    workspace_id = await _get_default_workspace_id(session)
    repo = AwsAccountRepository(session, workspace_id)
    account = await repo.get_by_aws_account_id(account_id)
    if account is None:
        raise ValueError(f"Account {account_id} not found")

    # Assume role into the customer account
    ok, error_msg, credentials = validate_connectivity(account.role_arn)
    if not ok:
        raise RuntimeError(f"STS AssumeRole failed for {account_id}: {error_msg}")

    boto_session = get_boto_session(credentials)
    now = datetime.now(timezone.utc)

    # Track all resource keys seen in this sync to detect terminated resources
    seen_keys: set[tuple[str, str]] = set()  # (service, resource_id)
    total_count = 0

    # Discover S3 buckets (global)
    count, keys = await _discover_s3_buckets(
        boto_session, account_id, session, now, workspace_id=workspace_id
    )
    total_count += count
    seen_keys.update(keys)

    # Discover regional resources
    for region in DEFAULT_REGIONS:
        for discover_func in [
            _discover_ec2_instances,
            _discover_rds_instances,
            _discover_ebs_volumes,
            _discover_elastic_ips,
            _discover_lambda_functions,
        ]:
            try:
                count, keys = await discover_func(
                    boto_session, account_id, region, session, now, workspace_id=workspace_id
                )
                total_count += count
                seen_keys.update(keys)
            except ClientError as e:
                error_code = e.response["Error"]["Code"]
                # Skip regions where a service is not available
                if error_code in ("AuthFailure", "OptInRequired", "InvalidClientTokenId"):
                    logger.info(
                        "Account %s region %s: %s not available (%s), skipping",
                        account_id,
                        region,
                        discover_func.__name__,
                        error_code,
                    )
                else:
                    logger.warning(
                        "Account %s region %s: %s failed: %s",
                        account_id,
                        region,
                        discover_func.__name__,
                        e,
                    )

    # Mark resources not seen in this sync as terminated
    terminated = await _mark_terminated(
        session, account_id, seen_keys, now, workspace_id=workspace_id
    )
    logger.info(
        "Account %s: synced %d resources, marked %d as terminated",
        account_id,
        total_count,
        terminated,
    )

    return total_count


# ---------------------------------------------------------------------------
# Resource discovery functions
# ---------------------------------------------------------------------------


async def _discover_ec2_instances(
    boto_session,
    account_id: str,
    region: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover EC2 instances in a region."""
    ec2 = boto_session.client("ec2", region_name=region)
    paginator = ec2.get_paginator("describe_instances")

    resources = []
    seen = set()

    for page in paginator.paginate():
        for reservation in page.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                instance_id = instance["InstanceId"]
                tags = _extract_tags(instance.get("Tags", []))
                resources.append(
                    {
                        "account_id": account_id,
                        "region": region,
                        "service": "ec2",
                        "resource_type": "instance",
                        "resource_id": instance_id,
                        "arn": f"arn:aws:ec2:{region}:{account_id}:instance/{instance_id}",
                        "name": tags.get("Name"),
                        "state": instance.get("State", {}).get("Name"),
                        "creation_date": instance.get("LaunchTime"),
                        "tags": tags or None,
                        "metadata": {
                            "instance_type": instance.get("InstanceType"),
                            "platform": instance.get("Platform"),
                            "vpc_id": instance.get("VpcId"),
                            "subnet_id": instance.get("SubnetId"),
                            "private_ip": instance.get("PrivateIpAddress"),
                            "public_ip": instance.get("PublicIpAddress"),
                        },
                    }
                )
                seen.add(("ec2", instance_id))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


async def _discover_rds_instances(
    boto_session,
    account_id: str,
    region: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover RDS DB instances in a region."""
    rds = boto_session.client("rds", region_name=region)
    paginator = rds.get_paginator("describe_db_instances")

    resources = []
    seen = set()

    for page in paginator.paginate():
        for db in page.get("DBInstances", []):
            db_id = db["DBInstanceIdentifier"]
            # RDS tags require a separate call via ARN
            db_arn = db.get("DBInstanceArn", "")
            tags = {}
            try:
                tag_resp = rds.list_tags_for_resource(ResourceName=db_arn)
                tags = _extract_tags(tag_resp.get("TagList", []))
            except ClientError:
                pass

            resources.append(
                {
                    "account_id": account_id,
                    "region": region,
                    "service": "rds",
                    "resource_type": "db-instance",
                    "resource_id": db_id,
                    "arn": db_arn,
                    "name": tags.get("Name") or db_id,
                    "state": db.get("DBInstanceStatus"),
                    "creation_date": db.get("InstanceCreateTime"),
                    "tags": tags or None,
                    "metadata": {
                        "engine": db.get("Engine"),
                        "engine_version": db.get("EngineVersion"),
                        "instance_class": db.get("DBInstanceClass"),
                        "multi_az": db.get("MultiAZ"),
                        "storage_type": db.get("StorageType"),
                        "allocated_storage_gb": db.get("AllocatedStorage"),
                    },
                }
            )
            seen.add(("rds", db_id))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


async def _discover_s3_buckets(
    boto_session,
    account_id: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover S3 buckets (global resource)."""
    s3 = boto_session.client("s3")
    resp = s3.list_buckets()

    resources = []
    seen = set()

    for bucket in resp.get("Buckets", []):
        bucket_name = bucket["Name"]
        # Get bucket tags
        tags = {}
        try:
            tag_resp = s3.get_bucket_tagging(Bucket=bucket_name)
            tags = _extract_tags(tag_resp.get("TagSet", []))
        except ClientError:
            pass  # No tags or access denied

        # Get bucket region
        bucket_region = "us-east-1"  # default
        try:
            loc_resp = s3.get_bucket_location(Bucket=bucket_name)
            loc = loc_resp.get("LocationConstraint")
            if loc:
                bucket_region = loc
        except ClientError:
            pass

        resources.append(
            {
                "account_id": account_id,
                "region": bucket_region,
                "service": "s3",
                "resource_type": "bucket",
                "resource_id": bucket_name,
                "arn": f"arn:aws:s3:::{bucket_name}",
                "name": bucket_name,
                "state": "active",
                "creation_date": bucket.get("CreationDate"),
                "tags": tags or None,
                "metadata": None,
            }
        )
        seen.add(("s3", bucket_name))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


async def _discover_ebs_volumes(
    boto_session,
    account_id: str,
    region: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover EBS volumes in a region."""
    ec2 = boto_session.client("ec2", region_name=region)
    paginator = ec2.get_paginator("describe_volumes")

    resources = []
    seen = set()

    for page in paginator.paginate():
        for vol in page.get("Volumes", []):
            vol_id = vol["VolumeId"]
            tags = _extract_tags(vol.get("Tags", []))
            attachments = vol.get("Attachments", [])

            resources.append(
                {
                    "account_id": account_id,
                    "region": region,
                    "service": "ebs",
                    "resource_type": "volume",
                    "resource_id": vol_id,
                    "arn": f"arn:aws:ec2:{region}:{account_id}:volume/{vol_id}",
                    "name": tags.get("Name"),
                    "state": vol.get("State"),
                    "creation_date": vol.get("CreateTime"),
                    "tags": tags or None,
                    "metadata": {
                        "size_gb": vol.get("Size"),
                        "volume_type": vol.get("VolumeType"),
                        "iops": vol.get("Iops"),
                        "encrypted": vol.get("Encrypted"),
                        "attached_to": attachments[0].get("InstanceId") if attachments else None,
                    },
                }
            )
            seen.add(("ebs", vol_id))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


async def _discover_elastic_ips(
    boto_session,
    account_id: str,
    region: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover Elastic IPs in a region."""
    ec2 = boto_session.client("ec2", region_name=region)
    resp = ec2.describe_addresses()

    resources = []
    seen = set()

    for addr in resp.get("Addresses", []):
        alloc_id = addr.get("AllocationId", addr.get("PublicIp", ""))
        tags = _extract_tags(addr.get("Tags", []))

        resources.append(
            {
                "account_id": account_id,
                "region": region,
                "service": "eip",
                "resource_type": "elastic-ip",
                "resource_id": alloc_id,
                "arn": f"arn:aws:ec2:{region}:{account_id}:elastic-ip/{alloc_id}",
                "name": tags.get("Name"),
                "state": "associated" if addr.get("AssociationId") else "unassociated",
                "creation_date": None,
                "tags": tags or None,
                "metadata": {
                    "public_ip": addr.get("PublicIp"),
                    "instance_id": addr.get("InstanceId"),
                    "network_interface_id": addr.get("NetworkInterfaceId"),
                },
            }
        )
        seen.add(("eip", alloc_id))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


async def _discover_lambda_functions(
    boto_session,
    account_id: str,
    region: str,
    session: AsyncSession,
    now: datetime,
    workspace_id: str = "default",
) -> tuple[int, set[tuple[str, str]]]:
    """Discover Lambda functions in a region."""
    lam = boto_session.client("lambda", region_name=region)
    paginator = lam.get_paginator("list_functions")

    resources = []
    seen = set()

    for page in paginator.paginate():
        for fn in page.get("Functions", []):
            fn_name = fn["FunctionName"]
            fn_arn = fn.get("FunctionArn", "")

            # Lambda tags are returned by get_function or list_tags
            tags = {}
            try:
                tag_resp = lam.list_tags(Resource=fn_arn)
                tags = tag_resp.get("Tags", {})
            except ClientError:
                pass

            resources.append(
                {
                    "account_id": account_id,
                    "region": region,
                    "service": "lambda",
                    "resource_type": "function",
                    "resource_id": fn_name,
                    "arn": fn_arn,
                    "name": fn_name,
                    "state": fn.get("State", "Active"),
                    "creation_date": None,  # Lambda doesn't expose creation date directly
                    "tags": tags or None,
                    "metadata": {
                        "runtime": fn.get("Runtime"),
                        "memory_mb": fn.get("MemorySize"),
                        "timeout_seconds": fn.get("Timeout"),
                        "handler": fn.get("Handler"),
                        "code_size_bytes": fn.get("CodeSize"),
                        "last_modified": fn.get("LastModified"),
                    },
                }
            )
            seen.add(("lambda", fn_name))

    count = await _upsert_resources(session, account_id, resources, now, workspace_id=workspace_id)
    return count, seen


# ---------------------------------------------------------------------------
# DB operations
# ---------------------------------------------------------------------------


async def _upsert_resources(
    session: AsyncSession,
    account_id: str,
    resources: list[dict],
    now: datetime,
    workspace_id: str = "default",
) -> int:
    """Upsert a list of resource dicts into cloud_resources using ON CONFLICT DO UPDATE."""
    if not resources:
        return 0

    count = 0
    for i in range(0, len(resources), BATCH_SIZE):
        batch = resources[i : i + BATCH_SIZE]
        rows = []
        for r in batch:
            rows.append(
                {
                    "id": uuid.uuid4(),
                    "workspace_id": workspace_id,
                    "account_id": r["account_id"],
                    "region": r["region"],
                    "service": r["service"],
                    "resource_type": r["resource_type"],
                    "resource_id": r["resource_id"],
                    "arn": r.get("arn"),
                    "name": r.get("name"),
                    "state": r.get("state"),
                    "creation_date": r.get("creation_date"),
                    "tags": r.get("tags"),
                    "resource_metadata": r.get("metadata"),
                    "first_seen_at": now,
                    "last_seen_at": now,
                    "terminated_at": None,
                }
            )

        stmt = pg_insert(CloudResource.__table__).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["account_id", "service", "resource_id"],
            set_={
                "region": stmt.excluded.region,
                "resource_type": stmt.excluded.resource_type,
                "arn": stmt.excluded.arn,
                "name": stmt.excluded.name,
                "state": stmt.excluded.state,
                "creation_date": stmt.excluded.creation_date,
                "tags": stmt.excluded.tags,
                "resource_metadata": stmt.excluded.resource_metadata,
                "last_seen_at": stmt.excluded.last_seen_at,
                "terminated_at": None,  # Clear termination if resource reappears
                "updated_at": func.now(),
            },
        )
        await session.execute(stmt)
        await session.flush()
        count += len(batch)

    return count


async def _mark_terminated(
    session: AsyncSession,
    account_id: str,
    seen_keys: set[tuple[str, str]],
    now: datetime,
    workspace_id: str = "default",
) -> int:
    """Mark resources not seen in this sync as terminated.

    Only marks resources that are currently not terminated (terminated_at IS NULL).
    Returns the number of resources marked as terminated.
    """
    # Get all active (non-terminated) resources for this account
    result = await session.execute(
        select(CloudResource.service, CloudResource.resource_id).where(
            CloudResource.account_id == account_id,
            CloudResource.workspace_id == workspace_id,
            CloudResource.terminated_at.is_(None),
        )
    )
    existing = {(row.service, row.resource_id) for row in result.all()}
    to_terminate = existing - seen_keys

    if not to_terminate:
        return 0

    # Batch terminate
    for service, resource_id in to_terminate:
        await session.execute(
            update(CloudResource)
            .where(
                CloudResource.account_id == account_id,
                CloudResource.service == service,
                CloudResource.resource_id == resource_id,
                CloudResource.workspace_id == workspace_id,
            )
            .values(terminated_at=now, state="terminated", updated_at=now)
        )

    await session.flush()
    return len(to_terminate)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_tags(tag_list: list[dict]) -> dict:
    """Convert AWS tag list [{Key: k, Value: v}, ...] to a plain dict."""
    if not tag_list:
        return {}
    return {t.get("Key", ""): t.get("Value", "") for t in tag_list if t.get("Key")}
