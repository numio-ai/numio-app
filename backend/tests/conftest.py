"""Shared pytest fixtures for integration tests against a real PostgreSQL database."""

import os

# Disable auth for all tests — bypass mode returns synthetic admin user.
os.environ["AUTH_ENABLED"] = "false"

import psycopg
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from numio.models.base import Base

# Test database configuration.
# Default connects to the same PostgreSQL server as development but uses a separate database.
_PG_USER = os.environ.get("PGUSER", "numio")
_PG_PASSWORD = os.environ.get("PGPASSWORD", "numio")
_PG_HOST = os.environ.get("PGHOST", "localhost")
_PG_PORT = os.environ.get("PGPORT", "5432")
_TEST_DB = os.environ.get("TEST_DB_NAME", "numio_test")

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    f"postgresql+psycopg://{_PG_USER}:{_PG_PASSWORD}@{_PG_HOST}:{_PG_PORT}/{_TEST_DB}",
)

# Synchronous DSN for administrative commands (CREATE/DROP DATABASE).
_ADMIN_DSN = f"host={_PG_HOST} port={_PG_PORT} user={_PG_USER} password={_PG_PASSWORD}"


def _create_test_database() -> None:
    """Create the test database if it does not exist."""
    with psycopg.connect(f"{_ADMIN_DSN} dbname=postgres", autocommit=True) as conn:
        row = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (_TEST_DB,)).fetchone()
        if row is None:
            conn.execute(f'CREATE DATABASE "{_TEST_DB}"')


def _drop_test_database() -> None:
    """Drop the test database."""
    with psycopg.connect(f"{_ADMIN_DSN} dbname=postgres", autocommit=True) as conn:
        # Terminate existing connections before dropping.
        conn.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = %s AND pid <> pg_backend_pid()",
            (_TEST_DB,),
        )
        conn.execute(f'DROP DATABASE IF EXISTS "{_TEST_DB}"')


@pytest.fixture(scope="session", autouse=True)
def _setup_test_database():
    """Create a clean test database once per test session and drop it afterwards."""
    _drop_test_database()
    _create_test_database()
    yield
    _drop_test_database()


@pytest.fixture(scope="session")
def _engine(_setup_test_database):
    """Session-scoped async engine that creates all tables once and seeds default workspace."""
    import asyncio

    engine = create_async_engine(TEST_DATABASE_URL)

    async def _create_tables():
        # Import all models so metadata is populated.
        import numio.models  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed default workspace (required by auth bypass mode).
        from sqlalchemy.ext.asyncio import AsyncSession

        from numio.models.workspace import Workspace

        async with AsyncSession(engine) as session:
            from sqlalchemy import select

            result = await session.execute(select(Workspace).where(Workspace.slug == "default"))
            if result.scalar_one_or_none() is None:
                session.add(Workspace(name="default", slug="default"))
                await session.commit()

    asyncio.get_event_loop_policy().new_event_loop().run_until_complete(_create_tables())
    yield engine
    engine.sync_engine.dispose()


@pytest.fixture(scope="function")
async def db_session(_engine) -> AsyncSession:
    """Provide a transactional database session that rolls back after each test."""
    async with _engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        yield session
        await session.close()
        await transaction.rollback()


# ---------------------------------------------------------------------------
# Shared workspace fixture
# ---------------------------------------------------------------------------


@pytest.fixture
async def default_workspace_id(db_session) -> str:
    """Return the UUID (as string) of the seeded 'default' workspace.

    Most test fixtures need this instead of the literal string "default"
    because auth-protected endpoints resolve workspace_id from the
    authenticated user, which holds the real UUID.
    """
    from sqlalchemy import select

    from numio.models.workspace import Workspace

    result = await db_session.execute(select(Workspace).where(Workspace.slug == "default"))
    ws = result.scalar_one()
    return str(ws.id)


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def workspace_factory(db_session):
    """Factory fixture for creating Workspace objects."""
    from numio.db.repositories import WorkspaceRepository

    repo = WorkspaceRepository(db_session)
    _counter = 0

    async def _create(name: str | None = None, slug: str | None = None):
        nonlocal _counter
        _counter += 1
        return await repo.create(
            name=name or f"Test Workspace {_counter}",
            slug=slug or f"test-workspace-{_counter}",
        )

    return _create


@pytest.fixture
def user_factory(db_session):
    """Factory fixture for creating User objects within a workspace."""
    from numio.db.repositories import UserRepository

    _counter = 0

    async def _create(workspace_id, email: str | None = None, name: str | None = None):
        nonlocal _counter
        _counter += 1
        repo = UserRepository(db_session, workspace_id)
        return await repo.create(
            email=email or f"user{_counter}@test.com",
            name=name or f"Test User {_counter}",
        )

    return _create
