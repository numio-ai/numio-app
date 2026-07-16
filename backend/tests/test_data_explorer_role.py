"""Verify the numio_readonly Postgres role can SELECT but not write.

This is the contract that lets the Data Explorer run user-supplied SQL
safely. If this test ever fails, the read-only enforcement is broken and
the Data Explorer endpoint must not ship with that build.
"""

from __future__ import annotations

import psycopg
import pytest
from sqlalchemy import NullPool, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine

from numio.db.explorer_role import READONLY_ROLE, upgrade_sql
from tests.conftest import TEST_DATABASE_URL

_TEST_PASSWORD = "ro_test_pwd"


@pytest.fixture(scope="module")
def _readonly_role(_engine):
    """Provision the read-only role on the test database for one module.

    Uses psycopg directly (sync) — bypassing the async engine — so setup and
    teardown don't depend on a per-test event loop. The role is global to
    the cluster and survives the test database drop, so cleanup matters even
    for repeat runs.
    """
    sync_url = TEST_DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(sync_url, autocommit=True) as conn:
        for stmt in upgrade_sql(_TEST_PASSWORD):
            conn.execute(stmt)
    yield
    # Revoke grants in *this* database. Don't DROP ROLE — the role is global
    # to the Postgres cluster; if any other DB on the cluster also holds
    # grants for it (e.g. a developer's local `numio`), the drop fails. The
    # role itself is harmless to leave around — next session re-provisions
    # idempotently.
    with psycopg.connect(sync_url, autocommit=True) as conn:
        conn.execute(
            f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"REVOKE SELECT ON TABLES FROM {READONLY_ROLE}"
        )
        conn.execute(f"DROP OWNED BY {READONLY_ROLE}")


@pytest.fixture(scope="module")
def _readonly_engine(_readonly_role):
    """Async engine authenticated as numio_readonly against the test DB."""
    url = make_url(TEST_DATABASE_URL).set(
        username=READONLY_ROLE,
        password=_TEST_PASSWORD,
    )
    # NullPool keeps no connections in the pool — sidesteps async cleanup
    # of pooled connections at module teardown when the loop is closed.
    engine = create_async_engine(url.render_as_string(hide_password=False), poolclass=NullPool)
    yield engine
    # Dispose via the underlying sync engine — the async dispose() needs an
    # event loop that may already be closed by the time module teardown runs.
    engine.sync_engine.dispose()


async def test_readonly_can_select(_readonly_engine):
    async with _readonly_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
        # Real table from the schema — proves SELECT grants apply broadly.
        result = await conn.execute(text("SELECT COUNT(*) FROM workspaces"))
        assert result.scalar() is not None


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO workspaces (id, name, slug) VALUES (gen_random_uuid(), 'x', 'x')",
        "UPDATE workspaces SET name = 'x'",
        "DELETE FROM workspaces",
        "TRUNCATE workspaces",
        "CREATE TABLE de_role_test (id int)",
        "DROP TABLE workspaces",
        "ALTER TABLE workspaces ADD COLUMN x int",
    ],
    ids=["insert", "update", "delete", "truncate", "create", "drop", "alter"],
)
async def test_readonly_denies_writes(_readonly_engine, sql: str):
    with pytest.raises(ProgrammingError) as exc:
        async with _readonly_engine.connect() as conn:
            await conn.execute(text(sql))
    # Postgres returns either "permission denied for ..." or "must be owner of ..."
    # depending on the operation; both prove the role lacks write authority.
    msg = str(exc.value).lower()
    assert "permission denied" in msg or "must be owner" in msg
