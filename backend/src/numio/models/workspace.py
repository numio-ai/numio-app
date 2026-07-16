"""Workspace model — the root scoping unit for all data."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base

DEFAULT_WORKSPACE_NAME = "default"
DEFAULT_WORKSPACE_SLUG = "default"


class Workspace(Base):
    __tablename__ = "workspaces"

    # The workspace's own ID is the workspace_id used by all other tables.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    # ExternalId for STS AssumeRole — prevents confused-deputy attacks
    external_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, server_default=func.gen_random_uuid()
    )

    # Workspace settings
    default_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    data_retention_days: Mapped[int] = mapped_column(nullable=False, default=365)

    # Andon cord — automation safety toggles
    automation_paused: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="workspace")  # noqa: F821
    automation_toggles: Mapped[list["AutomationToggle"]] = relationship(  # noqa: F821
        "AutomationToggle", back_populates="workspace", cascade="all, delete-orphan"
    )


class AutomationToggle(Base):
    """Per-domain automation toggle for the Andon cord."""

    __tablename__ = "automation_toggles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    domain: Mapped[str] = mapped_column(String(100), nullable=False)
    paused: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="automation_toggles")

    __table_args__ = (
        Index("ix_automation_toggles_workspace_domain", "workspace_id", "domain", unique=True),
    )
