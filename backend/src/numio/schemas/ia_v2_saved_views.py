"""Pydantic schemas for IA v2 saved-views API.

Scaffold-only — no persistence yet. The frontend uses these shapes when
migrating off its local mock store; real DB-backed persistence is a follow-up.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SavedViewScope(str, Enum):
    usage = "usage"
    resources = "resources"
    tag_governance = "tag_governance"
    recommendations = "recommendations"
    autopilot = "autopilot"
    budgets = "budgets"
    policies = "policies"


class SavedViewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    owner_user_id: uuid.UUID
    scope: SavedViewScope
    name: str
    query_json: dict[str, Any] = Field(default_factory=dict)
    default_for_owner: bool = False
    shared_at_workspace: bool = False
    created_at: datetime
    updated_at: datetime


class SavedViewListResponse(BaseModel):
    views: list[SavedViewResponse]
    count: int


class CreateSavedViewRequest(BaseModel):
    scope: SavedViewScope
    name: str = Field(..., min_length=1, max_length=255)
    query_json: dict[str, Any]
    shared_at_workspace: bool = False
    default_for_owner: bool = False


class UpdateSavedViewRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    query_json: dict[str, Any] | None = None
    shared_at_workspace: bool | None = None
    default_for_owner: bool | None = None
