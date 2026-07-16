"""REST API endpoints for notifications and notification preferences."""

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.core.notification_service import subscribe_sse, unsubscribe_sse
from numio.db.notification_repository import (
    NotificationPreferenceRepository,
    NotificationRepository,
)
from numio.db.session import get_session
from numio.schemas.notification import (
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationResponse,
    PreferencesResponse,
    UnreadCountResponse,
    UpdatePreferencesRequest,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


# --- Notification endpoints ---


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications",
)
async def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationListResponse:
    repo = NotificationRepository(session, str(current_user.workspace_id))
    notifications, total = await repo.list_all(unread_only=unread_only, limit=limit, offset=offset)
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        count=total,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UnreadCountResponse:
    repo = NotificationRepository(session, str(current_user.workspace_id))
    count = await repo.unread_count()
    return UnreadCountResponse(count=count)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
)
async def mark_as_read(
    notification_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationResponse:
    repo = NotificationRepository(session, str(current_user.workspace_id))
    updated = await repo.mark_read(notification_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Return the updated notification
    notifications, _ = await repo.list_all(limit=1)
    for n in notifications:
        if n.id == notification_id:
            return NotificationResponse.model_validate(n)

    # Fallback: re-query
    all_notifs, _ = await repo.list_all(limit=1000)
    for n in all_notifs:
        if n.id == notification_id:
            return NotificationResponse.model_validate(n)

    raise HTTPException(status_code=404, detail="Notification not found")


@router.post(
    "/read-all",
    summary="Mark all notifications as read",
)
async def mark_all_as_read(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = NotificationRepository(session, str(current_user.workspace_id))
    updated = await repo.mark_all_read()
    return {"updated": updated}


# --- SSE endpoint ---


@router.get(
    "/stream",
    summary="Server-Sent Events stream for real-time notifications",
)
async def notification_stream(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> StreamingResponse:
    """SSE endpoint that pushes new notifications to connected clients."""
    workspace_id = str(current_user.workspace_id)
    queue = subscribe_sse(workspace_id)

    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                try:
                    notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                    data = NotificationResponse.model_validate(notification)
                    yield f"data: {data.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
        finally:
            unsubscribe_sse(workspace_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Preferences endpoints ---


@router.get(
    "/preferences",
    response_model=PreferencesResponse,
    summary="Get notification preferences",
)
async def get_preferences(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PreferencesResponse:
    repo = NotificationPreferenceRepository(session, str(current_user.workspace_id))
    prefs = await repo.get_preferences(str(current_user.id))
    return PreferencesResponse(
        preferences=[
            NotificationPreferenceResponse(event_type=k, enabled=v)
            for k, v in sorted(prefs.items())
        ]
    )


@router.put(
    "/preferences",
    response_model=PreferencesResponse,
    summary="Update notification preferences",
)
async def update_preferences(
    body: UpdatePreferencesRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PreferencesResponse:
    workspace_id = str(current_user.workspace_id)
    user_id = str(current_user.id)
    repo = NotificationPreferenceRepository(session, workspace_id)
    for pref in body.preferences:
        await repo.set_preference(user_id, pref.event_type.value, pref.enabled)

    prefs = await repo.get_preferences(user_id)
    return PreferencesResponse(
        preferences=[
            NotificationPreferenceResponse(event_type=k, enabled=v)
            for k, v in sorted(prefs.items())
        ]
    )
