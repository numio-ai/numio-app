"""add aws_accounts.tag_writer_role_arn

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-25

Part of feature tag_management (spec §5.5). Per-account ARN of the optional
NumioTagWriterRole. Null = tag writes disabled for the account.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "aws_accounts",
        sa.Column("tag_writer_role_arn", sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("aws_accounts", "tag_writer_role_arn")
