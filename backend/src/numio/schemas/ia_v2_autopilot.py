"""Pydantic schemas for IA v2 Autopilot rules, history, dry-run, pause-all."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RuleState(str, Enum):
    active = "active"
    paused = "paused"


class HistoryOutcome(str, Enum):
    stopped = "stopped"
    blocked = "blocked"
    deleted = "deleted"
    resumed = "resumed"
    resized = "resized"
    advised = "advised"


class UndoState(str, Enum):
    within = "within"
    auto = "auto"
    advisory = "advisory"
    expired = "expired"


class AutopilotRule(BaseModel):
    id: str
    workspace_id: uuid.UUID
    name: str
    description: str | None = None
    schedule: str | None = None
    state: RuleState
    archived: bool = False
    runs_7d: int = 0
    saved_7d: Decimal = Decimal("0")
    last_run: str | None = None
    dsl: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AutopilotRuleListResponse(BaseModel):
    rules: list[AutopilotRule]
    total_count: int


class CreateAutopilotRuleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    schedule: str | None = None
    dsl: list[dict[str, Any]] = Field(default_factory=list)
    dry_run: bool = True


class UpdateAutopilotRuleRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    schedule: str | None = None
    dsl: list[dict[str, Any]] | None = None
    state: RuleState | None = None


class AutopilotAction(BaseModel):
    id: str
    when_: datetime = Field(..., alias="when")
    rule_id: str
    rule: str
    target: str
    outcome: HistoryOutcome
    saved: Decimal = Decimal("0")
    undo_state: UndoState
    undo_label: str | None = None


class AutopilotHistoryResponse(BaseModel):
    actions: list[AutopilotAction]
    next_cursor: str | None = None
    total_count: int


class PauseAllRequest(BaseModel):
    reason: str | None = None


class PauseAllResponse(BaseModel):
    paused_all: bool
    affected_rule_count: int
    paused_at: datetime | None = None


class DryRunResponse(BaseModel):
    rule_id: str
    would_act_on: list[str]
    would_save: Decimal
    safety_warnings: list[str]
