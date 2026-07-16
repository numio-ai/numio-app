"""Pydantic schemas for IA v2 recommendations evidence + rescan."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    low = "low"
    med = "med"
    high = "high"


class EvidenceAffectedSample(BaseModel):
    name: str
    svc: str
    type: str | None = None
    spend: Decimal
    idle: str | None = None


class EvidenceRisk(BaseModel):
    level: RiskLevel
    text: str


class EvidenceManualRemediation(BaseModel):
    note: str
    cmd: str


class RecommendationEvidence(BaseModel):
    recommendation_id: str
    signals: list[str]
    sample: list[EvidenceAffectedSample]
    affected_count: int
    remaining_count: int
    remaining_spend: Decimal
    what_happens: list[str]
    exclusions: str
    risk: EvidenceRisk
    manual_remediation: EvidenceManualRemediation | None = None
    generated_at: datetime


class RescanRequest(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=128)
    scope: str | None = None


class RescanResponse(BaseModel):
    job_id: str
    started_at: datetime
    deduped: bool = False
