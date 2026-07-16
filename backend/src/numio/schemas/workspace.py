"""Workspace settings and automation toggle schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Workspace settings
# ---------------------------------------------------------------------------


class WorkspaceSettingsResponse(BaseModel):
    """Current workspace settings."""

    id: uuid.UUID
    name: str
    slug: str
    default_currency: str
    timezone: str
    data_retention_days: int
    automation_paused: bool
    created_at: datetime
    updated_at: datetime


class WorkspaceInfoResponse(BaseModel):
    """Workspace identity info for IAM setup."""

    external_id: uuid.UUID


class UpdateWorkspaceSettingsRequest(BaseModel):
    """Partial update for workspace settings."""

    name: str | None = None
    default_currency: str | None = Field(None, max_length=10)
    timezone: str | None = Field(None, max_length=64)
    data_retention_days: int | None = Field(None, ge=30, le=3650)


# ---------------------------------------------------------------------------
# Automation toggles (Andon cord)
# ---------------------------------------------------------------------------


class AutomationStatusResponse(BaseModel):
    """Current automation status: global flag + per-domain toggles."""

    automation_paused: bool
    domain_toggles: list["DomainToggleResponse"]


class DomainToggleResponse(BaseModel):
    """Single domain automation toggle."""

    domain: str
    paused: bool


class SetGlobalToggleRequest(BaseModel):
    """Toggle global automation pause."""

    paused: bool


class SetDomainToggleRequest(BaseModel):
    """Toggle automation for a specific domain."""

    domain: str
    paused: bool
