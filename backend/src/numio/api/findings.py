"""REST API endpoints for findings management."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.audit_service import audit_trail
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.finding_repository import FindingRepository
from numio.db.session import get_session
from numio.schemas.finding import (
    AcknowledgeFindingRequest,
    BulkActionRequest,
    BulkActionResponse,
    CreateFindingRequest,
    FindingDetailResponse,
    FindingListResponse,
    FindingResponse,
    FindingSeverity,
    FindingStatus,
    FindingType,
    ResolveFindingRequest,
    SuppressFindingRequest,
)

router = APIRouter(prefix="/findings", tags=["findings"])


# --- CRUD ---


@router.post(
    "",
    response_model=FindingResponse,
    status_code=201,
    summary="Create a finding",
)
async def create_finding(
    body: CreateFindingRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> FindingResponse:
    """Create a finding. Deduplicates by (type, resource_id, detection_source)."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    finding, created = await repo.create_or_update(body)
    return FindingResponse.model_validate(finding)


@router.get(
    "",
    response_model=FindingListResponse,
    summary="List findings",
)
async def list_findings(
    type: FindingType | None = Query(default=None, description="Filter by finding type"),
    severity: FindingSeverity | None = Query(default=None, description="Filter by severity"),
    status: FindingStatus | None = Query(default=None, description="Filter by status"),
    resource_id: str | None = Query(default=None, description="Filter by resource ID"),
    detection_source: str | None = Query(default=None, description="Filter by detection source"),
    detected_after: datetime | None = Query(default=None, description="Findings detected after"),
    detected_before: datetime | None = Query(default=None, description="Findings detected before"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FindingListResponse:
    """List findings with optional filters."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    findings, total = await repo.list_findings(
        finding_type=type.value if type else None,
        severity=severity.value if severity else None,
        status=status.value if status else None,
        resource_id=resource_id,
        detection_source=detection_source,
        detected_after=detected_after,
        detected_before=detected_before,
        limit=limit,
        offset=offset,
    )
    return FindingListResponse(
        findings=[FindingResponse.model_validate(f) for f in findings],
        count=total,
    )


# --- Bulk operations (must be before /{finding_id} routes) ---


@router.post(
    "/bulk/acknowledge",
    response_model=BulkActionResponse,
    summary="Bulk acknowledge findings",
)
async def bulk_acknowledge(
    body: BulkActionRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> BulkActionResponse:
    """Acknowledge multiple findings at once."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    updated_ids = await repo.bulk_acknowledge(body.finding_ids, changed_by=body.changed_by)
    return BulkActionResponse(updated=len(updated_ids), ids=updated_ids)


@router.post(
    "/bulk/resolve",
    response_model=BulkActionResponse,
    summary="Bulk resolve findings",
)
async def bulk_resolve(
    body: BulkActionRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> BulkActionResponse:
    """Resolve multiple findings at once."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    updated_ids = await repo.bulk_resolve(body.finding_ids, changed_by=body.changed_by)
    return BulkActionResponse(updated=len(updated_ids), ids=updated_ids)


# --- Detail and state transitions ---


@router.get(
    "/{finding_id}",
    response_model=FindingDetailResponse,
    summary="Get finding details",
)
async def get_finding(
    finding_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FindingDetailResponse:
    """Get finding details including state transition history."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    finding = await repo.get_by_id(finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingDetailResponse.model_validate(finding)


@router.post(
    "/{finding_id}/acknowledge",
    response_model=FindingResponse,
    summary="Acknowledge a finding",
)
@audit_trail("finding_acknowledged", entity_type="finding")
async def acknowledge_finding(
    finding_id: uuid.UUID,
    body: AcknowledgeFindingRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> FindingResponse:
    """Acknowledge a finding."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    changed_by = body.changed_by if body else None
    finding = await repo.acknowledge(finding_id, changed_by=changed_by)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingResponse.model_validate(finding)


@router.post(
    "/{finding_id}/resolve",
    response_model=FindingResponse,
    summary="Resolve a finding",
)
@audit_trail("finding_resolved", entity_type="finding")
async def resolve_finding(
    finding_id: uuid.UUID,
    body: ResolveFindingRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> FindingResponse:
    """Resolve a finding."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    changed_by = body.changed_by if body else None
    reason = body.reason if body else None
    finding = await repo.resolve(finding_id, changed_by=changed_by, reason=reason)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingResponse.model_validate(finding)


@router.post(
    "/{finding_id}/suppress",
    response_model=FindingResponse,
    summary="Suppress a finding",
)
@audit_trail("finding_suppressed", entity_type="finding")
async def suppress_finding(
    finding_id: uuid.UUID,
    body: SuppressFindingRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> FindingResponse:
    """Suppress a finding with a reason."""
    repo = FindingRepository(session, str(current_user.workspace_id))
    finding = await repo.suppress(finding_id, reason=body.reason, changed_by=body.changed_by)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingResponse.model_validate(finding)
