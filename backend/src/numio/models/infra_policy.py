"""Infrastructure policy model — policy definitions for resource and cost governance."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class InfraPolicy(Base):
    """An infrastructure policy evaluated against resources and costs."""

    __tablename__ = "infra_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Definition
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)

    # Rule configuration — schema depends on type
    rule: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # Applicability filter — which accounts, services, resource_types, regions
    applicability: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    # Flags
    is_guardrail: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Evaluation state
    compliance_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    last_evaluated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_infra_policies_workspace_id", "workspace_id"),
        Index("uq_infra_policies_workspace_name", "workspace_id", "name", unique=True),
        Index("ix_infra_policies_type", "workspace_id", "type"),
        Index("ix_infra_policies_is_guardrail", "workspace_id", "is_guardrail"),
    )
