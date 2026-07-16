"""Recommendation model — actionable cost-optimization suggestions from findings."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base


class Recommendation(Base):
    """A cost-optimization recommendation generated from a finding."""

    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Link to source finding (one recommendation per finding)
    finding_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )

    # Classification
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")
    confidence: Mapped[str] = mapped_column(String(20), nullable=False, server_default="medium")

    # Details
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_id: Mapped[str] = mapped_column(String(500), nullable=False)
    remediation_commands: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Savings
    estimated_monthly_savings: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 10), nullable=True
    )
    actual_savings: Mapped[Decimal | None] = mapped_column(Numeric(20, 10), nullable=True)
    savings_data_label: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Lifecycle timestamps
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    implemented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    finding: Mapped["Finding | None"] = relationship(lazy="select")  # noqa: F821

    __table_args__ = (
        Index("ix_recommendations_workspace_id", "workspace_id"),
        Index("ix_recommendations_category", "category"),
        Index("ix_recommendations_status", "status"),
        Index(
            "uq_recommendations_finding",
            "workspace_id",
            "finding_id",
            unique=True,
        ),
    )
