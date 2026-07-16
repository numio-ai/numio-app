"""Provision numio_readonly Postgres role for Data Explorer

Creates a SELECT-only role used by the Data Explorer ad-hoc query endpoint.
The role's password is read from settings (env: DATA_EXPLORER_DB_PASSWORD).

Revision ID: f1a2b3c4d5e6
Revises: e25d2a1b1d46
Create Date: 2026-05-03
"""

from typing import Sequence, Union

from alembic import op
from numio.core.config import settings
from numio.db.explorer_role import downgrade_sql, upgrade_sql

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e25d2a1b1d46"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for stmt in upgrade_sql(settings.data_explorer_db_password):
        op.execute(stmt)


def downgrade() -> None:
    for stmt in downgrade_sql():
        op.execute(stmt)
