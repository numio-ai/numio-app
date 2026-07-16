"""Read-only Postgres engine and session factory for Data Explorer.

Used exclusively by the Data Explorer ad-hoc query endpoint. The connection
authenticates as ``numio_readonly`` — a Postgres role with SELECT-only grants
provisioned by the data-explorer migration. Writes are rejected by the
database, not by the application.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from numio.core.config import settings
from numio.db.explorer_role import READONLY_ROLE


def _build_readonly_url() -> str:
    """Build the DSN for the read-only connection.

    If ``DATA_EXPLORER_DATABASE_URL`` is set, it is used verbatim. Otherwise
    the primary ``DATABASE_URL`` is reused with the userinfo swapped for
    ``numio_readonly:${DATA_EXPLORER_DB_PASSWORD}``.
    """
    if settings.data_explorer_database_url:
        return settings.data_explorer_database_url
    url = make_url(settings.database_url).set(
        username=READONLY_ROLE,
        password=settings.data_explorer_db_password,
    )
    return url.render_as_string(hide_password=False)


explorer_engine = create_async_engine(
    _build_readonly_url(),
    echo=False,
    pool_size=5,
    max_overflow=0,
    pool_pre_ping=True,
)

ExplorerSessionLocal = async_sessionmaker(explorer_engine, expire_on_commit=False)


async def get_explorer_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a read-only DB session."""
    async with ExplorerSessionLocal() as session:
        yield session
