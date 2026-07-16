"""Pydantic schemas for remediation campaign API endpoints."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# --- Filter criteria for resource selection ---


class ResourceFilter(BaseModel):
    """Filter criteria to resolve non-compliant resources."""

    tag_name: str | None = Field(default=None, description="Filter by missing/invalid tag name")
    account_id: str | None = Field(default=None, description="Filter by AWS account ID")
    policy_id: uuid.UUID | None = Field(default=None, description="Filter by tag policy ID")
    status: str | None = Field(
        default=None,
        description="Compliance status: missing_tag or invalid_value",
    )


# --- Campaign creation ---


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    deadline: datetime | None = None
    target_compliance_goal: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Target % of resources in fixed status",
    )
    resource_ids: list[uuid.UUID] | None = Field(
        default=None, description="Explicit resource IDs to include"
    )
    filters: ResourceFilter | None = Field(
        default=None, description="Filter criteria to resolve resources"
    )


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    deadline: datetime | None = None
    target_compliance_goal: Decimal | None = Field(default=None, ge=0, le=100)
    status: str | None = Field(default=None, description="active, completed, or archived")


# --- Resource status update ---


class ResourceStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="New status: notified, fixed, escalated, excluded",
    )


# --- Response schemas ---


class CampaignResourceResponse(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    remediation_status: str
    inferred_owner: str | None
    violated_rules: dict | None
    tag_commands: list | None
    resource_cost: Decimal
    status_updated_at: datetime | None
    created_at: datetime

    # Joined resource fields
    resource_name: str | None = None
    resource_arn: str | None = None
    resource_type: str | None = None
    account_id: str | None = None
    service: str | None = None

    model_config = {"from_attributes": True}


class CampaignResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    name: str
    description: str | None
    deadline: datetime | None
    target_compliance_goal: Decimal | None
    status: str
    before_compliance_score: Decimal | None
    resource_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CampaignDetailResponse(CampaignResponse):
    resources: list[CampaignResourceResponse]


class CampaignListResponse(BaseModel):
    campaigns: list[CampaignResponse]
    count: int


# --- Progress metrics ---


class StatusCount(BaseModel):
    status: str
    count: int
    percentage: Decimal


class CampaignProgressResponse(BaseModel):
    campaign_id: uuid.UUID
    total_resources: int
    status_breakdown: list[StatusCount]
    before_compliance_score: Decimal | None
    current_compliance_score: Decimal | None


# --- CLI commands ---


class TagCommandResponse(BaseModel):
    resource_id: uuid.UUID
    resource_arn: str | None
    resource_type: str | None
    commands: list[str]
