"""IA v2 Budgets with pacing — separate router from legacy `/budgets`.

Prefix `/budgets-v2` to avoid collision with the existing budgets router.
The IA v2 frontend will move to this path when persistence lands.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_budgets import (
    BudgetPeriodV2,
    BudgetStatusV2,
    BudgetV2,
    BudgetV2ListResponse,
    CreateBudgetV2Request,
)

router = APIRouter(prefix="/budgets-v2", tags=["ia-v2-budgets"])

_DAY_OF_PERIOD = 15
_PERIOD_TOTAL = 31
_EXPECTED_PCT = round(_DAY_OF_PERIOD / _PERIOD_TOTAL * 100)

_SEED = [
    ("team-eng", "Engineering", Decimal("80000"), Decimal("64320")),
    ("team-payments", "Payments", Decimal("48000"), Decimal("41280")),
    ("team-ml", "ML Platform", Decimal("24000"), Decimal("24840")),
    ("team-data", "Data & Analytics", Decimal("18000"), Decimal("11402")),
    ("team-finance", "Finance", Decimal("12000"), Decimal("8240")),
    ("team-sales", "Sales", Decimal("8000"), Decimal("6980")),
]


def _derive_status(spent: Decimal, budget: Decimal) -> BudgetStatusV2:
    pct = float(spent / budget) * 100
    if pct >= 100:
        return BudgetStatusV2.over
    if pct >= 85:
        return BudgetStatusV2.at_risk
    return BudgetStatusV2.on_track


def _build_budget(workspace_id: uuid.UUID, id_: str, team: str, budget: Decimal, spent: Decimal) -> BudgetV2:
    pct = int(round(float(spent / budget) * 100))
    return BudgetV2(
        id=id_,
        workspace_id=workspace_id,
        team=team,
        budget=budget,
        spent=spent,
        alert_pct=90,
        period=BudgetPeriodV2.month,
        status=_derive_status(spent, budget),
        pct_spent=pct,
        expected_pct_at_today=_EXPECTED_PCT,
        drift_pp=pct - _EXPECTED_PCT,
        day_of_period=_DAY_OF_PERIOD,
        period_total_days=_PERIOD_TOTAL,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("", response_model=BudgetV2ListResponse, summary="List budgets with pacing data")
async def list_budgets_v2(
    period: BudgetPeriodV2 = Query(default=BudgetPeriodV2.month),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BudgetV2ListResponse:
    workspace_id = current_user.workspace_id
    scale = 1 if period == BudgetPeriodV2.month else (3 if period == BudgetPeriodV2.quarter else 12)
    budgets = [
        _build_budget(
            workspace_id,
            id_,
            team,
            budget * scale,
            (spent * scale * (Decimal("0.9") if scale > 1 else Decimal("1"))).quantize(Decimal("1")),
        )
        for (id_, team, budget, spent) in _SEED
    ]
    return BudgetV2ListResponse(
        budgets=budgets,
        total_count=len(budgets),
        total_budget=sum((b.budget for b in budgets), Decimal("0")),
        total_spent=sum((b.spent for b in budgets), Decimal("0")),
        over_count=sum(1 for b in budgets if b.status == BudgetStatusV2.over),
        at_risk_count=sum(1 for b in budgets if b.status == BudgetStatusV2.at_risk),
    )


@router.post("", response_model=BudgetV2, status_code=201, summary="Create a budget")
async def create_budget_v2(
    body: CreateBudgetV2Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BudgetV2:
    return _build_budget(
        current_user.workspace_id,
        f"team-{uuid.uuid4()}",
        body.team,
        body.budget,
        Decimal("0"),
    )


@router.get("/{budget_id}/pacing", summary="Get pacing data for a budget")
async def get_pacing(
    budget_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    return {
        "budget_id": budget_id,
        "expected_pct_at_today": _EXPECTED_PCT,
        "day_of_period": _DAY_OF_PERIOD,
        "period_total_days": _PERIOD_TOTAL,
        "by_day": [{"day": d, "pct_at_day": round(d / _PERIOD_TOTAL * 100)} for d in range(1, _PERIOD_TOTAL + 1)],
    }
