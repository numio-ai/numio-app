"""Pydantic schemas for AWS Organizations tag policy sync and conflict endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AwsOrgTagPolicyResponse(BaseModel):
    id: uuid.UUID
    tag_key: str
    required: bool
    allowed_values: list[str] | None
    case_sensitive: bool
    source_policy_id: str | None
    source_policy_arn: str | None
    synced_at: datetime

    model_config = {"from_attributes": True}


class AwsOrgTagPolicyListResponse(BaseModel):
    policies: list[AwsOrgTagPolicyResponse]
    count: int


class OrgPolicySyncResponse(BaseModel):
    rows_upserted: int
    message: str


class ConflictDescriptor(BaseModel):
    """One schema conflict between a Numio tag-policy rule and the AWS Org policy."""

    tag_key: str
    # required_mismatch | allowed_values_diff | case_sensitivity | missing_in_numio
    conflict_type: str
    detail: str
    numio_required: bool | None = None
    aws_required: bool | None = None
    numio_allowed_values: list[str] | None = None
    aws_allowed_values: list[str] | None = None


class ConflictListResponse(BaseModel):
    conflicts: list[ConflictDescriptor]
    count: int
