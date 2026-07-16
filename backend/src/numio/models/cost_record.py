"""CostRecord model — cost line items from CUR and other billing sources.

Wide table with JSONB overflow: first-class columns for frequently queried
dimensions, JSONB columns for dynamic/sparse data (tags, pricing, reservation, etc.).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class CostRecord(Base):
    __tablename__ = "cost_records"

    # --- Numio identity ---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    data_source: Mapped[str] = mapped_column(String(50), nullable=False)
    tenant: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    line_item_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # --- Account & time ---
    billing_period: Mapped[date] = mapped_column(Date, nullable=False)
    payer_account_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    usage_account_id: Mapped[str] = mapped_column(String(50), nullable=False)
    usage_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usage_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # --- Service & resource ---
    service: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    availability_zone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    instance_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    usage_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    operation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    line_item_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # --- Cost amounts ---
    unblended_cost: Mapped[Decimal] = mapped_column(Numeric(20, 10), nullable=False)
    blended_cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 10), nullable=True)
    net_unblended_cost: Mapped[Decimal | None] = mapped_column(Numeric(20, 10), nullable=True)
    usage_amount: Mapped[Decimal | None] = mapped_column(Numeric(20, 10), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)

    # --- JSONB overflow ---
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cost_category: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    product_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pricing: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reservation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    savings_plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    discount: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    bill_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("uq_cost_records_source_line_item", "data_source", "line_item_id", unique=True),
        Index("ix_cost_records_workspace_id", "workspace_id"),
        Index("ix_cost_records_account_period", "usage_account_id", "billing_period"),
        Index("ix_cost_records_service", "service"),
        Index("ix_cost_records_provider", "provider"),
        Index("ix_cost_records_tags", "tags", postgresql_using="gin"),
    )
