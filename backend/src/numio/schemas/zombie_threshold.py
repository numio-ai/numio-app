"""Pydantic schemas for zombie/idle detection threshold configuration."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SetZombieThresholdRequest(BaseModel):
    value: Decimal = Field(..., gt=Decimal("0"), description="Threshold value")


class ZombieThresholdResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    threshold_key: str
    threshold_value: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ZombieThresholdEntry(BaseModel):
    key: str
    value: Decimal
    is_override: bool = Field(description="True if overridden from default, False if default")


class ZombieThresholdListResponse(BaseModel):
    thresholds: list[ZombieThresholdEntry]
