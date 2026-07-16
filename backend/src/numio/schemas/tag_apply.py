"""Pydantic schemas for the tag apply / preview endpoints."""

import uuid

from pydantic import BaseModel, Field


class TagApplyChange(BaseModel):
    resource_id: uuid.UUID
    tag_key: str = Field(min_length=1, max_length=255)
    # None = remove the tag. An empty string is rejected at the endpoint.
    value: str | None = None


class TagApplyPreviewRequest(BaseModel):
    changes: list[TagApplyChange] = Field(min_length=1)


class TagApplyRequest(TagApplyPreviewRequest):
    rationale: str | None = None
    confirm_risky: bool = False


class AffectedResource(BaseModel):
    resource_id: uuid.UUID
    arn: str | None
    name: str | None
    env: str | None
    monthly_cost: float


class TagApplyPreviewResponse(BaseModel):
    risky: bool
    reasons: list[str]
    affected_resources: list[AffectedResource]


class TagApplyResultResponse(BaseModel):
    event_id: uuid.UUID
    status: str
    summary: dict
