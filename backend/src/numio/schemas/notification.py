"""Pydantic schemas for notifications and notification preferences."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class NotificationEventType(str, Enum):
    budget_alert = "budget_alert"
    anomaly_detected = "anomaly_detected"
    zombie_found = "zombie_found"
    policy_violation = "policy_violation"
    recommendation_generated = "recommendation_generated"


# --- Request schemas ---


class UpdatePreferenceRequest(BaseModel):
    event_type: NotificationEventType
    enabled: bool


class UpdatePreferencesRequest(BaseModel):
    preferences: list[UpdatePreferenceRequest] = Field(..., min_length=1)


# --- Response schemas ---


class NotificationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    event_type: str
    title: str
    message: str | None
    entity_type: str | None
    entity_id: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    count: int


class UnreadCountResponse(BaseModel):
    count: int


class NotificationPreferenceResponse(BaseModel):
    event_type: str
    enabled: bool

    model_config = {"from_attributes": True}


class PreferencesResponse(BaseModel):
    preferences: list[NotificationPreferenceResponse]
