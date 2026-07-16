"""CloudResource model — resource inventory from AWS service APIs."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class CloudResource(Base):
    __tablename__ = "cloud_resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[str] = mapped_column(String(12), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    service: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(512), nullable=False)
    arn: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    creation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    resource_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_cloud_resources_account_service_resource",
            "account_id",
            "service",
            "resource_id",
            unique=True,
        ),
        Index("ix_cloud_resources_workspace_id", "workspace_id"),
        Index("ix_cloud_resources_account_id", "account_id"),
        Index("ix_cloud_resources_service", "service"),
        Index("ix_cloud_resources_resource_type", "resource_type"),
        Index("ix_cloud_resources_tags", "tags", postgresql_using="gin"),
    )
