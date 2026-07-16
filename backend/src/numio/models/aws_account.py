"""AwsAccount model — registered AWS accounts scoped to a workspace."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base


class AwsAccount(Base):
    __tablename__ = "aws_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    aws_account_id: Mapped[str] = mapped_column(String(12), nullable=False)
    alias: Mapped[str] = mapped_column(String(255), nullable=False)
    role_arn: Mapped[str] = mapped_column(String(2048), nullable=False)
    # ARN of NumioTagWriterRole. Non-null only after the verify step's
    # tag_writer_assume_role check passes — doubles as the "tag writes enabled"
    # flag for this account. Null = tag writes disabled.
    tag_writer_role_arn: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # Per-account credentials for Numio service user
    aws_access_key_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aws_secret_access_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Connection status: connected, incomplete, disconnected, inactive
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="disconnected")
    environment_label: Mapped[str] = mapped_column(String(50), nullable=False, default="production")
    status_message: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # CUR S3 configuration — optional, set when customer configures CUR export
    cur_s3_bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cur_s3_prefix: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cur_report_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # True when Numio provisioned the CUR export (Guided "Create new" mode).
    # The verify-step relaxes its s3_list-empty semantics for these accounts so
    # the wizard does not block while AWS delivers the first manifest (~24 h).
    cur_managed_by_numio: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_workspace_aws_account",
            "workspace_id",
            "aws_account_id",
            unique=True,
        ),
    )
