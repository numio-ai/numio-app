"""finding_acks table for IA v2 Inbox badge persistence

Revision ID: b9c1d2e3f4a5
Revises: a7b8c9d0e1f2
Create Date: 2026-05-18

Notes:
  * ``workspace_id`` is ``String(255)`` to match ``findings.workspace_id`` so
    a LEFT JOIN findings ↔ finding_acks needs no cast. The §4 convention asks
    for UUID + FK→workspaces.id; ``findings`` predates that convention with
    no workspace FK either. Aligning the two adjacent tables is more useful
    than asymptotic convention adherence; future ``findings`` normalization
    moves both together.
  * Unique constraint on ``(workspace_id, finding_id)`` makes acks workspace-
    wide (per task scope: "any user can ack on behalf of the workspace").
    ``user_id`` is kept for audit only and is nullable so user deletion does
    not cascade-destroy the ack history.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b9c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finding_acks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.String(length=255), nullable=False),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["finding_id"], ["findings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finding_acks_workspace_id", "finding_acks", ["workspace_id"])
    op.create_index(
        "uq_finding_acks_workspace_finding",
        "finding_acks",
        ["workspace_id", "finding_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_finding_acks_workspace_finding", table_name="finding_acks")
    op.drop_index("ix_finding_acks_workspace_id", table_name="finding_acks")
    op.drop_table("finding_acks")
