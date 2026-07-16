"""Remediation campaign service.

Handles campaign creation (with filter resolution), owner inference,
CLI command generation, and status transition validation.
"""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.campaign import CampaignResource, RemediationCampaign
from numio.models.cloud_resource import CloudResource
from numio.models.compliance import ComplianceResult
from numio.models.tag_policy import TagPolicyRule
from numio.schemas.campaign import CampaignCreate, ResourceFilter

logger = logging.getLogger("numio.core.campaign_service")

# Valid status transitions: from_status → set of allowed to_statuses
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"notified", "fixed", "excluded"},
    "notified": {"fixed", "escalated", "excluded"},
    "escalated": {"fixed", "excluded"},
    "fixed": {"excluded"},
    # "excluded" is terminal — no transitions out
}

# Resource types that support resourcegroupstaggingapi
TAGGING_API_SUPPORTED = {"ec2", "rds", "s3", "ebs", "eip", "lambda"}


async def create_campaign(
    session: AsyncSession,
    workspace_id: str,
    data: CampaignCreate,
) -> RemediationCampaign:
    """Create a remediation campaign from resource IDs and/or filters."""
    # 1. Resolve target resource IDs
    resource_ids = await _resolve_resource_ids(
        session,
        workspace_id,
        data.resource_ids,
        data.filters,
    )
    if not resource_ids:
        raise ValueError("No matching non-compliant resources found")

    # 2. Load resources
    resources = await _load_resources(session, resource_ids)
    if not resources:
        raise ValueError("No matching non-compliant resources found")

    # 3. Snapshot current compliance for these resources
    before_score = await _compute_resource_set_compliance(
        session,
        workspace_id,
        resource_ids,
    )

    # 4. Load compliance violations for these resources
    violations = await _load_violations(
        session,
        workspace_id,
        resource_ids,
    )

    # 5. Load cost data for resources
    cost_lookup = await _load_resource_costs(
        session,
        workspace_id,
        resource_ids,
    )

    # 6. Build campaign
    campaign = RemediationCampaign(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        name=data.name,
        description=data.description,
        deadline=data.deadline,
        target_compliance_goal=data.target_compliance_goal,
        status="active",
        before_compliance_score=before_score,
        resource_count=len(resources),
    )

    # 7. Build campaign resources with owner inference and CLI commands
    for resource in resources:
        resource_violations = violations.get(resource.id, [])
        owner = infer_owner(resource)
        commands = generate_tag_commands(resource, resource_violations)

        cr = CampaignResource(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            resource_id=resource.id,
            remediation_status="pending",
            inferred_owner=owner,
            violated_rules=resource_violations or None,
            tag_commands=commands or None,
            resource_cost=cost_lookup.get(resource.id, Decimal("0")),
        )
        campaign.resources.append(cr)

    session.add(campaign)
    await session.commit()
    # Re-load with resources eagerly to avoid lazy-load issues in async
    from sqlalchemy.orm import selectinload

    result = await session.execute(
        select(RemediationCampaign)
        .where(RemediationCampaign.id == campaign.id)
        .options(selectinload(RemediationCampaign.resources))
    )
    return result.scalar_one()


def validate_status_transition(
    current_status: str,
    new_status: str,
) -> str | None:
    """Validate a status transition. Returns error message or None."""
    if current_status == "excluded":
        return "Cannot transition from terminal state 'excluded'"
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        return (
            f"Invalid transition: {current_status} → {new_status}. "
            f"Allowed: {', '.join(sorted(allowed)) or 'none'}"
        )
    return None


def infer_owner(resource: CloudResource) -> str | None:
    """Infer likely owner from resource tags and metadata.

    Returns None when no owner can be inferred.
    """
    tags = resource.tags or {}

    # Check common owner tags (case-insensitive search)
    owner_tag_keys = [
        "owner",
        "Owner",
        "OWNER",
        "team",
        "Team",
        "TEAM",
        "aws:createdBy",
        "created-by",
        "CreatedBy",
        "created_by",
        "contact",
        "Contact",
        "email",
        "Email",
    ]
    for key in owner_tag_keys:
        if key in tags and tags[key]:
            return tags[key]

    return None


def generate_tag_commands(
    resource: CloudResource,
    violations: list[dict],
) -> list[str]:
    """Generate AWS CLI commands to fix tag violations.

    Uses resourcegroupstaggingapi for supported types, falls back to
    service-specific commands.
    """
    if not violations:
        return []

    # Build the tags to apply from violations
    tags_to_apply: dict[str, str] = {}
    for v in violations:
        tag_name = v.get("tag_name", "")
        if not tag_name:
            continue
        default = v.get("default_value")
        if v.get("status") == "missing_tag" and default:
            tags_to_apply[tag_name] = default
        elif v.get("status") == "missing_tag":
            tags_to_apply[tag_name] = "FILL_IN"
        elif v.get("status") == "invalid_value":
            allowed = v.get("allowed_values", [])
            if allowed:
                tags_to_apply[tag_name] = allowed[0]
            else:
                tags_to_apply[tag_name] = "FILL_IN"

    if not tags_to_apply:
        return []

    arn = resource.arn
    service = resource.service
    resource_id = resource.resource_id
    region = resource.region
    account_id = resource.account_id

    commands = []

    if arn and service in TAGGING_API_SUPPORTED:
        # Use Resource Groups Tagging API (generic, works for most types)
        tag_args = " ".join(f"{k}={v}" for k, v in tags_to_apply.items())
        cmd = (
            f"aws resourcegroupstaggingapi tag-resources"
            f" --resource-arn-list {arn}"
            f" --tags {tag_args}"
        )
        commands.append(cmd)
    else:
        # Fallback: service-specific commands
        commands.extend(
            _service_specific_commands(
                service,
                resource_id,
                region,
                account_id,
                tags_to_apply,
            )
        )

    return commands


def _service_specific_commands(
    service: str,
    resource_id: str,
    region: str,
    account_id: str,
    tags: dict[str, str],
) -> list[str]:
    """Generate service-specific tag commands as fallback."""
    tag_specs = " ".join(f"Key={k},Value={v}" for k, v in tags.items())

    if service == "ec2":
        return [
            f"aws ec2 create-tags --region {region} --resources {resource_id} --tags {tag_specs}"
        ]
    if service == "rds":
        arn = f"arn:aws:rds:{region}:{account_id}:db:{resource_id}"
        return [
            f"aws rds add-tags-to-resource"
            f" --region {region}"
            f" --resource-name {arn}"
            f" --tags {tag_specs}"
        ]
    if service == "s3":
        # S3 tagging replaces all tags; use put-bucket-tagging
        tag_set = " ".join(f"Key={k},Value={v}" for k, v in tags.items())
        return [
            f"aws s3api put-bucket-tagging --bucket {resource_id} --tagging TagSet=[{{{tag_set}}}]"
        ]
    if service == "ebs":
        return [
            f"aws ec2 create-tags --region {region} --resources {resource_id} --tags {tag_specs}"
        ]
    if service == "eip":
        return [
            f"aws ec2 create-tags --region {region} --resources {resource_id} --tags {tag_specs}"
        ]
    if service == "lambda":
        arn = f"arn:aws:lambda:{region}:{account_id}:function:{resource_id}"
        return [
            f"aws lambda tag-resource"
            f" --region {region}"
            f" --resource {arn}"
            f" --tags {','.join(f'{k}={v}' for k, v in tags.items())}"
        ]

    return []


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _resolve_resource_ids(
    session: AsyncSession,
    workspace_id: str,
    explicit_ids: list[uuid.UUID] | None,
    filters: ResourceFilter | None,
) -> list[uuid.UUID]:
    """Resolve resource IDs from explicit list and/or filter criteria."""
    ids: set[uuid.UUID] = set()

    if explicit_ids:
        ids.update(explicit_ids)

    if filters:
        filtered = await _apply_filters(session, workspace_id, filters)
        ids.update(filtered)

    return list(ids)


async def _apply_filters(
    session: AsyncSession,
    workspace_id: str,
    filters: ResourceFilter,
) -> list[uuid.UUID]:
    """Resolve filters against latest compliance results."""
    # Find latest audit run with compliance results
    latest_run = await session.execute(
        select(ComplianceResult.audit_run_id)
        .where(ComplianceResult.workspace_id == workspace_id)
        .order_by(ComplianceResult.created_at.desc())
        .limit(1)
    )
    run_id = latest_run.scalar_one_or_none()
    if run_id is None:
        return []

    stmt = select(ComplianceResult.resource_id).where(
        ComplianceResult.workspace_id == workspace_id,
        ComplianceResult.audit_run_id == run_id,
        ComplianceResult.status != "compliant",
    )

    if filters.account_id:
        # Join with CloudResource to filter by account
        stmt = stmt.join(
            CloudResource,
            ComplianceResult.resource_id == CloudResource.id,
        ).where(CloudResource.account_id == filters.account_id)

    if filters.policy_id:
        stmt = stmt.where(
            ComplianceResult.policy_id == filters.policy_id,
        )

    if filters.tag_name:
        stmt = stmt.join(
            TagPolicyRule,
            ComplianceResult.rule_id == TagPolicyRule.id,
        ).where(TagPolicyRule.tag_name == filters.tag_name)

    if filters.status:
        stmt = stmt.where(ComplianceResult.status == filters.status)

    result = await session.execute(stmt.distinct())
    return [row[0] for row in result.all()]


async def _load_resources(
    session: AsyncSession,
    resource_ids: list[uuid.UUID],
) -> list[CloudResource]:
    result = await session.execute(select(CloudResource).where(CloudResource.id.in_(resource_ids)))
    return list(result.scalars().all())


async def _compute_resource_set_compliance(
    session: AsyncSession,
    workspace_id: str,
    resource_ids: list[uuid.UUID],
) -> Decimal | None:
    """Compute cost-weighted compliance for a specific set of resources.

    Uses the latest compliance results.
    """
    if not resource_ids:
        return None

    latest_run = await session.execute(
        select(ComplianceResult.audit_run_id)
        .where(ComplianceResult.workspace_id == workspace_id)
        .order_by(ComplianceResult.created_at.desc())
        .limit(1)
    )
    run_id = latest_run.scalar_one_or_none()
    if run_id is None:
        return None

    # Get per-resource compliance: fully compliant = all results are compliant
    from sqlalchemy import func as sa_func

    result = await session.execute(
        select(
            ComplianceResult.resource_id,
            ComplianceResult.resource_cost,
            sa_func.bool_and(ComplianceResult.status == "compliant").label("is_compliant"),
        )
        .where(
            ComplianceResult.audit_run_id == run_id,
            ComplianceResult.resource_id.in_(resource_ids),
        )
        .group_by(
            ComplianceResult.resource_id,
            ComplianceResult.resource_cost,
        )
    )
    rows = result.all()
    if not rows:
        return None

    total_cost = Decimal("0")
    compliant_cost = Decimal("0")
    for row in rows:
        total_cost += row.resource_cost
        if row.is_compliant:
            compliant_cost += row.resource_cost

    if total_cost > 0:
        return ((compliant_cost / total_cost) * 100).quantize(Decimal("0.0001"))
    return Decimal("0")


async def _load_violations(
    session: AsyncSession,
    workspace_id: str,
    resource_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[dict]]:
    """Load compliance violations for resources from latest audit."""
    latest_run = await session.execute(
        select(ComplianceResult.audit_run_id)
        .where(ComplianceResult.workspace_id == workspace_id)
        .order_by(ComplianceResult.created_at.desc())
        .limit(1)
    )
    run_id = latest_run.scalar_one_or_none()
    if run_id is None:
        return {}

    result = await session.execute(
        select(
            ComplianceResult.resource_id,
            ComplianceResult.status,
            ComplianceResult.current_value,
            ComplianceResult.policy_id,
            ComplianceResult.rule_id,
            TagPolicyRule.tag_name,
            TagPolicyRule.value_type,
            TagPolicyRule.allowed_values,
            TagPolicyRule.default_value,
        )
        .join(
            TagPolicyRule,
            ComplianceResult.rule_id == TagPolicyRule.id,
        )
        .where(
            ComplianceResult.audit_run_id == run_id,
            ComplianceResult.resource_id.in_(resource_ids),
            ComplianceResult.status != "compliant",
        )
    )

    violations: dict[uuid.UUID, list[dict]] = {}
    for row in result.all():
        entry = {
            "status": row.status,
            "current_value": row.current_value,
            "policy_id": str(row.policy_id),
            "rule_id": str(row.rule_id),
            "tag_name": row.tag_name,
            "value_type": row.value_type,
            "allowed_values": row.allowed_values,
            "default_value": row.default_value,
        }
        violations.setdefault(row.resource_id, []).append(entry)

    return violations


async def _load_resource_costs(
    session: AsyncSession,
    workspace_id: str,
    resource_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Decimal]:
    """Load resource costs from latest compliance results."""
    latest_run = await session.execute(
        select(ComplianceResult.audit_run_id)
        .where(ComplianceResult.workspace_id == workspace_id)
        .order_by(ComplianceResult.created_at.desc())
        .limit(1)
    )
    run_id = latest_run.scalar_one_or_none()
    if run_id is None:
        return {}

    result = await session.execute(
        select(
            ComplianceResult.resource_id,
            ComplianceResult.resource_cost,
        )
        .where(
            ComplianceResult.audit_run_id == run_id,
            ComplianceResult.resource_id.in_(resource_ids),
        )
        .distinct(ComplianceResult.resource_id)
    )
    return {row.resource_id: row.resource_cost for row in result.all()}
