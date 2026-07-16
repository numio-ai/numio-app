"""AnomalyThreshold model — per-dimension detection thresholds for anomaly detection."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class AnomalyThreshold(Base):
    """Per-dimension threshold overrides for anomaly detection.

    Global defaults apply when no per-dimension override exists.
    A row with dimension_value='*' represents the default for that dimension_type.
    """

    __tablename__ = "anomaly_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Dimension identification
    dimension_type: Mapped[str] = mapped_column(String(100), nullable=False)
    dimension_value: Mapped[str] = mapped_column(String(500), nullable=False)

    # Detection parameters
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    sigma_threshold: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("3.0")
    )
    drift_threshold_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("10.0")
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_anomaly_thresholds_workspace_id", "workspace_id"),
        Index(
            "uq_anomaly_thresholds_dim",
            "workspace_id",
            "dimension_type",
            "dimension_value",
            unique=True,
        ),
    )
