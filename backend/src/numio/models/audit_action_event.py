"""Audit action event models — one parent row per operation Numio performs against an
external system (first consumer: tag writes), with one child item per leaf change."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base


class AuditActionEvent(Base):
    """One logical operation against an external system (e.g. an AWS tag apply)."""

    __tablename__ = "audit_action_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    operation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["AuditActionEventItem"]] = relationship(
        "AuditActionEventItem", back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_audit_action_events_workspace_requested", "workspace_id", "requested_at"),
        Index(
            "ix_audit_action_events_workspace_optype_requested",
            "workspace_id",
            "operation_type",
            "requested_at",
        ),
    )


class AuditActionEventItem(Base):
    """One leaf change inside an action event (e.g. one tag key on one resource)."""

    __tablename__ = "audit_action_event_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("audit_action_events.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(1024), nullable=False)
    change_key: Mapped[str] = mapped_column(String(255), nullable=False)
    before_value: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    after_value: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    aws_request_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["AuditActionEvent"] = relationship("AuditActionEvent", back_populates="items")

    __table_args__ = (
        Index("ix_audit_action_event_items_event_id", "event_id"),
        Index("ix_audit_action_event_items_target_attempted", "target_id", "attempted_at"),
    )
