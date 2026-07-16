"""Pydantic schemas for cloud resource inventory API."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class CloudResourceResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    account_id: str
    region: str
    service: str
    resource_type: str
    resource_id: str
    arn: str | None
    name: str | None
    state: str | None
    creation_date: datetime | None
    tags: dict | None
    resource_metadata: dict | None
    first_seen_at: datetime
    last_seen_at: datetime
    terminated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    cost: float | None = None

    model_config = {"from_attributes": True}


class CloudResourceListResponse(BaseModel):
    resources: list[CloudResourceResponse]
    count: int
