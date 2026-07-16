"""Audit config event model — logs configuration changes for accountability and compliance."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class AuditConfigEvent(Base):
    """A record of a significant configuration change performed in the system."""

    __tablename__ = "audit_config_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Who performed the action
    user: Mapped[str] = mapped_column(String(255), nullable=False)

    # What action was taken
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    # Affected entity
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Before/after state (for modifications)
    before_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Additional context
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_audit_config_events_workspace_id", "workspace_id"),
        Index("ix_audit_config_events_user", "user"),
        Index("ix_audit_config_events_action", "action"),
        Index("ix_audit_config_events_entity_type", "entity_type"),
        Index("ix_audit_config_events_created_at", "created_at"),
    )
