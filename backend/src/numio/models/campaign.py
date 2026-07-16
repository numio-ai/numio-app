"""Remediation campaign models — campaigns and per-resource tracking."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base


class RemediationCampaign(Base):
    __tablename__ = "remediation_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_compliance_goal: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    before_compliance_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    resource_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    resources: Mapped[list["CampaignResource"]] = relationship(
        "CampaignResource",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_remediation_campaigns_workspace_id", "workspace_id"),
        Index("ix_remediation_campaigns_status", "status"),
    )


class CampaignResource(Base):
    __tablename__ = "campaign_resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("remediation_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cloud_resources.id", ondelete="CASCADE"),
        nullable=False,
    )
    remediation_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    inferred_owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    violated_rules: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tag_commands: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    resource_cost: Mapped[Decimal] = mapped_column(Numeric(20, 10), nullable=False, default=0)
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    campaign: Mapped["RemediationCampaign"] = relationship(
        "RemediationCampaign", back_populates="resources"
    )

    __table_args__ = (
        Index("ix_campaign_resources_campaign_id", "campaign_id"),
        Index("ix_campaign_resources_resource_id", "resource_id"),
        Index("ix_campaign_resources_status", "remediation_status"),
        Index(
            "uq_campaign_resources_campaign_resource",
            "campaign_id",
            "resource_id",
            unique=True,
        ),
    )
