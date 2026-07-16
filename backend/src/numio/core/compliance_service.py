"""Compliance audit service.

Evaluates cloud resources against tag policies, produces per-resource compliance
results and cost-weighted aggregate snapshots.
"""

from __future__ import annotations

import logging
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.compliance_repository import ComplianceRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.models.compliance import ComplianceResult, ComplianceSnapshot
from numio.models.cost_record import CostRecord
from numio.models.job import JobRun
from numio.models.tag_policy import TagPolicy, TagPolicyRule

logger = logging.getLogger("numio.core.compliance_service")

BATCH_SIZE = 500

# Value validators by type
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


async def run_compliance_audit(
    session: AsyncSession,
    workspace_id: str,
    audit_run_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, int]:
    """Run a full compliance audit.

    Returns (audit_run_id, total_results_count).
    """
    if audit_run_id is None:
        audit_run_id = uuid.uuid4()

    # Create or reuse a JobRun record so compliance_results FK is satisfied
    now = datetime.now(timezone.utc)
    existing_run = await session.get(JobRun, audit_run_id)
    if existing_run:
        job_run = existing_run
        job_run.status = "running"
    else:
        job_run = JobRun(
            id=audit_run_id,
            workspace_id=workspace_id,
            job_type="compliance_audit",
            status="running",
            started_at=now,
        )
        session.add(job_run)
    await session.flush()

    policy_repo = TagPolicyRepository(session, workspace_id)
    compliance_repo = ComplianceRepository(session, workspace_id)

    # 1. Load active policies with rules
    policies = await policy_repo.list_active()
    if not policies:
        logger.info("No active tag policies — skipping audit")
        return audit_run_id, 0

    # 2. Load all active (non-terminated) resources
    resources = await _load_active_resources(session, workspace_id)
    if not resources:
        logger.info("No active resources — skipping audit")
        return audit_run_id, 0

    # 3. Build cost lookup: resource_id (CloudResource PK) → monthly cost
    cost_lookup = await _build_cost_lookup(session, workspace_id)

    # 4. Delete any previous results for this audit run (idempotent)
    await compliance_repo.delete_results_for_run(audit_run_id)

    # 5. Evaluate each resource against applicable rules
    now = datetime.now(timezone.utc)
    all_results: list[ComplianceResult] = []

    for resource in resources:
        resource_cost = cost_lookup.get(resource.id, Decimal("0"))
        for policy in policies:
            for rule in policy.rules:
                if not _rule_applies_to_resource(rule, resource):
                    continue
                status, current_value = _evaluate_rule(rule, resource)
                all_results.append(
                    ComplianceResult(
                        id=uuid.uuid4(),
                        workspace_id=workspace_id,
                        audit_run_id=audit_run_id,
                        resource_id=resource.id,
                        policy_id=policy.id,
                        rule_id=rule.id,
                        status=status,
                        current_value=current_value,
                        resource_cost=resource_cost,
                    )
                )

    # 6. Bulk insert results
    for i in range(0, len(all_results), BATCH_SIZE):
        await compliance_repo.bulk_insert_results(all_results[i : i + BATCH_SIZE])

    # 7. Compute and store aggregate snapshots
    snapshots = _compute_snapshots(
        workspace_id,
        audit_run_id,
        now,
        all_results,
        resources,
        cost_lookup,
        policies,
    )
    if snapshots:
        await compliance_repo.bulk_insert_snapshots(snapshots)

    # Mark job run as complete
    job_run.status = "success"
    job_run.finished_at = datetime.now(timezone.utc)

    await session.commit()

    logger.info(
        "Compliance audit complete: %d results, %d snapshots",
        len(all_results),
        len(snapshots),
    )
    return audit_run_id, len(all_results)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


async def _load_active_resources(
    session: AsyncSession,
    workspace_id: str,
) -> list[CloudResource]:
    result = await session.execute(
        select(CloudResource).where(
            CloudResource.workspace_id == workspace_id,
            CloudResource.terminated_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def _build_cost_lookup(
    session: AsyncSession,
    workspace_id: str,
) -> dict[uuid.UUID, Decimal]:
    """Map CloudResource.id → total monthly unblended_cost.

    Joins cloud_resources to cost_records via ARN or resource_id for the most
    recent billing period.
    """
    # Find the latest billing period
    latest_period = await session.execute(
        select(sa_func.max(CostRecord.billing_period)).where(
            CostRecord.workspace_id == workspace_id,
        )
    )
    billing_period = latest_period.scalar_one_or_none()
    if billing_period is None:
        return {}

    # Sum cost per cost_record.resource_id for the latest period
    cost_by_resource_id = await session.execute(
        select(
            CostRecord.resource_id,
            sa_func.sum(CostRecord.unblended_cost).label("total_cost"),
        )
        .where(
            CostRecord.workspace_id == workspace_id,
            CostRecord.billing_period == billing_period,
            CostRecord.resource_id.isnot(None),
        )
        .group_by(CostRecord.resource_id)
    )
    # Build lookup: CUR resource_id (typically ARN) → cost
    cur_cost_map: dict[str, Decimal] = {}
    for row in cost_by_resource_id.all():
        if row.resource_id:
            cur_cost_map[row.resource_id] = row.total_cost

    if not cur_cost_map:
        return {}

    # Load cloud resources and match by ARN or resource_id
    resources = await session.execute(
        select(CloudResource.id, CloudResource.arn, CloudResource.resource_id).where(
            CloudResource.workspace_id == workspace_id,
            CloudResource.terminated_at.is_(None),
        )
    )
    result: dict[uuid.UUID, Decimal] = {}
    for row in resources.all():
        cost = Decimal("0")
        # Match by ARN first (CUR typically stores ARN)
        if row.arn and row.arn in cur_cost_map:
            cost = cur_cost_map[row.arn]
        # Fallback: match by resource_id
        elif row.resource_id and row.resource_id in cur_cost_map:
            cost = cur_cost_map[row.resource_id]
        if cost > 0:
            result[row.id] = cost
    return result


# ---------------------------------------------------------------------------
# Rule evaluation
# ---------------------------------------------------------------------------


def _rule_applies_to_resource(rule: TagPolicyRule, resource: CloudResource) -> bool:
    """Check if a rule is applicable to a given resource."""
    # Check resource type applicability
    if rule.applicable_resource_types:
        # Match on "service" or "service/resource_type" pattern
        resource_key = f"{resource.service}/{resource.resource_type}"
        if (
            resource.service not in rule.applicable_resource_types
            and resource.resource_type not in rule.applicable_resource_types
            and resource_key not in rule.applicable_resource_types
        ):
            return False

    # Check account applicability
    if rule.applicable_accounts:
        if resource.account_id not in rule.applicable_accounts:
            return False

    return True


def _evaluate_rule(
    rule: TagPolicyRule,
    resource: CloudResource,
) -> tuple[str, str | None]:
    """Evaluate a single rule against a resource.

    Returns (status, current_value).
    """
    tags = resource.tags or {}
    tag_value = tags.get(rule.tag_name)

    if tag_value is None:
        return "missing_tag", None

    value = str(tag_value)

    # Equivalence groups make the canonical (first) entry compliant and any
    # other member of the same group drift. A value in no group falls through
    # to normal validation, so enum rules still flag unknown values.
    if rule.equivalence_groups:
        equivalence_status = _match_equivalence_groups(value, rule.equivalence_groups)
        if equivalence_status is not None:
            return equivalence_status, value

    # Tag exists — validate the value
    if not _validate_value(value, rule):
        return "invalid_value", value

    return "compliant", value


def _match_equivalence_groups(value: str, groups: list) -> str | None:
    """Classify a value against equivalence groups.

    Returns ``"compliant"`` when the value is a group's canonical (first)
    entry, ``"drift"`` when it is a non-canonical member, or ``None`` when it
    appears in no group.
    """
    for group in groups or []:
        if not group:
            continue
        if value == group[0]:
            return "compliant"
        if value in group:
            return "drift"
    return None


def _validate_value(value: str, rule: TagPolicyRule) -> bool:
    """Validate a tag value against a rule's value_type and allowed_values."""
    if rule.value_type == "enum":
        if rule.allowed_values:
            return value in rule.allowed_values
        return True  # enum with no allowed_values means any value is OK

    if rule.value_type == "numeric":
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False

    if rule.value_type == "email":
        return bool(EMAIL_RE.match(value))

    if rule.value_type == "date":
        return bool(DATE_RE.match(value))

    # "string" — any non-empty string is valid
    return bool(value)


# ---------------------------------------------------------------------------
# Snapshot computation
# ---------------------------------------------------------------------------


def _compute_snapshots(
    workspace_id: str,
    audit_run_id: uuid.UUID,
    now: datetime,
    results: list[ComplianceResult],
    resources: list[CloudResource],
    cost_lookup: dict[uuid.UUID, Decimal],
    policies: list[TagPolicy],
) -> list[ComplianceSnapshot]:
    """Compute aggregate compliance snapshots from evaluation results."""
    if not results:
        return []

    snapshots: list[ComplianceSnapshot] = []

    # Build helper structures
    # Per-resource: is it fully compliant across ALL rules?
    resource_statuses: dict[uuid.UUID, list[str]] = defaultdict(list)
    for r in results:
        resource_statuses[r.resource_id].append(r.status)

    # Set of resources that are applicable to at least one policy
    applicable_resource_ids = set(resource_statuses.keys())

    # Overall snapshot
    snapshots.append(
        _build_dimension_snapshot(
            workspace_id,
            audit_run_id,
            now,
            "overall",
            None,
            applicable_resource_ids,
            resource_statuses,
            cost_lookup,
        )
    )

    # Per-policy snapshots
    policy_name_map = {p.id: p.name for p in policies}
    policy_resource_statuses: dict[uuid.UUID, dict[uuid.UUID, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for r in results:
        policy_resource_statuses[r.policy_id][r.resource_id].append(r.status)

    for policy_id, res_statuses in policy_resource_statuses.items():
        snapshots.append(
            _build_dimension_snapshot(
                workspace_id,
                audit_run_id,
                now,
                "per_policy",
                policy_name_map.get(policy_id, str(policy_id)),
                set(res_statuses.keys()),
                res_statuses,
                cost_lookup,
            )
        )

    # Per-tag snapshots
    tag_resource_statuses: dict[str, dict[uuid.UUID, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    # We need rule_id → tag_name mapping
    rule_tag_map: dict[uuid.UUID, str] = {}
    for p in policies:
        for rule in p.rules:
            rule_tag_map[rule.id] = rule.tag_name

    for r in results:
        tag_name = rule_tag_map.get(r.rule_id, "unknown")
        tag_resource_statuses[tag_name][r.resource_id].append(r.status)

    for tag_name, res_statuses in tag_resource_statuses.items():
        snapshots.append(
            _build_dimension_snapshot(
                workspace_id,
                audit_run_id,
                now,
                "per_tag",
                tag_name,
                set(res_statuses.keys()),
                res_statuses,
                cost_lookup,
            )
        )

    # Per-account snapshots
    resource_account_map = {r.id: r.account_id for r in resources}
    account_resource_statuses: dict[str, dict[uuid.UUID, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for r in results:
        account = resource_account_map.get(r.resource_id, "unknown")
        account_resource_statuses[account][r.resource_id].append(r.status)

    for account_id, res_statuses in account_resource_statuses.items():
        snapshots.append(
            _build_dimension_snapshot(
                workspace_id,
                audit_run_id,
                now,
                "per_account",
                account_id,
                set(res_statuses.keys()),
                res_statuses,
                cost_lookup,
            )
        )

    # Per-resource-type snapshots
    resource_type_map = {r.id: f"{r.service}/{r.resource_type}" for r in resources}
    rt_resource_statuses: dict[str, dict[uuid.UUID, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for r in results:
        rt = resource_type_map.get(r.resource_id, "unknown")
        rt_resource_statuses[rt][r.resource_id].append(r.status)

    for rt, res_statuses in rt_resource_statuses.items():
        snapshots.append(
            _build_dimension_snapshot(
                workspace_id,
                audit_run_id,
                now,
                "per_resource_type",
                rt,
                set(res_statuses.keys()),
                res_statuses,
                cost_lookup,
            )
        )

    return snapshots


def _build_dimension_snapshot(
    workspace_id: str,
    audit_run_id: uuid.UUID,
    now: datetime,
    dimension: str,
    dimension_value: str | None,
    applicable_ids: set[uuid.UUID],
    resource_statuses: dict[uuid.UUID, list[str]],
    cost_lookup: dict[uuid.UUID, Decimal],
) -> ComplianceSnapshot:
    """Build a single snapshot for a dimension.

    A resource is "fully compliant" only if ALL its evaluations are "compliant".
    """
    total_resources = len(applicable_ids)
    total_cost = Decimal("0")
    compliant_cost = Decimal("0")
    compliant_resources = 0

    for rid in applicable_ids:
        cost = cost_lookup.get(rid, Decimal("0"))
        total_cost += cost
        statuses = resource_statuses.get(rid, [])
        if statuses and all(s == "compliant" for s in statuses):
            compliant_resources += 1
            compliant_cost += cost

    if total_cost > 0:
        score = (compliant_cost / total_cost) * 100
    elif total_resources > 0:
        # All resources have zero cost — use resource count ratio
        score = Decimal(compliant_resources) / Decimal(total_resources) * 100
    else:
        score = Decimal("100")

    return ComplianceSnapshot(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        audit_run_id=audit_run_id,
        snapshot_date=now,
        dimension=dimension,
        dimension_value=dimension_value,
        cost_weighted_score=score.quantize(Decimal("0.0001")),
        total_cost=total_cost,
        compliant_cost=compliant_cost,
        total_resources=total_resources,
        compliant_resources=compliant_resources,
    )
