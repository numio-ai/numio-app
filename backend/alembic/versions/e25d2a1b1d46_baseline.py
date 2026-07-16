"""baseline

Single consolidated baseline that replaces 24 incremental migrations
authored between 2026-03-19 and 2026-04-26 (legacy chain head:
c1a8b9d2e3f4). The DDL applied here is the verbatim
``pg_dump --schema-only`` output of the legacy chain, captured on
2026-04-28 and stored alongside this file as
``e25d2a1b1d46_baseline.sql``. The current alembic-built DB schema is
the source of truth — not the SQLAlchemy models — so server defaults,
column ordering, and any hand-edits in the legacy chain are preserved
exactly. Any drift between models and this schema is tracked separately.

Revision ID: e25d2a1b1d46
Revises:
Create Date: 2026-04-28
"""

from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "e25d2a1b1d46"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    sql_file = Path(__file__).with_suffix(".sql")
    op.get_bind().exec_driver_sql(sql_file.read_text())


def downgrade() -> None:
    op.execute("DROP SCHEMA public CASCADE")
    op.execute("CREATE SCHEMA public")
    op.execute("GRANT ALL ON SCHEMA public TO numio")
    op.execute("GRANT ALL ON SCHEMA public TO public")
