"""Recommendation generation service.

Generates cost-optimization recommendations from findings:
  - zombie findings → zombie_cleanup recommendations
  - idle findings → idle_shutdown + right_sizing recommendations
  - anomaly findings with high cost impact → cost-optimization recommendations (future)

Each recommendation includes AWS CLI remediation commands and estimated savings.
Savings tracking compares cost before and after implementation.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.recommendation_repository import RecommendationRepository
from numio.models.cost_record import CostRecord
from numio.models.finding import Finding

logger = logging.getLogger("numio.core.recommendation_service")

# ---------------------------------------------------------------------------
# Right-sizing: instance type downgrade map
# ---------------------------------------------------------------------------

# Maps an instance type to the next smaller size in the same family.
DOWNSIZE_MAP: dict[str, str] = {
    "t2.xlarge": "t2.large",
    "t2.large": "t2.medium",
    "t2.medium": "t2.small",
    "t2.small": "t2.micro",
    "t3.xlarge": "t3.large",
    "t3.large": "t3.medium",
    "t3.medium": "t3.small",
    "t3.small": "t3.micro",
    "m5.2xlarge": "m5.xlarge",
    "m5.xlarge": "m5.large",
    "m6i.xlarge": "m6i.large",
    "c5.xlarge": "c5.large",
    "c6i.xlarge": "c6i.large",
    "r5.xlarge": "r5.large",
    "r6i.xlarge": "r6i.large",
}

# On-demand hourly rates (us-east-1) — reused from zombie detection for savings math
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

HOURS_PER_MONTH = Decimal("730")


def _monthly_cost(instance_type: str) -> Decimal | None:
    rate = EC2_HOURLY_RATES.get(instance_type)
    return rate * HOURS_PER_MONTH if rate else None


# ---------------------------------------------------------------------------
# Confidence assignment
# ---------------------------------------------------------------------------


def _assign_confidence(finding: Finding) -> str:
    """Assign confidence level based on data quality signals.

    high   = clear signal with strong cost data (zombie with $0 utilization)
    medium = strong signal with some uncertainty (idle with low usage)
    low    = heuristic-based with limited data
    """
    has_cost = finding.estimated_cost_impact is not None and finding.estimated_cost_impact > 0
    if finding.detected_at is not None:
        finding_age = (datetime.now(timezone.utc) - finding.detected_at).days
    else:
        finding_age = 0

    if finding.type == "zombie" and has_cost:
        return "high"
    if finding.type == "idle" and has_cost and finding_age >= 30:
        return "high"
    if has_cost and finding_age >= 7:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# CLI command generation
# ---------------------------------------------------------------------------


def _parse_region_from_description(description: str | None) -> str | None:
    """Best-effort region extraction from finding description text."""
    if not description:
        return None
    # Pattern: "in us-east-1" or "in us-west-2"
    import re

    match = re.search(r"\bin ((?:us|eu|ap|sa|ca|me|af)-\w+-\d+)\b", description)
    return match.group(1) if match else None


def _generate_zombie_commands(finding: Finding) -> str:
    """Generate AWS CLI cleanup commands from a zombie finding."""
    # The zombie detection service already puts CLI commands in suggested_action
    if finding.suggested_action:
        return finding.suggested_action
    return f"# Review and clean up resource: {finding.resource_id}"


def _generate_idle_shutdown_commands(finding: Finding) -> str:
    """Generate AWS CLI stop/terminate commands for idle resources."""
    if finding.suggested_action:
        return finding.suggested_action
    region = _parse_region_from_description(finding.description)
    region_flag = f" --region {region}" if region else ""
    return f"aws ec2 stop-instances --instance-ids {finding.resource_id}{region_flag}"


def _generate_right_sizing_commands(finding: Finding, current_type: str, target_type: str) -> str:
    """Generate AWS CLI commands to right-size an instance."""
    region = _parse_region_from_description(finding.description)
    region_flag = f" --region {region}" if region else ""
    return (
        f"# Right-size {finding.resource_id} from {current_type} to {target_type}\n"
        f"# Step 1: Stop the instance\n"
        f"aws ec2 stop-instances --instance-ids {finding.resource_id}{region_flag}\n"
        f"# Step 2: Change instance type\n"
        f"aws ec2 modify-instance-attribute --instance-id {finding.resource_id} "
        f'--instance-type {{"Value": "{target_type}"}}{region_flag}\n'
        f"# Step 3: Start the instance\n"
        f"aws ec2 start-instances --instance-ids {finding.resource_id}{region_flag}"
    )


def _extract_instance_type(finding: Finding) -> str | None:
    """Extract instance type from finding description (e.g. 't3.large')."""
    if not finding.description:
        return None
    import re

    match = re.search(r"\b([a-z]\d[a-z]?\.\w+)\b", finding.description)
    return match.group(1) if match else None


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class RecommendationService:
    """Generates recommendations from findings and tracks savings."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id
        self._repo = RecommendationRepository(session, workspace_id)

    async def generate_recommendations(self) -> int:
        """Generate recommendations from all open/acknowledged findings.

        Returns the number of new recommendations created.
        """
        # Fetch findings that could produce recommendations
        result = await self._session.execute(
            select(Finding).where(
                Finding.workspace_id == self._workspace_id,
                Finding.type.in_(["zombie", "idle"]),
                Finding.status.in_(["open", "acknowledged"]),
            )
        )
        findings = list(result.scalars().all())

        created_count = 0
        for finding in findings:
            created_count += await self._generate_from_finding(finding)

        if created_count > 0:
            logger.info(
                "Generated %d new recommendations from %d findings",
                created_count,
                len(findings),
            )

        return created_count

    async def _generate_from_finding(self, finding: Finding) -> int:
        """Generate recommendation(s) from a single finding. Returns count created."""
        confidence = _assign_confidence(finding)
        created = 0

        if finding.type == "zombie":
            _, was_created = await self._repo.create(
                finding_id=finding.id,
                category="zombie_cleanup",
                confidence=confidence,
                title=f"Clean up: {finding.title}",
                description=finding.description,
                resource_id=finding.resource_id,
                remediation_commands=_generate_zombie_commands(finding),
                estimated_monthly_savings=finding.estimated_cost_impact,
            )
            if was_created:
                created += 1

        elif finding.type == "idle":
            # Try right-sizing first (if we can identify instance type and a smaller alternative)
            instance_type = _extract_instance_type(finding)
            target_type = DOWNSIZE_MAP.get(instance_type) if instance_type else None

            if instance_type and target_type:
                current_cost = _monthly_cost(instance_type)
                target_cost = _monthly_cost(target_type)
                savings = (
                    current_cost - target_cost
                    if current_cost and target_cost
                    else finding.estimated_cost_impact
                )

                _, was_created = await self._repo.create(
                    finding_id=finding.id,
                    category="right_sizing",
                    confidence=confidence,
                    title=f"Right-size {finding.resource_id}: {instance_type} → {target_type}",
                    description=(
                        f"Instance {finding.resource_id} is underutilized. "
                        f"Downsize from {instance_type} to {target_type} to save "
                        f"~${savings}/month."
                        if savings
                        else f"Instance {finding.resource_id} is underutilized. "
                        f"Downsize from {instance_type} to {target_type}."
                    ),
                    resource_id=finding.resource_id,
                    remediation_commands=_generate_right_sizing_commands(
                        finding, instance_type, target_type
                    ),
                    estimated_monthly_savings=savings,
                )
                if was_created:
                    created += 1
            else:
                # No right-sizing possible — recommend shutdown
                _, was_created = await self._repo.create(
                    finding_id=finding.id,
                    category="idle_shutdown",
                    confidence=confidence,
                    title=f"Shut down idle resource: {finding.resource_id}",
                    description=finding.description,
                    resource_id=finding.resource_id,
                    remediation_commands=_generate_idle_shutdown_commands(finding),
                    estimated_monthly_savings=finding.estimated_cost_impact,
                )
                if was_created:
                    created += 1

        return created

    # --- Savings tracking ---

    async def update_savings_for_implemented(self) -> int:
        """Recalculate actual savings for all implemented recommendations.

        Compares average daily cost of the resource 30 days before vs after
        implementation date. If < 30 days have elapsed, savings are projected.

        Returns count of recommendations updated.
        """
        from numio.models.recommendation import Recommendation

        result = await self._session.execute(
            select(Recommendation).where(
                Recommendation.workspace_id == self._workspace_id,
                Recommendation.status == "implemented",
                Recommendation.implemented_at.isnot(None),
            )
        )
        recs = list(result.scalars().all())
        updated = 0

        for rec in recs:
            savings, label = await self._calculate_savings(rec)
            if savings is not None:
                await self._repo.update_savings(rec.id, savings, label)
                updated += 1

        return updated

    async def _calculate_savings(
        self,
        rec: "Recommendation",  # noqa: F821
    ) -> tuple[Decimal | None, str]:
        """Calculate actual savings for an implemented recommendation.

        Before = avg daily cost over 30 days before implementation.
        After  = avg daily cost over days since implementation (up to 30).
        Savings = (before - after) × 30.

        Returns (savings_amount, "actual"|"projected") or (None, "").
        """
        impl_date = rec.implemented_at
        if impl_date is None:
            return None, ""

        now = datetime.now(timezone.utc)
        days_since = (now - impl_date).days

        # Before period: 30 days prior to implementation
        before_start = impl_date - timedelta(days=30)
        before_avg = await self._avg_daily_cost(rec.resource_id, before_start, impl_date)
        if before_avg is None:
            return None, ""

        # After period: up to 30 days after implementation
        after_end = min(impl_date + timedelta(days=30), now)
        after_avg = await self._avg_daily_cost(rec.resource_id, impl_date, after_end)
        if after_avg is None:
            # No cost data after — assume full savings
            after_avg = Decimal("0")

        savings = (before_avg - after_avg) * Decimal("30")
        label = "actual" if days_since >= 30 else "projected"
        return max(savings, Decimal("0")), label

    async def _avg_daily_cost(
        self, resource_id: str, start: datetime, end: datetime
    ) -> Decimal | None:
        """Get average daily unblended cost for a resource in a date range."""
        from sqlalchemy import func as sa_func

        result = await self._session.execute(
            select(
                sa_func.sum(CostRecord.unblended_cost).label("total"),
            ).where(
                CostRecord.workspace_id == self._workspace_id,
                CostRecord.resource_id == resource_id,
                CostRecord.usage_start >= start,
                CostRecord.usage_end <= end,
            )
        )
        row = result.one()
        total = row.total
        if total is None:
            return None

        days = max((end - start).days, 1)
        return total / Decimal(str(days))
