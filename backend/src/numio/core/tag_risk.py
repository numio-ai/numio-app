"""Risky-write evaluation for tag changes — shared by the REST API and MCP.

A tag write is "risky" when it touches a production resource or a high-spend
footprint, and Numio requires explicit confirmation before proceeding. The
rule mirrors the frontend's original ``isRiskyWrite``:

  risky  ⟺  any affected resource has env in {prod, production}
            OR aggregate latest-period monthly cost > $1000
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord

PROD_ENV_VALUES = {"prod", "production"}
RISKY_COST_THRESHOLD = 1000.0


@dataclass(frozen=True)
class RiskAssessment:
    risky: bool
    reasons: list[str]
    total_monthly_cost: float
    # Latest-period monthly cost per CloudResource.id for the assessed resources.
    cost_by_resource_id: dict


def monthly_cost_for(resource, cost_by_key: dict[str, float]) -> float:
    """Combine cost-record matches for a resource (id and ARN may both appear)."""
    total = cost_by_key.get(resource.resource_id, 0.0)
    if resource.arn and resource.arn != resource.resource_id:
        total += cost_by_key.get(resource.arn, 0.0)
    return total


async def _latest_period_cost(
    session: AsyncSession, workspace_id: str, resource_keys: set[str]
) -> dict[str, float]:
    """Sum unblended cost per resource_id for the workspace's latest billing period."""
    if not resource_keys:
        return {}
    latest = (
        await session.execute(
            select(func.max(CostRecord.billing_period)).where(
                CostRecord.workspace_id == workspace_id
            )
        )
    ).scalar_one_or_none()
    if latest is None:
        return {}
    rows = await session.execute(
        select(CostRecord.resource_id, func.sum(CostRecord.unblended_cost))
        .where(
            CostRecord.workspace_id == workspace_id,
            CostRecord.billing_period == latest,
            CostRecord.resource_id.in_(resource_keys),
        )
        .group_by(CostRecord.resource_id)
    )
    return {rid: float(total) for rid, total in rows.all() if rid is not None}


async def assess_risk(
    session: AsyncSession, workspace_id: str, resources: list[CloudResource]
) -> RiskAssessment:
    """Evaluate whether writing tags to ``resources`` is risky."""
    reasons: list[str] = []

    prod = [r for r in resources if (r.tags or {}).get("env") in PROD_ENV_VALUES]
    if prod:
        reasons.append(f"{len(prod)} affected resource(s) are tagged as production")

    # CUR line_item_resource_id is sometimes the bare id, sometimes the ARN —
    # match on both so the cost lookup is robust to either layout.
    keys = {r.resource_id for r in resources}
    keys |= {r.arn for r in resources if r.arn}
    costs = await _latest_period_cost(session, workspace_id, keys)
    cost_by_resource_id = {r.id: monthly_cost_for(r, costs) for r in resources}
    total = sum(cost_by_resource_id.values())
    if total > RISKY_COST_THRESHOLD:
        reasons.append(f"aggregate latest-period monthly cost ${total:,.2f} exceeds $1,000")

    return RiskAssessment(
        risky=bool(reasons),
        reasons=reasons,
        total_monthly_cost=total,
        cost_by_resource_id=cost_by_resource_id,
    )
