"""Workspace-scoped data access layer."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.user import User
from numio.models.workspace import Workspace


class WorkspaceRepository:
    """CRUD operations for Workspace, scoped to prevent cross-workspace leakage."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, workspace_id: uuid.UUID) -> Workspace | None:
        result = await self._session.execute(select(Workspace).where(Workspace.id == workspace_id))
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Workspace | None:
        result = await self._session.execute(select(Workspace).where(Workspace.slug == slug))
        return result.scalar_one_or_none()

    async def create(self, name: str, slug: str) -> Workspace:
        workspace = Workspace(name=name, slug=slug)
        self._session.add(workspace)
        await self._session.commit()
        await self._session.refresh(workspace)
        return workspace


class UserRepository:
    """CRUD operations for User — all queries are scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def list(self) -> list[User]:
        result = await self._session.execute(
            select(User).where(User.workspace_id == self._workspace_id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(
                User.id == user_id,
                User.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, email: str, name: str) -> User:
        user = User(workspace_id=self._workspace_id, email=email, name=name)
        self._session.add(user)
        await self._session.commit()
        await self._session.refresh(user)
        return user
