"""Database initialization: run migrations and seed default workspace."""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alembic import command
from numio.models.workspace import DEFAULT_WORKSPACE_NAME, DEFAULT_WORKSPACE_SLUG, Workspace

logger = logging.getLogger(__name__)


def _run_upgrade(alembic_cfg_path: str) -> None:
    """Execute Alembic upgrade in a plain thread (no running event loop)."""
    alembic_cfg = Config(alembic_cfg_path)
    command.upgrade(alembic_cfg, "head")


async def run_migrations(alembic_cfg_path: str) -> None:
    """Run Alembic migrations.

    Alembic's env.py uses asyncio.run() which cannot be called inside a running
    event loop.  Offloading to a thread avoids the conflict.
    """
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=1) as pool:
        await loop.run_in_executor(pool, _run_upgrade, alembic_cfg_path)
    logger.info("Database migrations applied.")


async def seed_default_workspace(session: AsyncSession) -> None:
    """Create the default workspace if it does not already exist."""
    result = await session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    )
    if result.scalar_one_or_none() is None:
        workspace = Workspace(name=DEFAULT_WORKSPACE_NAME, slug=DEFAULT_WORKSPACE_SLUG)
        session.add(workspace)
        await session.commit()
        logger.info("Default workspace created (slug=%s).", DEFAULT_WORKSPACE_SLUG)
    else:
        logger.debug("Default workspace already exists, skipping seed.")
