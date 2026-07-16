"""Integration tests for the Data Explorer query endpoint."""

from __future__ import annotations

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from numio.db.explorer_role import READONLY_ROLE, upgrade_sql
from tests.conftest import TEST_DATABASE_URL

_TEST_PASSWORD = "ro_query_pwd"


# ---------------------------------------------------------------------------
# Role + readonly engine — module-scoped, sync provisioning to sidestep async
# event-loop scope issues at teardown.
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def _readonly_role(_engine):
    """Create the read-only role on the test database for one module."""
    sync_url = TEST_DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(sync_url, autocommit=True) as conn:
        for stmt in upgrade_sql(_TEST_PASSWORD):
            conn.execute(stmt)
    yield
    # Same rationale as test_data_explorer_role.py: revoke grants in this DB
    # but leave the cluster-wide role intact — a sibling local DB may hold
    # grants on it that would block DROP ROLE.
    with psycopg.connect(sync_url, autocommit=True) as conn:
        conn.execute(
            f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"REVOKE SELECT ON TABLES FROM {READONLY_ROLE}"
        )
        conn.execute(f"DROP OWNED BY {READONLY_ROLE}")


@pytest.fixture(scope="module")
def _readonly_engine(_readonly_role):
    url = make_url(TEST_DATABASE_URL).set(
        username=READONLY_ROLE,
        password=_TEST_PASSWORD,
    )
    engine = create_async_engine(
        url.render_as_string(hide_password=False),
        poolclass=NullPool,
    )
    yield engine
    engine.sync_engine.dispose()


# ---------------------------------------------------------------------------
# FastAPI client — wires the explorer dependency to our test engine.
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(_readonly_engine, db_session):
    """ASGI client with both the primary and explorer sessions overridden."""
    from numio.db.explorer_session import get_explorer_session
    from numio.db.session import get_session
    from numio.main import app

    override_session_maker = async_sessionmaker(_readonly_engine, expire_on_commit=False)

    async def _override_explorer():
        async with override_session_maker() as s:
            yield s

    async def _override_primary():
        yield db_session

    app.dependency_overrides[get_explorer_session] = _override_explorer
    app.dependency_overrides[get_session] = _override_primary
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_explorer_session, None)
    app.dependency_overrides.pop(get_session, None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_select_returns_rows(client):
    resp = await client.post("/api/v1/data-explorer/query", json={"sql": "SELECT 1 AS one"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["columns"] == ["one"]
    assert body["rows"] == [[1]]
    assert body["row_count"] == 1
    assert body["truncated"] is False
    assert isinstance(body["elapsed_ms"], int)


async def test_select_against_real_table(client):
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELECT slug FROM workspaces ORDER BY slug"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["columns"] == ["slug"]
    assert any(row[0] == "default" for row in body["rows"])


async def test_truncation_indicator(client, monkeypatch):
    """When result rows > max_rows, the response trims and flags truncated."""
    from numio.core import config

    monkeypatch.setattr(config.settings, "data_explorer_max_rows", 3)
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELECT i FROM generate_series(1, 10) AS i"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["row_count"] == 3
    assert body["truncated"] is True
    assert body["rows"] == [[1], [2], [3]]


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO workspaces (id,name,slug) VALUES (gen_random_uuid(),'x','xq')",
        "UPDATE workspaces SET name = 'x'",
        "DELETE FROM workspaces",
        "CREATE TABLE de_query_test (id int)",
    ],
    ids=["insert", "update", "delete", "create"],
)
async def test_writes_are_denied_with_403(client, sql):
    resp = await client.post("/api/v1/data-explorer/query", json={"sql": sql})
    assert resp.status_code == 403, resp.text
    body = resp.json()
    assert body["error_code"] == "PERMISSION_DENIED"
    assert body["message"]


async def test_syntax_error_returns_400(client):
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELEKT * FROM workspaces"},
    )
    assert resp.status_code == 400, resp.text
    body = resp.json()
    assert body["error_code"] == "INVALID_SQL"


async def test_statement_timeout_returns_408(client, monkeypatch):
    """A query that runs longer than the configured timeout is cancelled."""
    from numio.core import config

    monkeypatch.setattr(config.settings, "data_explorer_statement_timeout_ms", 100)
    # pg_sleep(2) is well above the 100ms timeout we just set.
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELECT pg_sleep(2)"},
    )
    assert resp.status_code == 408, resp.text
    body = resp.json()
    assert body["error_code"] == "STATEMENT_TIMEOUT"


async def test_oversized_sql_returns_413(client, monkeypatch):
    from numio.core import config

    monkeypatch.setattr(config.settings, "data_explorer_max_sql_bytes", 10)
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELECT 1, 2, 3, 4, 5"},
    )
    assert resp.status_code == 413, resp.text
    body = resp.json()
    assert body["error_code"] == "SQL_TOO_LARGE"


async def test_empty_sql_rejected(client):
    resp = await client.post("/api/v1/data-explorer/query", json={"sql": ""})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error_code"] == "VALIDATION_ERROR"


async def test_decimal_values_serialised_as_strings(client):
    resp = await client.post(
        "/api/v1/data-explorer/query",
        json={"sql": "SELECT 1.23::numeric AS amt"},
    )
    assert resp.status_code == 200
    body = resp.json()
    # numeric → Decimal → string (preserves precision exactly).
    assert body["rows"] == [["1.23"]]
