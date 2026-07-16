"""Infrastructure policy evaluation service.

Evaluates resources and costs against infrastructure policies and generates
violation findings. Supports four policy types: instance_restriction,
spending_limit, resource_count_limit, and environment_constraint.
"""

import calendar
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.cost_attribution_service import CostAttributionService
from numio.db.finding_repository import FindingRepository
from numio.db.infra_policy_repository import InfraPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.models.infra_policy import InfraPolicy
from numio.schemas.finding import CreateFindingRequest

logger = logging.getLogger(__name__)

DETECTION_SOURCE = "infra_policy_engine"


class InfraPolicyEvaluationService:
    """Evaluates infrastructure policies against cloud resources and cost data."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id
        self._policy_repo = InfraPolicyRepository(session, workspace_id)
        self._finding_repo = FindingRepository(session, workspace_id)
        self._cost_service = CostAttributionService(session, workspace_id)

    # --- Public API ---

    async def evaluate_all(self) -> int:
        """Evaluate all active policies. Returns count of new violations created."""
        policies = await self._policy_repo.get_active_policies()
        total_new = 0
        for policy in policies:
            total_new += await self.evaluate_policy(policy)
        return total_new

    async def evaluate_guardrails(self) -> int:
        """Evaluate only guardrail policies. Called after resource inventory sync."""
        policies = await self._policy_repo.get_guardrail_policies()
        total_new = 0
        for policy in policies:
            total_new += await self.evaluate_policy(policy)
        return total_new

    async def evaluate_policy(self, policy: InfraPolicy) -> int:
        """Evaluate a single policy. Returns count of new violations created."""
        evaluator = self._get_evaluator(policy.type)
        if evaluator is None:
            logger.warning("Unknown policy type: %s", policy.type)
            return 0

        new_violations = await evaluator(policy)

        # Update compliance stats
        await self._update_compliance(policy)

        return new_violations

    async def get_violations_for_policy(self, policy_id: str) -> list[dict]:
        """Get current violations for a policy from findings."""
        findings, _ = await self._finding_repo.list_findings(
            finding_type="policy_violation",
            detection_source=DETECTION_SOURCE,
            status="open",
            limit=1000,
        )
        # Filter findings for this policy by resource_id prefix
        prefix = f"policy:{policy_id}:"
        violations = []
        for f in findings:
            if f.resource_id.startswith(prefix):
                violations.append(
                    {
                        "finding_id": str(f.id),
                        "title": f.title,
                        "severity": f.severity,
                        "status": f.status,
                        "resource_id": f.resource_id,
                        "description": f.description,
                        "detected_at": f.detected_at.isoformat() if f.detected_at else None,
                    }
                )
        return violations

    async def resolve_policy_findings(self, policy_id: str) -> int:
        """Resolve all open findings for a policy (called when policy is deleted)."""
        findings, _ = await self._finding_repo.list_findings(
            finding_type="policy_violation",
            detection_source=DETECTION_SOURCE,
            limit=1000,
        )
        prefix = f"policy:{policy_id}:"
        resolved_count = 0
        for f in findings:
            if f.resource_id.startswith(prefix) and f.status in ("open", "acknowledged"):
                await self._finding_repo.resolve(f.id, changed_by="system", reason="Policy deleted")
                resolved_count += 1
        return resolved_count

    # --- Evaluators ---

    def _get_evaluator(self, policy_type: str):
        """Return the evaluation function for a policy type."""
        evaluators = {
            "instance_restriction": self._evaluate_instance_restriction,
            "spending_limit": self._evaluate_spending_limit,
            "resource_count_limit": self._evaluate_resource_count_limit,
            "environment_constraint": self._evaluate_environment_constraint,
        }
        return evaluators.get(policy_type)

    async def _evaluate_instance_restriction(self, policy: InfraPolicy) -> int:
        """Check that resources don't use denied instance types."""
        rule = policy.rule
        denied = set(rule.get("denied_instance_types", []))
        allowed = set(rule.get("allowed_instance_types", []))

        resources = await self._get_applicable_resources(policy)
        new_violations = 0

        for resource in resources:
            metadata = resource.resource_metadata or {}
            # Check instance_type (EC2) or instance_class (RDS)
            instance_type = metadata.get("instance_type") or metadata.get("instance_class")
            if instance_type is None:
                continue

            is_violation = False
            if denied and instance_type in denied:
                is_violation = True
            elif allowed and instance_type not in allowed:
                is_violation = True

            if is_violation:
                _, created = await self._finding_repo.create_or_update(
                    CreateFindingRequest(
                        type="policy_violation",
                        severity=policy.severity,
                        title=(
                            f"Policy '{policy.name}': disallowed instance type "
                            f"'{instance_type}' on {resource.resource_id}"
                        ),
                        description=(
                            f"Resource {resource.resource_id} "
                            f"({resource.service}/{resource.resource_type}) "
                            f"uses instance type '{instance_type}' "
                            f"which violates policy '{policy.name}'."
                        ),
                        resource_id=f"policy:{policy.id}:resource:{resource.resource_id}",
                        detection_source=DETECTION_SOURCE,
                        suggested_action=(
                            f"Change instance type from '{instance_type}' to an allowed type"
                        ),
                    )
                )
                if created:
                    new_violations += 1

        return new_violations

    async def _evaluate_spending_limit(self, policy: InfraPolicy) -> int:
        """Check that spending doesn't exceed the limit for a dimension."""
        rule = policy.rule
        dimension = rule.get("dimension", "")
        dimension_value = rule.get("dimension_value", "")
        limit_amount = Decimal(str(rule.get("limit_amount", 0)))
        period = rule.get("period", "monthly")

        period_start, period_end = self._period_boundaries(period)

        cost_data = await self._cost_service.get_cost_by_dimension(
            dimension=dimension,
            start_date=period_start,
            end_date=min(date.today(), period_end),
        )

        current_spend = Decimal(0)
        for item in cost_data.data:
            if item.dimension_value == dimension_value:
                current_spend = item.amount
                break

        if current_spend > limit_amount:
            q = Decimal("0.01")
            overage = (current_spend - limit_amount).quantize(q, rounding=ROUND_HALF_UP)
            _, created = await self._finding_repo.create_or_update(
                CreateFindingRequest(
                    type="policy_violation",
                    severity=policy.severity,
                    title=(
                        f"Policy '{policy.name}': spending limit exceeded — "
                        f"${current_spend} / ${limit_amount}"
                    ),
                    description=(
                        f"Spending for {dimension}='{dimension_value}' is ${current_spend}, "
                        f"exceeding the ${limit_amount} {period} limit by ${overage}."
                    ),
                    resource_id=f"policy:{policy.id}:spending:{dimension}:{dimension_value}",
                    detection_source=DETECTION_SOURCE,
                    suggested_action=(
                        f"Review and reduce spending for {dimension}='{dimension_value}'"
                    ),
                    estimated_cost_impact=overage,
                )
            )
            return 1 if created else 0

        return 0

    async def _evaluate_resource_count_limit(self, policy: InfraPolicy) -> int:
        """Check that resource count doesn't exceed the limit."""
        rule = policy.rule
        service = rule.get("service", "")
        resource_type = rule.get("resource_type", "")
        max_count = rule.get("max_count", 0)

        # Count active resources matching service/type within applicability
        conditions = [
            CloudResource.workspace_id == self._workspace_id,
            CloudResource.service == service,
            CloudResource.resource_type == resource_type,
            CloudResource.terminated_at.is_(None),
        ]

        applicability = policy.applicability or {}
        accounts = applicability.get("accounts", [])
        regions = applicability.get("regions", [])
        if accounts:
            conditions.append(CloudResource.account_id.in_(accounts))
        if regions:
            conditions.append(CloudResource.region.in_(regions))

        count_result = await self._session.execute(
            select(sa_func.count(CloudResource.id)).where(*conditions)
        )
        actual_count = count_result.scalar_one()

        if actual_count > max_count:
            _, created = await self._finding_repo.create_or_update(
                CreateFindingRequest(
                    type="policy_violation",
                    severity=policy.severity,
                    title=(
                        f"Policy '{policy.name}': resource count exceeded — "
                        f"{actual_count} / {max_count} {service}/{resource_type}"
                    ),
                    description=(
                        f"Found {actual_count} active {service}/{resource_type} resources, "
                        f"exceeding the limit of {max_count}."
                    ),
                    resource_id=f"policy:{policy.id}:count:{service}:{resource_type}",
                    detection_source=DETECTION_SOURCE,
                    suggested_action=(
                        f"Reduce {service}/{resource_type} count "
                        f"from {actual_count} to {max_count} or fewer"
                    ),
                )
            )
            return 1 if created else 0

        return 0

    async def _evaluate_environment_constraint(self, policy: InfraPolicy) -> int:
        """Check that resources are in allowed regions."""
        rule = policy.rule
        allowed_regions = set(rule.get("allowed_regions", []))

        resources = await self._get_applicable_resources(policy)
        new_violations = 0

        for resource in resources:
            if resource.region not in allowed_regions:
                _, created = await self._finding_repo.create_or_update(
                    CreateFindingRequest(
                        type="policy_violation",
                        severity=policy.severity,
                        title=(
                            f"Policy '{policy.name}': resource {resource.resource_id} "
                            f"in disallowed region '{resource.region}'"
                        ),
                        description=(
                            f"Resource {resource.resource_id} "
                            f"({resource.service}/{resource.resource_type}) "
                            f"is in region '{resource.region}', "
                            f"not in allowed list: "
                            f"{', '.join(sorted(allowed_regions))}."
                        ),
                        resource_id=f"policy:{policy.id}:resource:{resource.resource_id}",
                        detection_source=DETECTION_SOURCE,
                        suggested_action=(
                            f"Migrate resource to one of: {', '.join(sorted(allowed_regions))}"
                        ),
                    )
                )
                if created:
                    new_violations += 1

        return new_violations

    # --- Helpers ---

    async def _get_applicable_resources(self, policy: InfraPolicy) -> list[CloudResource]:
        """Get active cloud resources matching a policy's applicability filter."""
        conditions = [
            CloudResource.workspace_id == self._workspace_id,
            CloudResource.terminated_at.is_(None),
        ]

        applicability = policy.applicability or {}
        accounts = applicability.get("accounts", [])
        services = applicability.get("services", [])
        resource_types = applicability.get("resource_types", [])
        regions = applicability.get("regions", [])

        if accounts:
            conditions.append(CloudResource.account_id.in_(accounts))
        if services:
            conditions.append(CloudResource.service.in_(services))
        if resource_types:
            conditions.append(CloudResource.resource_type.in_(resource_types))
        if regions:
            conditions.append(CloudResource.region.in_(regions))

        result = await self._session.execute(select(CloudResource).where(*conditions))
        return list(result.scalars().all())

    async def _update_compliance(self, policy: InfraPolicy) -> None:
        """Calculate and store compliance percentage for a policy."""
        now = datetime.now(timezone.utc)

        if policy.type == "spending_limit":
            # For spending limits, compliance is binary: under limit or not
            rule = policy.rule
            dimension = rule.get("dimension", "")
            dimension_value = rule.get("dimension_value", "")
            limit_amount = Decimal(str(rule.get("limit_amount", 0)))
            period = rule.get("period", "monthly")

            period_start, period_end = self._period_boundaries(period)
            cost_data = await self._cost_service.get_cost_by_dimension(
                dimension=dimension,
                start_date=period_start,
                end_date=min(date.today(), period_end),
            )

            current_spend = Decimal(0)
            for item in cost_data.data:
                if item.dimension_value == dimension_value:
                    current_spend = item.amount
                    break

            compliance = Decimal("100.00") if current_spend <= limit_amount else Decimal("0.00")

        elif policy.type == "resource_count_limit":
            # Binary compliance for count limits
            rule = policy.rule
            service = rule.get("service", "")
            resource_type = rule.get("resource_type", "")
            max_count = rule.get("max_count", 0)

            conditions = [
                CloudResource.workspace_id == self._workspace_id,
                CloudResource.service == service,
                CloudResource.resource_type == resource_type,
                CloudResource.terminated_at.is_(None),
            ]
            applicability = policy.applicability or {}
            accounts = applicability.get("accounts", [])
            regions = applicability.get("regions", [])
            if accounts:
                conditions.append(CloudResource.account_id.in_(accounts))
            if regions:
                conditions.append(CloudResource.region.in_(regions))

            count_result = await self._session.execute(
                select(sa_func.count(CloudResource.id)).where(*conditions)
            )
            actual_count = count_result.scalar_one()
            compliance = Decimal("100.00") if actual_count <= max_count else Decimal("0.00")

        else:
            # For instance_restriction and environment_constraint: per-resource compliance
            resources = await self._get_applicable_resources(policy)
            if not resources:
                compliance = Decimal("100.00")
            else:
                compliant = 0
                for resource in resources:
                    if not self._is_resource_violating(policy, resource):
                        compliant += 1
                compliance = Decimal(str(round(compliant / len(resources) * 100, 2)))

        await self._policy_repo.update_compliance(policy.id, compliance, now)

    def _is_resource_violating(self, policy: InfraPolicy, resource: CloudResource) -> bool:
        """Check if a single resource violates a policy (for compliance calculation)."""
        if policy.type == "instance_restriction":
            rule = policy.rule
            denied = set(rule.get("denied_instance_types", []))
            allowed = set(rule.get("allowed_instance_types", []))
            metadata = resource.resource_metadata or {}
            instance_type = metadata.get("instance_type") or metadata.get("instance_class")
            if instance_type is None:
                return False
            if denied and instance_type in denied:
                return True
            if allowed and instance_type not in allowed:
                return True
            return False

        elif policy.type == "environment_constraint":
            allowed_regions = set(policy.rule.get("allowed_regions", []))
            return resource.region not in allowed_regions

        return False

    @staticmethod
    def _period_boundaries(period: str) -> tuple[date, date]:
        """Return (start, end) for the current period."""
        today = date.today()
        if period == "monthly":
            start = today.replace(day=1)
            _, last_day = calendar.monthrange(today.year, today.month)
            end = today.replace(day=last_day) + timedelta(days=1)
        elif period == "quarterly":
            quarter_month = ((today.month - 1) // 3) * 3 + 1
            start = today.replace(month=quarter_month, day=1)
            end_month = quarter_month + 2
            _, last_day = calendar.monthrange(today.year, end_month)
            end = today.replace(month=end_month, day=last_day) + timedelta(days=1)
        else:
            raise ValueError(f"Unknown period: {period}")
        return start, end
