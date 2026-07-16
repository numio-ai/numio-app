"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine

# Import all models so Alembic can detect schema changes via autogenerate.
import numio.models  # noqa: F401
from alembic import context
from numio.core.config import settings
from numio.models.base import Base

# Alembic Config object for access to values within alembic.ini.
config = context.config

# Configure Python logging from alembic.ini if present.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection required)."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_migrations(sync_conn) -> None:
    """Configure context and run migrations within a single sync connection."""
    context.configure(connection=sync_conn, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode using an async engine."""
    connectable = create_async_engine(settings.database_url)

    async with connectable.begin() as connection:
        await connection.run_sync(_do_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
