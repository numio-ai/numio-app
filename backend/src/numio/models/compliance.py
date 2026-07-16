"""Compliance models — audit results and trend snapshots."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class ComplianceResult(Base):
    """Per-resource, per-rule compliance evaluation for a single audit run."""

    __tablename__ = "compliance_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    audit_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_runs.id", ondelete="CASCADE"), nullable=False
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=False
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tag_policies.id", ondelete="CASCADE"), nullable=False
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tag_policy_rules.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    current_value: Mapped[str | None] = mapped_column(String(512), nullable=True)
    resource_cost: Mapped[Decimal] = mapped_column(Numeric(20, 10), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_compliance_results_workspace_id", "workspace_id"),
        Index("ix_compliance_results_audit_run_id", "audit_run_id"),
        Index("ix_compliance_results_resource_id", "resource_id"),
        Index("ix_compliance_results_policy_id", "policy_id"),
        Index("ix_compliance_results_status", "status"),
    )


class ComplianceSnapshot(Base):
    """Aggregate compliance scores per audit run, stored for trend tracking."""

    __tablename__ = "compliance_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    audit_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_runs.id", ondelete="CASCADE"), nullable=False
    )
    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    dimension_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_weighted_score: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(20, 10), nullable=False, default=0)
    compliant_cost: Mapped[Decimal] = mapped_column(Numeric(20, 10), nullable=False, default=0)
    total_resources: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    compliant_resources: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_compliance_snapshots_workspace_id", "workspace_id"),
        Index("ix_compliance_snapshots_audit_run_id", "audit_run_id"),
        Index("ix_compliance_snapshots_dimension", "dimension"),
        Index("ix_compliance_snapshots_snapshot_date", "snapshot_date"),
    )
