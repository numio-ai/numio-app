"""Workspace-scoped data access for Data Explorer saved queries."""

from __future__ import annotations

import uuid

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.saved_query import SavedQuery


class SavedQueryNameTaken(Exception):
    """Raised when a saved-query name collides within the workspace."""


class SavedQueryRepository:
    """CRUD for saved queries, scoped to a single workspace.

    Uniqueness on `(workspace_id, name)` is enforced two ways:

    - A SELECT pre-check in this repo, so the API can return a clean 409
      without entering the IntegrityError-and-rollback path.
    - A unique index at the DB level, as defense-in-depth against the
      tiny race between the SELECT and the INSERT.
    """

    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def list_all(self) -> tuple[list[SavedQuery], int]:
        cond = SavedQuery.workspace_id == self._workspace_id
        count_result = await self._session.execute(select(sa_func.count(SavedQuery.id)).where(cond))
        total = count_result.scalar_one()
        result = await self._session.execute(
            select(SavedQuery).where(cond).order_by(SavedQuery.name)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, query_id: uuid.UUID) -> SavedQuery | None:
        result = await self._session.execute(
            select(SavedQuery).where(
                SavedQuery.id == query_id,
                SavedQuery.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def _name_in_use(self, name: str, *, except_id: uuid.UUID | None = None) -> bool:
        cond = [
            SavedQuery.workspace_id == self._workspace_id,
            SavedQuery.name == name,
        ]
        if except_id is not None:
            cond.append(SavedQuery.id != except_id)
        result = await self._session.execute(select(SavedQuery.id).where(*cond))
        return result.first() is not None

    async def create(
        self,
        *,
        name: str,
        sql: str,
        description: str | None,
        user_id: uuid.UUID,
    ) -> SavedQuery:
        if await self._name_in_use(name):
            raise SavedQueryNameTaken(name)
        query = SavedQuery(
            workspace_id=self._workspace_id,
            name=name,
            sql=sql,
            description=description,
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
        )
        self._session.add(query)
        await self._session.commit()
        await self._session.refresh(query)
        return query

    async def update(
        self,
        query_id: uuid.UUID,
        *,
        name: str | None,
        sql: str | None,
        description: str | None,
        description_set: bool,
        user_id: uuid.UUID,
    ) -> SavedQuery | None:
        """Apply a partial update.

        `description_set` distinguishes "leave untouched" from "set to None"
        for the nullable description field — Pydantic's exclude_unset already
        captures this at the route layer.
        """
        query = await self.get_by_id(query_id)
        if query is None:
            return None

        if (
            name is not None
            and name != query.name
            and await self._name_in_use(name, except_id=query_id)
        ):
            raise SavedQueryNameTaken(name)

        if name is not None:
            query.name = name
        if sql is not None:
            query.sql = sql
        if description_set:
            query.description = description
        query.updated_by_user_id = user_id

        await self._session.commit()
        await self._session.refresh(query)
        return query

    async def delete(self, query_id: uuid.UUID) -> bool:
        query = await self.get_by_id(query_id)
        if query is None:
            return False
        await self._session.delete(query)
        await self._session.commit()
        return True
