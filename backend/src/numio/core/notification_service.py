"""Notification service — creates notifications and manages SSE broadcasting."""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.notification_repository import NotificationRepository
from numio.models.notification import Notification
from numio.models.workspace import AutomationToggle, Workspace

logger = logging.getLogger(__name__)

# Map notification event types to automation domains for Andon cord checks.
_EVENT_TYPE_TO_DOMAIN: dict[str, str] = {
    "budget_alert": "budget_alerts",
    "anomaly_detected": "anomaly_detection",
    "zombie_found": "zombie_detection",
    "policy_violation": "policy_evaluation",
    "recommendation_generated": "recommendations",
}

# In-memory broadcast queue for SSE — maps workspace_id to a set of asyncio.Queue.
# Each connected SSE client registers a queue; new notifications are pushed to all queues.
_sse_subscribers: dict[str, set[asyncio.Queue]] = {}


def subscribe_sse(workspace_id: str) -> asyncio.Queue:
    """Register a new SSE subscriber for a workspace. Returns a queue to await."""
    if workspace_id not in _sse_subscribers:
        _sse_subscribers[workspace_id] = set()
    queue: asyncio.Queue = asyncio.Queue()
    _sse_subscribers[workspace_id].add(queue)
    return queue


def unsubscribe_sse(workspace_id: str, queue: asyncio.Queue) -> None:
    """Remove an SSE subscriber."""
    if workspace_id in _sse_subscribers:
        _sse_subscribers[workspace_id].discard(queue)
        if not _sse_subscribers[workspace_id]:
            del _sse_subscribers[workspace_id]


def _broadcast(workspace_id: str, notification: Notification) -> None:
    """Push a notification to all SSE subscribers for the workspace."""
    subscribers = _sse_subscribers.get(workspace_id)
    if not subscribers:
        return
    for queue in subscribers:
        try:
            queue.put_nowait(notification)
        except asyncio.QueueFull:
            logger.warning("SSE queue full for workspace %s, dropping notification", workspace_id)


class NotificationService:
    """Creates notifications while respecting user preferences and broadcasting via SSE."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id
        self._repo = NotificationRepository(session, workspace_id)

    async def _is_automation_paused(self, event_type: str) -> bool:
        """Check if automation is paused globally or for the domain of this event type."""
        # Check global toggle
        result = await self._session.execute(
            select(Workspace.automation_paused).where(Workspace.id == self._workspace_id)
        )
        row = result.scalar_one_or_none()
        if row is True:
            return True

        # Check per-domain toggle
        domain = _EVENT_TYPE_TO_DOMAIN.get(event_type)
        if domain:
            toggle_result = await self._session.execute(
                select(AutomationToggle.paused).where(
                    AutomationToggle.workspace_id == self._workspace_id,
                    AutomationToggle.domain == domain,
                )
            )
            domain_paused = toggle_result.scalar_one_or_none()
            if domain_paused is True:
                return True

        return False

    async def create_notification(
        self,
        *,
        event_type: str,
        title: str,
        message: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
    ) -> Notification | None:
        """Create a notification and broadcast it via SSE.

        Returns None if automation is paused (Andon cord active) for this event type.
        """
        if await self._is_automation_paused(event_type):
            logger.info(
                "Notification suppressed (automation paused): type=%s title='%s'",
                event_type,
                title,
            )
            return None

        notification = await self._repo.create(
            event_type=event_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        _broadcast(self._workspace_id, notification)
        logger.info(
            "Notification created: type=%s title='%s' entity=%s/%s",
            event_type,
            title,
            entity_type,
            entity_id,
        )
        return notification
