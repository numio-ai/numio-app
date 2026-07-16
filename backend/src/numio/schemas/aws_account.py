"""Pydantic schemas for AWS account registration and validation."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field  # noqa: I001

# ---------------------------------------------------------------------------
# Validation result schemas (step-based)
# ---------------------------------------------------------------------------


class ValidationStepResult(BaseModel):
    """Result of a single validation step."""

    name: str
    label: str
    status: Literal["pass", "fail", "skip"]
    detail: str | None = None
    error: str | None = None
    remediation: str | None = None


class ValidationResult(BaseModel):
    """Aggregated result of all validation steps."""

    steps: list[ValidationStepResult]
    overall_status: Literal["connected", "incomplete", "disconnected"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class RegisterAccountRequest(BaseModel):
    """Request body for registering a new AWS account."""

    aws_account_id: str = Field(
        ...,
        min_length=12,
        max_length=12,
        pattern=r"^\d{12}$",
        description="12-digit AWS account ID",
    )
    role_arn: str = Field(
        ...,
        min_length=1,
        max_length=2048,
        pattern=r"^arn:aws:iam::\d{12}:role/.+$",
        description="IAM role ARN for cross-account access",
    )
    tag_writer_role_arn: str | None = Field(
        default=None,
        max_length=2048,
        pattern=r"^arn:aws:iam::\d{12}:role/.+$",
        description=(
            "ARN of the NumioTagWriterRole (TagWriterRoleArn stack output). "
            "Provide to enable tag writes; verified by the tag_writer_assume_role step."
        ),
    )
    aws_access_key_id: str = Field(
        ..., min_length=1, max_length=255, description="AWS access key ID for Numio service user"
    )
    aws_secret_access_key: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="AWS secret access key for Numio service user",
    )
    external_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="ExternalId for STS AssumeRole (from trust policy)",
    )
    alias: str = Field(
        default="", max_length=255, description="Human-readable account name (optional)"
    )
    environment_label: str = Field(
        default="production",
        max_length=50,
        description="Environment label (e.g., production, staging, development)",
    )
    cur_s3_bucket: str | None = Field(
        default=None, max_length=255, description="S3 bucket containing CUR Parquet files"
    )
    cur_s3_prefix: str | None = Field(
        default=None,
        max_length=1024,
        description="S3 key prefix for CUR files (e.g., daily/MyCostExport/data)",
    )
    cur_report_name: str | None = Field(
        default=None, max_length=255, description="CUR report name as configured in AWS"
    )
    cur_managed_by_numio: bool = Field(
        default=False,
        description=(
            "True when Numio's Guided 'Create new' flow provisioned the CUR "
            "export as part of the CloudFormation stack. Drives Verify-step "
            "leniency: an empty s3_list is treated as pass-with-hint while "
            "AWS delivers the first manifest (~24 h)."
        ),
    )


class UpdateAccountRequest(BaseModel):
    """Request body for updating any account field."""

    alias: str | None = Field(default=None, max_length=255)
    environment_label: str | None = Field(default=None, max_length=50)
    role_arn: str | None = Field(
        default=None,
        max_length=2048,
        pattern=r"^arn:aws:iam::\d{12}:role/.+$",
    )
    tag_writer_role_arn: str | None = Field(
        default=None,
        max_length=2048,
        pattern=r"^arn:aws:iam::\d{12}:role/.+$",
    )
    aws_access_key_id: str | None = Field(default=None, max_length=255)
    aws_secret_access_key: str | None = Field(default=None, max_length=255)
    external_id: str | None = Field(default=None, max_length=255)
    cur_s3_bucket: str | None = Field(default=None, max_length=255)
    cur_s3_prefix: str | None = Field(default=None, max_length=1024)
    cur_report_name: str | None = Field(default=None, max_length=255)
    cur_managed_by_numio: bool | None = Field(default=None)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AccountResponse(BaseModel):
    """Response schema for a single AWS account. Credentials are redacted."""

    id: uuid.UUID
    workspace_id: str
    aws_account_id: str
    alias: str
    role_arn: str
    tag_writer_role_arn: str | None = None
    aws_access_key_id_hint: str | None = Field(
        default=None, description="Last 4 chars of access key ID (redacted)"
    )
    external_id: str | None
    status: str
    environment_label: str
    status_message: str | None
    cur_s3_bucket: str | None
    cur_s3_prefix: str | None
    cur_report_name: str | None
    cur_managed_by_numio: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountListResponse(BaseModel):
    """Response schema for listing AWS accounts."""

    accounts: list[AccountResponse]
    count: int


class AccountRegistrationResponse(BaseModel):
    """Response for registration, edit, and re-validate — account data + validation results."""

    account: AccountResponse
    validation: ValidationResult
