"""REST API endpoints for audit action events (operations against external systems)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.db.audit_action_event_repository import AuditActionEventRepository
from numio.db.session import get_session
from numio.schemas.audit_action_event import (
    AuditActionEventDetailResponse,
    AuditActionEventListResponse,
    AuditActionEventResponse,
)

router = APIRouter(prefix="/audit-action-events", tags=["audit-action-events"])


@router.get(
    "",
    response_model=AuditActionEventListResponse,
    summary="List audit action events",
)
async def list_audit_action_events(
    operation_type: str | None = Query(default=None, description="Filter by operation type"),
    actor: str | None = Query(default=None, description="Filter by actor"),
    status: str | None = Query(default=None, description="Filter by status"),
    start_date: datetime | None = Query(default=None, description="Filter events after this date"),
    end_date: datetime | None = Query(default=None, description="Filter events before this date"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AuditActionEventListResponse:
    repo = AuditActionEventRepository(session, str(current_user.workspace_id))
    events, total = await repo.list_events(
        operation_type=operation_type,
        actor=actor,
        status=status,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return AuditActionEventListResponse(
        events=[AuditActionEventResponse.model_validate(e) for e in events],
        count=total,
    )


@router.get(
    "/{event_id}",
    response_model=AuditActionEventDetailResponse,
    summary="Get one audit action event with its child items",
)
async def get_audit_action_event(
    event_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AuditActionEventDetailResponse:
    repo = AuditActionEventRepository(session, str(current_user.workspace_id))
    event = await repo.get_with_items(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Audit action event not found")
    return AuditActionEventDetailResponse.model_validate(event)
