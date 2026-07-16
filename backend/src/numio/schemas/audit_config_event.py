"""Pydantic schemas for audit trail."""

import uuid
from datetime import datetime

from pydantic import BaseModel

# --- Response schemas ---


class AuditConfigEventResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    user: str
    action: str
    entity_type: str
    entity_id: str | None
    before_value: dict | None
    after_value: dict | None
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditConfigEventListResponse(BaseModel):
    events: list[AuditConfigEventResponse]
    count: int
