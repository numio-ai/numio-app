"""Pydantic schemas for tag policy and compliance API endpoints."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class ValueType(str, Enum):
    string = "string"
    numeric = "numeric"
    enum = "enum"
    email = "email"
    date = "date"


class ComplianceStatus(str, Enum):
    compliant = "compliant"
    missing_tag = "missing_tag"
    invalid_value = "invalid_value"
    drift = "drift"


# --- Tag Policy Rules ---


class TagPolicyRuleCreate(BaseModel):
    tag_name: str = Field(..., min_length=1, max_length=255)
    value_type: ValueType = Field(default=ValueType.string)
    allowed_values: list[str] | None = Field(default=None, description="For enum type")
    equivalence_groups: list[list[str]] | None = Field(
        default=None,
        description="Value equivalence groups; first entry in each group is canonical, "
        "others are flagged as drift",
    )
    default_value: str | None = Field(default=None, max_length=512)
    applicable_resource_types: list[str] | None = Field(
        default=None, description="Resource types this rule applies to (null = all)"
    )
    applicable_accounts: list[str] | None = Field(
        default=None, description="Account IDs this rule applies to (null = all)"
    )


class TagPolicyRuleResponse(BaseModel):
    id: uuid.UUID
    tag_name: str
    value_type: str
    allowed_values: list[str] | None
    equivalence_groups: list[list[str]] | None
    default_value: str | None
    applicable_resource_types: list[str] | None
    applicable_accounts: list[str] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Tag Policies ---


class TagPolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None)
    priority: int | None = Field(default=None)
    is_active: bool = Field(default=True)
    rules: list[TagPolicyRuleCreate] = Field(..., min_length=1)


class TagPolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: int | None = None
    is_active: bool | None = None
    rules: list[TagPolicyRuleCreate] | None = Field(
        default=None, description="If provided, replaces all existing rules"
    )


class TagPolicyResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    name: str
    description: str | None
    priority: int | None
    is_active: bool
    created_by: str | None
    updated_by: str | None
    created_at: datetime
    updated_at: datetime
    rules: list[TagPolicyRuleResponse]

    model_config = {"from_attributes": True}


class TagPolicyListResponse(BaseModel):
    policies: list[TagPolicyResponse]
    count: int


# --- Compliance Results ---


class ComplianceResultResponse(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    policy_id: uuid.UUID
    rule_id: uuid.UUID
    status: str
    current_value: str | None
    resource_cost: Decimal

    # Joined resource fields
    resource_arn: str | None = None
    resource_name: str | None = None
    resource_type: str | None = None
    account_id: str | None = None
    service: str | None = None
    tag_name: str | None = None
    policy_name: str | None = None

    model_config = {"from_attributes": True}


class NonCompliantListResponse(BaseModel):
    results: list[ComplianceResultResponse]
    count: int
    total_non_compliant_cost: Decimal


# --- Compliance Summary ---


class ComplianceDimensionScore(BaseModel):
    dimension: str
    dimension_value: str | None
    cost_weighted_score: Decimal
    total_cost: Decimal
    compliant_cost: Decimal
    total_resources: int
    compliant_resources: int

    model_config = {"from_attributes": True}


class ComplianceSummaryResponse(BaseModel):
    overall: ComplianceDimensionScore | None
    untagged_spend: Decimal
    total_resources: int
    compliant_resources: int
    non_compliant_resources: int


class ComplianceByDimensionResponse(BaseModel):
    dimension: str
    scores: list[ComplianceDimensionScore]


# --- Compliance Trend ---


class ComplianceTrendPoint(BaseModel):
    snapshot_date: datetime
    audit_run_id: uuid.UUID
    cost_weighted_score: Decimal
    total_cost: Decimal
    compliant_cost: Decimal
    total_resources: int
    compliant_resources: int

    model_config = {"from_attributes": True}


class ComplianceTrendResponse(BaseModel):
    dimension: str
    dimension_value: str | None
    trend: list[ComplianceTrendPoint]


# --- Audit Trigger ---


class AuditTriggerResponse(BaseModel):
    job_run_id: uuid.UUID
    status: str
    message: str
