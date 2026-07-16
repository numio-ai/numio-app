"""AWS Organizations tag policy model — effective policy for the management account."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class AwsOrgTagPolicy(Base):
    """One row per (workspace, tag_key) from the effective AWS Org tag policy."""

    __tablename__ = "aws_org_tag_policy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    tag_key: Mapped[str] = mapped_column(String(255), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_values: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    case_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source_policy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_policy_arn: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_aws_org_tag_policy_workspace_id", "workspace_id"),
        Index(
            "uq_aws_org_tag_policy_workspace_tag_key",
            "workspace_id",
            "tag_key",
            unique=True,
        ),
    )
