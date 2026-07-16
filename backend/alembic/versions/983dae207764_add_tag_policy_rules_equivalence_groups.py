"""add tag_policy_rules equivalence_groups

Revision ID: 983dae207764
Revises: e3f4a5b6c7d8
Create Date: 2026-05-26 00:04:43.344916

Part of feature tag_management (spec §5.5, §5.6). Per-rule value equivalence
groups: shape [["production","prod"],...] with the first entry canonical.
Drives the new `drift` compliance status.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '983dae207764'
down_revision: Union[str, Sequence[str], None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tag_policy_rules",
        sa.Column("equivalence_groups", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tag_policy_rules", "equivalence_groups")
