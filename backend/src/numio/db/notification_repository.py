"""Workspace-scoped data access layer for notifications and preferences."""

import uuid

from sqlalchemy import func as sa_func
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.notification import Notification, NotificationPreference
from numio.schemas.notification import NotificationEventType


class NotificationRepository:
    """CRUD operations for notifications, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(
        self,
        *,
        event_type: str,
        title: str,
        message: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
    ) -> Notification:
        notification = Notification(
            workspace_id=self._workspace_id,
            event_type=event_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        self._session.add(notification)
        await self._session.commit()
        await self._session.refresh(notification)
        return notification

    async def list_all(
        self,
        *,
        unread_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Notification], int]:
        conditions = [Notification.workspace_id == self._workspace_id]
        if unread_only:
            conditions.append(Notification.is_read.is_(False))

        count_result = await self._session.execute(
            select(sa_func.count(Notification.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(Notification)
            .where(*conditions)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def mark_read(self, notification_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.workspace_id == self._workspace_id,
            )
            .values(is_read=True)
        )
        await self._session.commit()
        return result.rowcount > 0

    async def mark_all_read(self) -> int:
        result = await self._session.execute(
            update(Notification)
            .where(
                Notification.workspace_id == self._workspace_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )
        await self._session.commit()
        return result.rowcount

    async def unread_count(self) -> int:
        result = await self._session.execute(
            select(sa_func.count(Notification.id)).where(
                Notification.workspace_id == self._workspace_id,
                Notification.is_read.is_(False),
            )
        )
        return result.scalar_one()


class NotificationPreferenceRepository:
    """CRUD operations for per-user notification preferences."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def get_preferences(self, user_id: str) -> dict[str, bool]:
        """Return preferences as {event_type: enabled}. Missing types default to True."""
        result = await self._session.execute(
            select(NotificationPreference).where(
                NotificationPreference.workspace_id == self._workspace_id,
                NotificationPreference.user_id == user_id,
            )
        )
        prefs = {row.event_type: row.enabled for row in result.scalars().all()}

        # Fill in defaults for missing event types
        for event_type in NotificationEventType:
            if event_type.value not in prefs:
                prefs[event_type.value] = True

        return prefs

    async def set_preference(self, user_id: str, event_type: str, enabled: bool) -> None:
        """Upsert a single preference."""
        result = await self._session.execute(
            select(NotificationPreference).where(
                NotificationPreference.workspace_id == self._workspace_id,
                NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type,
            )
        )
        pref = result.scalar_one_or_none()

        if pref is not None:
            pref.enabled = enabled
        else:
            pref = NotificationPreference(
                workspace_id=self._workspace_id,
                user_id=user_id,
                event_type=event_type,
                enabled=enabled,
            )
            self._session.add(pref)

        await self._session.commit()

    async def is_enabled(self, user_id: str, event_type: str) -> bool:
        """Check if a specific event type is enabled for a user. Defaults to True."""
        result = await self._session.execute(
            select(NotificationPreference.enabled).where(
                NotificationPreference.workspace_id == self._workspace_id,
                NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type,
            )
        )
        row = result.scalar_one_or_none()
        return row if row is not None else True
