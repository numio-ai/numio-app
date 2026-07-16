"""Workspace-scoped data access layer for audit action events (parent + child items)."""

from datetime import datetime

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.models.audit_action_event import AuditActionEvent, AuditActionEventItem


class AuditActionEventRepository:
    """CRUD for two-level action audit, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create_event(
        self,
        *,
        actor: str,
        operation_type: str,
        status: str = "in_progress",
        rationale: str | None = None,
        summary: dict | None = None,
    ) -> AuditActionEvent:
        event = AuditActionEvent(
            workspace_id=self._workspace_id,
            actor=actor,
            operation_type=operation_type,
            status=status,
            rationale=rationale,
            summary=summary,
        )
        self._session.add(event)
        await self._session.flush()
        return event

    def add_item(
        self,
        *,
        event_id,
        target_type: str,
        target_id: str,
        change_key: str,
        status: str,
        before_value: str | None = None,
        after_value: str | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        aws_request_id: str | None = None,
        completed_at: datetime | None = None,
    ) -> AuditActionEventItem:
        item = AuditActionEventItem(
            event_id=event_id,
            target_type=target_type,
            target_id=target_id,
            change_key=change_key,
            status=status,
            before_value=before_value,
            after_value=after_value,
            error_code=error_code,
            error_message=error_message,
            aws_request_id=aws_request_id,
            completed_at=completed_at,
        )
        self._session.add(item)
        return item

    async def finalize_event(
        self,
        event: AuditActionEvent,
        *,
        status: str,
        summary: dict,
        completed_at: datetime,
    ) -> None:
        event.status = status
        event.summary = summary
        event.completed_at = completed_at
        await self._session.flush()

    async def get_with_items(self, event_id) -> AuditActionEvent | None:
        result = await self._session.execute(
            select(AuditActionEvent)
            .where(
                AuditActionEvent.id == event_id,
                AuditActionEvent.workspace_id == self._workspace_id,
            )
            .options(selectinload(AuditActionEvent.items))
        )
        return result.scalar_one_or_none()

    async def list_events(
        self,
        *,
        operation_type: str | None = None,
        actor: str | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditActionEvent], int]:
        conditions = [AuditActionEvent.workspace_id == self._workspace_id]

        if operation_type is not None:
            conditions.append(AuditActionEvent.operation_type == operation_type)
        if actor is not None:
            conditions.append(AuditActionEvent.actor == actor)
        if status is not None:
            conditions.append(AuditActionEvent.status == status)
        if start_date is not None:
            conditions.append(AuditActionEvent.requested_at >= start_date)
        if end_date is not None:
            conditions.append(AuditActionEvent.requested_at <= end_date)

        count_result = await self._session.execute(
            select(sa_func.count(AuditActionEvent.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(AuditActionEvent)
            .where(*conditions)
            .order_by(AuditActionEvent.requested_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total
