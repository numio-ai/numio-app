"""Pydantic schemas for IA v2 Policies."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PolicyMode(str, Enum):
    block = "block"
    warn = "warn"
    auto = "auto"


class PolicyType(str, Enum):
    tag_governance = "Tag governance"
    ci_guard = "CI guard"
    placement = "Placement"
    approval = "Approval"
    lifecycle = "Lifecycle"
    security = "Security"
    ai_governance = "AI governance"


class Policy(BaseModel):
    id: str
    workspace_id: uuid.UUID
    name: str
    description: str | None = None
    type: PolicyType
    mode: PolicyMode
    enabled: bool
    scope: str | None = None
    violations: int = 0
    last_changed: datetime


class PolicyListResponse(BaseModel):
    policies: list[Policy]
    total_count: int
    open_violations_total: int


class CreatePolicyRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str | None = None
    type: PolicyType
    mode: PolicyMode = PolicyMode.warn
    scope: str | None = None
    enabled: bool = True


class UpdatePolicyRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    mode: PolicyMode | None = None
    scope: str | None = None
    enabled: bool | None = None


class BulkPolicyAction(str, Enum):
    enable = "enable"
    disable = "disable"
    change_mode = "change_mode"


class BulkPolicyRequest(BaseModel):
    action: BulkPolicyAction
    policy_ids: list[str] = Field(..., min_length=1, max_length=500)
    target_mode: PolicyMode | None = None


class BulkPolicyResponse(BaseModel):
    action: BulkPolicyAction
    accepted: int
    rejected: int
    errors: list[str] = Field(default_factory=list)
