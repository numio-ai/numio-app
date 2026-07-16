"""Budget model — budget definition with attribution dimension scoping and alert thresholds."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class Budget(Base):
    """A budget scoped to an attribution dimension (team, project, account, service)."""

    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Budget definition
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default="USD")
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # monthly | quarterly

    # Attribution scope
    # team | project | account | service
    dimension: Mapped[str] = mapped_column(String(100), nullable=False)
    dimension_value: Mapped[str] = mapped_column(String(255), nullable=False)

    # Alert configuration — list of threshold percentages, e.g. [50, 80, 100]
    alert_thresholds: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default="[50, 80, 100]"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_budgets_workspace_id", "workspace_id"),
        Index(
            "uq_budgets_workspace_name",
            "workspace_id",
            "name",
            unique=True,
        ),
        Index("ix_budgets_dimension", "workspace_id", "dimension"),
    )
