"""Pydantic schemas for IA v2 Budgets with pacing."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class BudgetStatusV2(str, Enum):
    on_track = "on-track"
    at_risk = "at-risk"
    over = "over"


class BudgetPeriodV2(str, Enum):
    month = "month"
    quarter = "quarter"
    year = "year"


class BudgetV2(BaseModel):
    id: str
    workspace_id: uuid.UUID
    team: str
    budget: Decimal
    spent: Decimal
    alert_pct: int = 90
    period: BudgetPeriodV2 = BudgetPeriodV2.month
    status: BudgetStatusV2
    pct_spent: int
    expected_pct_at_today: int
    drift_pp: int
    day_of_period: int
    period_total_days: int
    updated_at: datetime


class BudgetV2ListResponse(BaseModel):
    budgets: list[BudgetV2]
    total_count: int
    total_budget: Decimal
    total_spent: Decimal
    over_count: int
    at_risk_count: int


class CreateBudgetV2Request(BaseModel):
    team: str = Field(..., min_length=1)
    budget: Decimal = Field(..., gt=0)
    alert_pct: int = Field(default=90, ge=1, le=100)
    period: BudgetPeriodV2 = BudgetPeriodV2.month
