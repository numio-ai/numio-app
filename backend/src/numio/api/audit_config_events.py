"""REST API endpoints for audit trail."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.db.audit_config_event_repository import AuditConfigEventRepository
from numio.db.session import get_session
from numio.schemas.audit_config_event import AuditConfigEventListResponse, AuditConfigEventResponse

router = APIRouter(prefix="/audit-config-events", tags=["audit-config-events"])


@router.get(
    "",
    response_model=AuditConfigEventListResponse,
    summary="List audit events",
)
async def list_audit_config_events(
    user: str | None = Query(default=None, description="Filter by user"),
    action: str | None = Query(default=None, description="Filter by action type"),
    entity_type: str | None = Query(default=None, description="Filter by entity type"),
    entity_id: str | None = Query(default=None, description="Filter by entity ID"),
    start_date: datetime | None = Query(default=None, description="Filter events after this date"),
    end_date: datetime | None = Query(default=None, description="Filter events before this date"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AuditConfigEventListResponse:
    repo = AuditConfigEventRepository(session, str(current_user.workspace_id))
    events, total = await repo.list_all(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return AuditConfigEventListResponse(
        events=[AuditConfigEventResponse.model_validate(e) for e in events],
        count=total,
    )
