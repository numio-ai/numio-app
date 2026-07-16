"""Pydantic schemas for findings management."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class FindingType(str, Enum):
    anomaly = "anomaly"
    zombie = "zombie"
    idle = "idle"
    policy_violation = "policy_violation"
    tag_violation = "tag_violation"


class FindingSeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class FindingStatus(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"
    suppressed = "suppressed"


# --- Request schemas ---


class CreateFindingRequest(BaseModel):
    type: FindingType
    severity: FindingSeverity
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    resource_id: str = Field(..., min_length=1, max_length=500)
    detection_source: str = Field(..., min_length=1, max_length=100)
    suggested_action: str | None = None
    estimated_cost_impact: Decimal | None = None


class AcknowledgeFindingRequest(BaseModel):
    changed_by: str | None = Field(default=None, max_length=255)


class ResolveFindingRequest(BaseModel):
    changed_by: str | None = Field(default=None, max_length=255)
    reason: str | None = None


class SuppressFindingRequest(BaseModel):
    reason: str = Field(..., min_length=1)
    changed_by: str | None = Field(default=None, max_length=255)


class BulkActionRequest(BaseModel):
    finding_ids: list[uuid.UUID] = Field(..., min_length=1)
    changed_by: str | None = Field(default=None, max_length=255)


# --- Response schemas ---


class FindingTransitionResponse(BaseModel):
    id: uuid.UUID
    from_status: str
    to_status: str
    changed_by: str | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FindingResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    type: str
    severity: str
    status: str
    title: str
    description: str | None
    resource_id: str
    detection_source: str
    suggested_action: str | None
    estimated_cost_impact: Decimal | None
    suppression_reason: str | None
    detected_at: datetime
    last_seen_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FindingDetailResponse(FindingResponse):
    transitions: list[FindingTransitionResponse] = []


class FindingListResponse(BaseModel):
    findings: list[FindingResponse]
    count: int


class BulkActionResponse(BaseModel):
    updated: int
    ids: list[uuid.UUID]
