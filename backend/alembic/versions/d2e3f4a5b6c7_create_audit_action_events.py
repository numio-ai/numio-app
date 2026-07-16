"""create audit_action_events and audit_action_event_items

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-25

Part of feature tag_management (spec §5.2, §5.3). Two-level action audit:
one parent row per external operation, one child row per leaf change.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_action_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.String(length=255), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_action_events_workspace_requested",
        "audit_action_events",
        ["workspace_id", "requested_at"],
    )
    op.create_index(
        "ix_audit_action_events_workspace_optype_requested",
        "audit_action_events",
        ["workspace_id", "operation_type", "requested_at"],
    )

    op.create_table(
        "audit_action_event_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.String(length=1024), nullable=False),
        sa.Column("change_key", sa.String(length=255), nullable=False),
        sa.Column("before_value", sa.String(length=1024), nullable=True),
        sa.Column("after_value", sa.String(length=1024), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("error_code", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("aws_request_id", sa.String(length=255), nullable=True),
        sa.Column(
            "attempted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["audit_action_events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_action_event_items_event_id",
        "audit_action_event_items",
        ["event_id"],
    )
    op.create_index(
        "ix_audit_action_event_items_target_attempted",
        "audit_action_event_items",
        ["target_id", "attempted_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_audit_action_event_items_target_attempted", table_name="audit_action_event_items"
    )
    op.drop_index("ix_audit_action_event_items_event_id", table_name="audit_action_event_items")
    op.drop_table("audit_action_event_items")
    op.drop_index(
        "ix_audit_action_events_workspace_optype_requested", table_name="audit_action_events"
    )
    op.drop_index("ix_audit_action_events_workspace_requested", table_name="audit_action_events")
    op.drop_table("audit_action_events")
