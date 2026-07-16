"""Findings models — unified lifecycle for anomaly, zombie, idle, and policy findings."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base


class Finding(Base):
    """A finding produced by a detection job (anomaly, zombie, idle, policy, tag)."""

    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Classification
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")

    # Details
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_id: Mapped[str] = mapped_column(String(500), nullable=False)
    detection_source: Mapped[str] = mapped_column(String(100), nullable=False)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_cost_impact: Mapped[Decimal | None] = mapped_column(Numeric(20, 10), nullable=True)

    # Suppression
    suppression_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    transitions: Mapped[list["FindingTransition"]] = relationship(
        back_populates="finding",
        cascade="all, delete-orphan",
        order_by="FindingTransition.created_at",
    )

    __table_args__ = (
        Index("ix_findings_workspace_id", "workspace_id"),
        Index("ix_findings_type", "type"),
        Index("ix_findings_severity", "severity"),
        Index("ix_findings_status", "status"),
        Index("ix_findings_detection_source", "detection_source"),
        Index(
            "uq_findings_dedup",
            "workspace_id",
            "type",
            "resource_id",
            "detection_source",
            unique=True,
        ),
    )


class FindingTransition(Base):
    """Records each state transition on a finding."""

    __tablename__ = "finding_transitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False
    )
    from_status: Mapped[str] = mapped_column(String(20), nullable=False)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    finding: Mapped["Finding"] = relationship(back_populates="transitions")

    __table_args__ = (Index("ix_finding_transitions_finding_id", "finding_id"),)
