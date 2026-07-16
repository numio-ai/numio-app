"""Pydantic schemas for anomaly threshold configuration."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SetThresholdRequest(BaseModel):
    window_days: int = Field(default=14, ge=7, le=90, description="Rolling window size in days")
    sigma_threshold: Decimal = Field(
        default=Decimal("3.0"),
        ge=Decimal("1.0"),
        le=Decimal("10.0"),
        description="Standard deviations for spike detection",
    )
    drift_threshold_pct: Decimal = Field(
        default=Decimal("10.0"),
        ge=Decimal("1.0"),
        le=Decimal("100.0"),
        description="Percentage increase over window to trigger drift alert",
    )


class ThresholdResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    dimension_type: str
    dimension_value: str
    window_days: int
    sigma_threshold: Decimal
    drift_threshold_pct: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThresholdWithDefault(BaseModel):
    dimension_type: str
    dimension_value: str
    window_days: int
    sigma_threshold: Decimal
    drift_threshold_pct: Decimal
    is_override: bool = Field(description="True if per-dimension override, False if global default")


class ThresholdListResponse(BaseModel):
    defaults: dict[str, ThresholdWithDefault] = Field(
        description="Global defaults per dimension type (key = dimension_type)"
    )
    overrides: list[ThresholdResponse]
