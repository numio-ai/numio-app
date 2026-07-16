"""REST API endpoints for recommendations engine and savings tracking."""

import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.audit_service import audit_trail
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.recommendation_service import RecommendationService
from numio.db.recommendation_repository import RecommendationRepository
from numio.db.session import get_session
from numio.schemas.recommendation import (
    AcceptRecommendationRequest,
    DismissRecommendationRequest,
    ImplementRecommendationRequest,
    RecommendationListResponse,
    RecommendationResponse,
    SavingsSummaryResponse,
    SavingsTimelineResponse,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# --- List / Detail ---


@router.get(
    "",
    response_model=RecommendationListResponse,
    summary="List recommendations",
)
async def list_recommendations(
    category: str | None = Query(default=None, description="Filter by category"),
    status: str | None = Query(default=None, description="Filter by status"),
    sort_by_savings: bool = Query(default=False, description="Sort by estimated savings desc"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationListResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    recs, total = await repo.list_recommendations(
        category=category,
        status=status,
        sort_by_savings=sort_by_savings,
        limit=limit,
        offset=offset,
    )
    return RecommendationListResponse(
        recommendations=[RecommendationResponse.model_validate(r) for r in recs],
        count=total,
    )


@router.get(
    "/savings/summary",
    response_model=SavingsSummaryResponse,
    summary="Get savings summary",
)
async def get_savings_summary(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SavingsSummaryResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    data = await repo.get_savings_summary()
    return SavingsSummaryResponse(**data)


@router.get(
    "/savings/timeline",
    response_model=SavingsTimelineResponse,
    summary="Get savings timeline",
)
async def get_savings_timeline(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SavingsTimelineResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    entries = await repo.get_savings_timeline()
    return SavingsTimelineResponse(entries=entries)


@router.get(
    "/{recommendation_id}",
    response_model=RecommendationResponse,
    summary="Get recommendation detail",
)
async def get_recommendation(
    recommendation_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    rec = await repo.get_by_id(recommendation_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return RecommendationResponse.model_validate(rec)


# --- Lifecycle actions ---


@router.post(
    "/{recommendation_id}/accept",
    response_model=RecommendationResponse,
    summary="Accept a recommendation",
)
@audit_trail("recommendation_accepted", entity_type="recommendation")
async def accept_recommendation(
    recommendation_id: uuid.UUID,
    body: AcceptRecommendationRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    rec = await repo.accept(recommendation_id)
    if rec is None:
        raise HTTPException(
            status_code=404, detail="Recommendation not found or not in 'open' status"
        )
    return RecommendationResponse.model_validate(rec)


@router.post(
    "/{recommendation_id}/dismiss",
    response_model=RecommendationResponse,
    summary="Dismiss a recommendation",
)
@audit_trail("recommendation_dismissed", entity_type="recommendation")
async def dismiss_recommendation(
    recommendation_id: uuid.UUID,
    body: DismissRecommendationRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    rec = await repo.dismiss(recommendation_id)
    if rec is None:
        raise HTTPException(
            status_code=404,
            detail="Recommendation not found or already implemented/dismissed",
        )
    return RecommendationResponse.model_validate(rec)


@router.post(
    "/{recommendation_id}/implement",
    response_model=RecommendationResponse,
    summary="Mark recommendation as implemented",
)
@audit_trail("recommendation_implemented", entity_type="recommendation")
async def implement_recommendation(
    recommendation_id: uuid.UUID,
    body: ImplementRecommendationRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    repo = RecommendationRepository(session, str(current_user.workspace_id))
    rec = await repo.implement(recommendation_id)
    if rec is None:
        raise HTTPException(
            status_code=404,
            detail="Recommendation not found or not in 'open'/'accepted' status",
        )
    return RecommendationResponse.model_validate(rec)


# --- Generation trigger ---


@router.post(
    "/generate",
    summary="Generate recommendations from findings",
)
async def generate_recommendations(
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    service = RecommendationService(session, str(current_user.workspace_id))
    count = await service.generate_recommendations()
    return {"generated": count}
