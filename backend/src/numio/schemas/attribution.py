"""Pydantic schemas for cost attribution rules and cost views API."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class SourceType(str, Enum):
    tag = "tag"
    account = "account"


class Granularity(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class TrendPeriod(str, Enum):
    day = "day"
    week = "week"
    month = "month"


# --- Attribution Rule Schemas ---


class TagMappingConfig(BaseModel):
    tag_key: str = Field(..., min_length=1, description="Tag key to map to the dimension value")


class AccountMappingConfig(BaseModel):
    account_ids: list[str] = Field(..., min_length=1, description="AWS account IDs to match")
    dimension_value: str = Field(
        ..., min_length=1, description="Dimension value to assign to matched accounts"
    )


class AttributionRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    dimension: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Business dimension (e.g., team, project, environment)",
    )
    source_type: SourceType
    priority: int = Field(
        default=0,
        ge=0,
        description="Priority for same-dimension rules (lower wins)",
    )
    mapping_config: dict = Field(
        ...,
        description=(
            "Tag config: {tag_key: str}. Account config: {account_ids: [...], dimension_value: str}"
        ),
    )


class AttributionRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    dimension: str | None = Field(default=None, min_length=1, max_length=100)
    source_type: SourceType | None = None
    priority: int | None = Field(default=None, ge=0)
    mapping_config: dict | None = None


class AttributionRuleResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    name: str
    dimension: str
    source_type: str
    priority: int
    mapping_config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AttributionRuleListResponse(BaseModel):
    rules: list[AttributionRuleResponse]
    count: int


# --- Cost Views Schemas ---


class CostViewMetadata(BaseModel):
    start_date: date
    end_date: date
    account: str | None = None
    dimension: str | None = None
    filters: dict | None = None


class TotalCostResponse(BaseModel):
    metadata: CostViewMetadata
    total: Decimal
    currency: str = "USD"
    data: list["CostTimeBucket"]


class CostTimeBucket(BaseModel):
    start: date
    end: date
    amount: Decimal
    currency: str = "USD"


class DimensionCostItem(BaseModel):
    dimension_value: str
    amount: Decimal
    currency: str = "USD"
    percentage: Decimal = Field(description="Percentage of total spend")


class CostByDimensionResponse(BaseModel):
    metadata: CostViewMetadata
    total: Decimal
    currency: str = "USD"
    data: list[DimensionCostItem]


class DimensionTimeSeries(BaseModel):
    dimension_value: str
    data: list[CostTimeBucket]


class CostTimeSeriesResponse(BaseModel):
    metadata: CostViewMetadata
    granularity: str
    total: Decimal
    currency: str = "USD"
    data: list[CostTimeBucket]
    by_dimension: list[DimensionTimeSeries] | None = None


# --- Trend Analysis Schemas ---


class TrendItem(BaseModel):
    dimension_value: str
    current_amount: Decimal
    previous_amount: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None = Field(
        description="Percentage change (null if previous was zero)"
    )
    currency: str = "USD"


class TrendResponse(BaseModel):
    metadata: CostViewMetadata
    period: str
    current_period_start: date
    current_period_end: date
    previous_period_start: date
    previous_period_end: date
    data: list[TrendItem]


class SignificantChangeItem(BaseModel):
    dimension_value: str
    current_amount: Decimal
    previous_amount: Decimal
    absolute_change: Decimal
    percentage_change: Decimal
    currency: str = "USD"


class SignificantChangesResponse(BaseModel):
    metadata: CostViewMetadata
    period: str
    percentage_threshold: Decimal
    absolute_threshold: Decimal
    data: list[SignificantChangeItem]
