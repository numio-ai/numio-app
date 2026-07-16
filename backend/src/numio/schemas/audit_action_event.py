"""Pydantic schemas for audit action events (parent + child items)."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditActionEventItemResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    target_type: str
    target_id: str
    change_key: str
    before_value: str | None
    after_value: str | None
    status: str
    error_code: str | None
    error_message: str | None
    aws_request_id: str | None
    attempted_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class AuditActionEventResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    actor: str
    operation_type: str
    status: str
    rationale: str | None
    summary: dict | None
    requested_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class AuditActionEventListResponse(BaseModel):
    events: list[AuditActionEventResponse]
    count: int


class AuditActionEventDetailResponse(AuditActionEventResponse):
    items: list[AuditActionEventItemResponse]
