"""rename audit_events to audit_config_events (M1)

Revision ID: c1d2e3f4a5b6
Revises: b9c1d2e3f4a5
Create Date: 2026-05-25

Part of feature tag_management (spec docs/tag-management/tag-management-spec.md §5.1, §11 step 1).
Pure rename: table + indexes. No column changes; existing rows keep their shape.
A second audit stream (audit_action_events) is added by a later revision.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b9c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_SUFFIXES = ("workspace_id", "user", "action", "entity_type", "created_at")


def upgrade() -> None:
    op.rename_table("audit_events", "audit_config_events")
    for suffix in _INDEX_SUFFIXES:
        op.execute(
            f"ALTER INDEX ix_audit_events_{suffix} RENAME TO ix_audit_config_events_{suffix}"
        )


def downgrade() -> None:
    for suffix in _INDEX_SUFFIXES:
        op.execute(
            f"ALTER INDEX ix_audit_config_events_{suffix} RENAME TO ix_audit_events_{suffix}"
        )
    op.rename_table("audit_config_events", "audit_events")
