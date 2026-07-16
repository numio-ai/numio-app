"""Tag policy models — policy definitions and rules for tag governance."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from numio.models.base import Base


class TagPolicy(Base):
    __tablename__ = "tag_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    rules: Mapped[list["TagPolicyRule"]] = relationship(
        "TagPolicyRule", back_populates="policy", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_tag_policies_workspace_id", "workspace_id"),
        Index("uq_tag_policies_workspace_name", "workspace_id", "name", unique=True),
    )


class TagPolicyRule(Base):
    __tablename__ = "tag_policy_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tag_policies.id", ondelete="CASCADE"), nullable=False
    )
    tag_name: Mapped[str] = mapped_column(String(255), nullable=False)
    value_type: Mapped[str] = mapped_column(String(50), nullable=False, default="string")
    allowed_values: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    equivalence_groups: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    default_value: Mapped[str | None] = mapped_column(String(512), nullable=True)
    applicable_resource_types: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    applicable_accounts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    policy: Mapped["TagPolicy"] = relationship("TagPolicy", back_populates="rules")

    __table_args__ = (Index("ix_tag_policy_rules_policy_id", "policy_id"),)
