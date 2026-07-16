"""ZombieThreshold model — configurable thresholds for zombie/idle detection."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class ZombieThreshold(Base):
    """Per-workspace threshold overrides for zombie and idle resource detection.

    Each row stores a single threshold key-value pair.
    Defaults are defined in the zombie detection service.
    """

    __tablename__ = "zombie_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    threshold_key: Mapped[str] = mapped_column(String(100), nullable=False)
    threshold_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_zombie_thresholds_workspace_id", "workspace_id"),
        Index(
            "uq_zombie_thresholds_key",
            "workspace_id",
            "threshold_key",
            unique=True,
        ),
    )
