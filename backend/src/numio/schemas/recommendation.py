"""Pydantic schemas for recommendations engine and savings tracking."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class RecommendationCategory(str, Enum):
    right_sizing = "right_sizing"
    zombie_cleanup = "zombie_cleanup"
    idle_shutdown = "idle_shutdown"


class RecommendationStatus(str, Enum):
    open = "open"
    accepted = "accepted"
    implemented = "implemented"
    dismissed = "dismissed"


class ConfidenceLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


# --- Request schemas ---


class AcceptRecommendationRequest(BaseModel):
    changed_by: str | None = Field(default=None, max_length=255)


class DismissRecommendationRequest(BaseModel):
    changed_by: str | None = Field(default=None, max_length=255)
    reason: str | None = None


class ImplementRecommendationRequest(BaseModel):
    changed_by: str | None = Field(default=None, max_length=255)


# --- Response schemas ---


class RecommendationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    finding_id: uuid.UUID | None
    category: str
    status: str
    confidence: str
    title: str
    description: str | None
    resource_id: str
    remediation_commands: str | None
    estimated_monthly_savings: Decimal | None
    actual_savings: Decimal | None
    savings_data_label: str | None
    accepted_at: datetime | None
    implemented_at: datetime | None
    dismissed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecommendationListResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    count: int


class SavingsByCategory(BaseModel):
    category: str
    estimated_monthly_savings: Decimal
    actual_savings: Decimal
    recommendation_count: int


class SavingsSummaryResponse(BaseModel):
    total_estimated_monthly_savings: Decimal
    total_actual_savings: Decimal
    total_implemented: int
    by_category: list[SavingsByCategory]


class SavingsTimelineEntry(BaseModel):
    date: str  # ISO date
    cumulative_savings: Decimal
    recommendation_id: uuid.UUID
    category: str
    resource_id: str


class SavingsTimelineResponse(BaseModel):
    entries: list[SavingsTimelineEntry]
