"""Pydantic schemas for infrastructure policy engine."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

# --- Enums ---


class PolicyType(str, Enum):
    instance_restriction = "instance_restriction"
    spending_limit = "spending_limit"
    resource_count_limit = "resource_count_limit"
    environment_constraint = "environment_constraint"


class PolicySeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


# --- Rule schemas (validated in application layer) ---


class InstanceRestrictionRule(BaseModel):
    """Rule: deny or allow specific instance types."""

    denied_instance_types: list[str] = Field(default_factory=list)
    allowed_instance_types: list[str] = Field(default_factory=list)


class SpendingLimitRule(BaseModel):
    """Rule: spending threshold per cost dimension."""

    dimension: str = Field(..., min_length=1, max_length=100)
    dimension_value: str = Field(..., min_length=1, max_length=255)
    limit_amount: Decimal = Field(..., gt=0)
    period: str = Field(default="monthly")  # monthly | quarterly


class ResourceCountLimitRule(BaseModel):
    """Rule: max resource count for a service/type."""

    service: str = Field(..., min_length=1, max_length=50)
    resource_type: str = Field(..., min_length=1, max_length=100)
    max_count: int = Field(..., gt=0)


class EnvironmentConstraintRule(BaseModel):
    """Rule: resources must be in allowed regions."""

    allowed_regions: list[str] = Field(..., min_length=1)


# --- Applicability filter ---


class PolicyApplicability(BaseModel):
    """Filter defining which resources a policy applies to."""

    accounts: list[str] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)
    resource_types: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)


# --- Request schemas ---


class CreateInfraPolicyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    type: PolicyType
    severity: PolicySeverity
    rule: dict = Field(..., description="Type-specific rule configuration")
    applicability: PolicyApplicability = Field(default_factory=PolicyApplicability)
    is_guardrail: bool = False
    is_active: bool = True


class UpdateInfraPolicyRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    severity: PolicySeverity | None = None
    rule: dict | None = None
    applicability: PolicyApplicability | None = None
    is_guardrail: bool | None = None
    is_active: bool | None = None


# --- Response schemas ---


class InfraPolicyResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    name: str
    description: str | None
    type: str
    severity: str
    rule: dict
    applicability: dict
    is_guardrail: bool
    is_active: bool
    compliance_percentage: Decimal | None
    last_evaluated_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InfraPolicyDetailResponse(InfraPolicyResponse):
    """Policy with current violations from findings."""

    violations: list[dict] = []


class InfraPolicyListResponse(BaseModel):
    policies: list[InfraPolicyResponse]
    count: int
