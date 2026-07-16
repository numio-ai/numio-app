"""FindingAck model — records per-finding acknowledgements for the IA v2 Inbox."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class FindingAck(Base):
    """A workspace-wide ack of a finding.

    Uniqueness is ``(workspace_id, finding_id)`` — any user in the workspace
    can ack on behalf of the workspace; re-acks are idempotent. ``user_id``
    is recorded for audit only and is nullable so user deletion does not
    cascade-destroy the ack history.
    """

    __tablename__ = "finding_acks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # String(255) to match findings.workspace_id (predates UUID convention §4);
    # keeps LEFT JOIN findings ↔ finding_acks cast-free.
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("findings.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_finding_acks_workspace_id", "workspace_id"),
        Index(
            "uq_finding_acks_workspace_finding",
            "workspace_id",
            "finding_id",
            unique=True,
        ),
    )
