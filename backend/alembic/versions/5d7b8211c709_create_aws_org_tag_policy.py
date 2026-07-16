"""create aws_org_tag_policy

Revision ID: 5d7b8211c709
Revises: 983dae207764
Create Date: 2026-05-26 00:11:32.761005

Part of feature tag_management (spec §5.4). Effective AWS Organizations tag
policy for the workspace's management account — one row per (workspace, tag_key).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5d7b8211c709'
down_revision: Union[str, Sequence[str], None] = '983dae207764'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "aws_org_tag_policy",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.String(length=255), nullable=False),
        sa.Column("tag_key", sa.String(length=255), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allowed_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("case_sensitive", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source_policy_id", sa.String(length=255), nullable=True),
        sa.Column("source_policy_arn", sa.String(length=2048), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_aws_org_tag_policy_workspace_id", "aws_org_tag_policy", ["workspace_id"]
    )
    op.create_index(
        "uq_aws_org_tag_policy_workspace_tag_key",
        "aws_org_tag_policy",
        ["workspace_id", "tag_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_aws_org_tag_policy_workspace_tag_key", table_name="aws_org_tag_policy"
    )
    op.drop_index("ix_aws_org_tag_policy_workspace_id", table_name="aws_org_tag_policy")
    op.drop_table("aws_org_tag_policy")
