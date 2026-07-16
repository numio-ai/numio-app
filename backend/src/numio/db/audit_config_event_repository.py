"""Workspace-scoped data access layer for audit config events."""

from datetime import datetime

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.audit_config_event import AuditConfigEvent


class AuditConfigEventRepository:
    """CRUD operations for audit config events, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(
        self,
        *,
        user: str,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        before_value: dict | None = None,
        after_value: dict | None = None,
        details: str | None = None,
    ) -> AuditConfigEvent:
        event = AuditConfigEvent(
            workspace_id=self._workspace_id,
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_value=before_value,
            after_value=after_value,
            details=details,
        )
        self._session.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def list_all(
        self,
        *,
        user: str | None = None,
        action: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditConfigEvent], int]:
        conditions = [AuditConfigEvent.workspace_id == self._workspace_id]

        if user is not None:
            conditions.append(AuditConfigEvent.user == user)
        if action is not None:
            conditions.append(AuditConfigEvent.action == action)
        if entity_type is not None:
            conditions.append(AuditConfigEvent.entity_type == entity_type)
        if entity_id is not None:
            conditions.append(AuditConfigEvent.entity_id == entity_id)
        if start_date is not None:
            conditions.append(AuditConfigEvent.created_at >= start_date)
        if end_date is not None:
            conditions.append(AuditConfigEvent.created_at <= end_date)

        count_result = await self._session.execute(
            select(sa_func.count(AuditConfigEvent.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(AuditConfigEvent)
            .where(*conditions)
            .order_by(AuditConfigEvent.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total
