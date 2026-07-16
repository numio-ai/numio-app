"""REST API endpoints for remediation campaigns."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.campaign_service import (
    create_campaign,
    validate_status_transition,
)
from numio.db.campaign_repository import CampaignRepository
from numio.db.session import get_session
from numio.models.cloud_resource import CloudResource
from numio.schemas.campaign import (
    CampaignCreate,
    CampaignDetailResponse,
    CampaignListResponse,
    CampaignProgressResponse,
    CampaignResourceResponse,
    CampaignResponse,
    CampaignUpdate,
    ResourceStatusUpdate,
    StatusCount,
    TagCommandResponse,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

ALL_STATUSES = [
    "pending",
    "notified",
    "fixed",
    "escalated",
    "excluded",
]


def _enrich_resource(cr) -> CampaignResourceResponse:
    """Build response with resource details from the relationship."""
    resp = CampaignResourceResponse(
        id=cr.id,
        resource_id=cr.resource_id,
        remediation_status=cr.remediation_status,
        inferred_owner=cr.inferred_owner,
        violated_rules=cr.violated_rules,
        tag_commands=cr.tag_commands,
        resource_cost=cr.resource_cost,
        status_updated_at=cr.status_updated_at,
        created_at=cr.created_at,
    )
    return resp


@router.post(
    "",
    response_model=CampaignDetailResponse,
    status_code=201,
    summary="Create a remediation campaign",
)
async def create_campaign_endpoint(
    body: CampaignCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> CampaignDetailResponse:
    """Create a campaign targeting non-compliant resources."""
    if body.resource_ids is None and body.filters is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide resource_ids, filters, or both",
        )
    try:
        campaign = await create_campaign(
            session,
            str(current_user.workspace_id),
            body,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CampaignDetailResponse(
        **CampaignResponse.model_validate(campaign).model_dump(),
        resources=[_enrich_resource(cr) for cr in campaign.resources],
    )


@router.get(
    "",
    response_model=CampaignListResponse,
    summary="List remediation campaigns",
)
async def list_campaigns(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CampaignListResponse:
    """List all campaigns with summary info."""
    repo = CampaignRepository(session, str(current_user.workspace_id))
    campaigns, total = await repo.list_all(limit=limit, offset=offset)
    return CampaignListResponse(
        campaigns=[CampaignResponse.model_validate(c) for c in campaigns],
        count=total,
    )


@router.get(
    "/{campaign_id}",
    response_model=CampaignDetailResponse,
    summary="Get campaign details",
)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CampaignDetailResponse:
    """Get campaign with per-resource status and details."""
    repo = CampaignRepository(session, str(current_user.workspace_id))
    campaign = await repo.get_by_id(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    resources = []
    for cr in campaign.resources:
        resp = _enrich_resource(cr)
        # Load resource details
        resource = await session.get(CloudResource, cr.resource_id)
        if resource:
            resp.resource_name = resource.name
            resp.resource_arn = resource.arn
            resp.resource_type = f"{resource.service}/{resource.resource_type}"
            resp.account_id = resource.account_id
            resp.service = resource.service
        resources.append(resp)

    return CampaignDetailResponse(
        **CampaignResponse.model_validate(campaign).model_dump(),
        resources=resources,
    )


@router.patch(
    "/{campaign_id}",
    response_model=CampaignResponse,
    summary="Update campaign metadata",
)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> CampaignResponse:
    """Update campaign name, description, deadline, goal, or status."""
    repo = CampaignRepository(session, str(current_user.workspace_id))
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    campaign = await repo.update(campaign_id, updates)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)


@router.patch(
    "/{campaign_id}/resources/{resource_id}/status",
    response_model=CampaignResourceResponse,
    summary="Update resource remediation status",
)
async def update_resource_status(
    campaign_id: uuid.UUID,
    resource_id: uuid.UUID,
    body: ResourceStatusUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> CampaignResourceResponse:
    """Update a resource's remediation status within a campaign."""
    repo = CampaignRepository(session, str(current_user.workspace_id))

    # Verify campaign exists
    campaign = await repo.get_by_id(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cr = await repo.get_campaign_resource(campaign_id, resource_id)
    if cr is None:
        raise HTTPException(
            status_code=404,
            detail="Resource not found in this campaign",
        )

    # Validate transition
    error = validate_status_transition(
        cr.remediation_status,
        body.status,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)

    now = datetime.now(timezone.utc)
    updated = await repo.update_resource_status(cr, body.status, now)
    return _enrich_resource(updated)


@router.get(
    "/{campaign_id}/progress",
    response_model=CampaignProgressResponse,
    summary="Get campaign progress metrics",
)
async def get_progress(
    campaign_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CampaignProgressResponse:
    """Get campaign progress: status breakdown and compliance delta."""
    repo = CampaignRepository(session, str(current_user.workspace_id))

    campaign = await repo.get_by_id(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    status_counts = await repo.get_progress(campaign_id)
    total = campaign.resource_count or sum(status_counts.values())

    breakdown = []
    for status in ALL_STATUSES:
        count = status_counts.get(status, 0)
        pct = Decimal(count) / Decimal(total) * 100 if total > 0 else Decimal("0")
        breakdown.append(
            StatusCount(
                status=status,
                count=count,
                percentage=pct.quantize(Decimal("0.01")),
            )
        )

    # Current compliance for campaign resources
    total_cost, fixed_cost = await repo.get_campaign_compliance_cost(
        campaign_id,
    )
    current_score = None
    if total_cost > 0:
        current_score = ((fixed_cost / total_cost) * 100).quantize(Decimal("0.0001"))

    return CampaignProgressResponse(
        campaign_id=campaign_id,
        total_resources=total,
        status_breakdown=breakdown,
        before_compliance_score=campaign.before_compliance_score,
        current_compliance_score=current_score,
    )


@router.get(
    "/{campaign_id}/resources/{resource_id}/commands",
    response_model=TagCommandResponse,
    summary="Get CLI commands for a resource",
)
async def get_resource_commands(
    campaign_id: uuid.UUID,
    resource_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagCommandResponse:
    """Get AWS CLI tag commands for a specific campaign resource."""
    repo = CampaignRepository(session, str(current_user.workspace_id))

    cr = await repo.get_campaign_resource(campaign_id, resource_id)
    if cr is None:
        raise HTTPException(
            status_code=404,
            detail="Resource not found in this campaign",
        )

    resource = await session.get(CloudResource, cr.resource_id)
    resource_type = None
    resource_arn = None
    if resource:
        resource_type = f"{resource.service}/{resource.resource_type}"
        resource_arn = resource.arn

    return TagCommandResponse(
        resource_id=resource_id,
        resource_arn=resource_arn,
        resource_type=resource_type,
        commands=cr.tag_commands or [],
    )
