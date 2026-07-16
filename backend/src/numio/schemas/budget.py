"""Pydantic schemas for budget management."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class BudgetPeriod(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"


class BudgetStatus(str, Enum):
    on_track = "on_track"
    at_risk = "at_risk"
    exceeded = "exceeded"


# --- Request schemas ---


class CreateBudgetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="USD", max_length=10)
    period: BudgetPeriod
    dimension: str = Field(..., min_length=1, max_length=100)
    dimension_value: str = Field(..., min_length=1, max_length=255)
    alert_thresholds: list[int] = Field(default=[50, 80, 100], description="Threshold percentages")


class UpdateBudgetRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, max_length=10)
    period: BudgetPeriod | None = None
    dimension: str | None = Field(default=None, min_length=1, max_length=100)
    dimension_value: str | None = Field(default=None, min_length=1, max_length=255)
    alert_thresholds: list[int] | None = None


# --- Response schemas ---


class BudgetResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    name: str
    amount: Decimal
    currency: str
    period: str
    dimension: str
    dimension_value: str
    alert_thresholds: list[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CostDriverItem(BaseModel):
    """A top cost driver contributing to budget spend."""

    dimension_value: str
    amount: Decimal
    percentage: Decimal


class BudgetDetailResponse(BudgetResponse):
    """Budget with live spend-vs-budget data."""

    current_spend: Decimal
    percentage_consumed: Decimal
    projected_spend: Decimal
    remaining: Decimal
    status: BudgetStatus
    days_elapsed: int
    days_in_period: int
    top_cost_drivers: list[CostDriverItem] = []


class BudgetListResponse(BaseModel):
    budgets: list[BudgetDetailResponse]
    count: int
