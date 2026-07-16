"""REST API endpoints for cost views — attributed cost queries."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.core.cost_attribution_service import CostAttributionService
from numio.db.session import get_session
from numio.schemas.attribution import (
    CostByDimensionResponse,
    CostTimeSeriesResponse,
    Granularity,
    SignificantChangesResponse,
    TotalCostResponse,
    TrendPeriod,
    TrendResponse,
)

router = APIRouter(prefix="/cost-views", tags=["cost-views"])


@router.get(
    "/total",
    response_model=TotalCostResponse,
    summary="Total spend with time buckets",
)
async def get_total_cost(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (exclusive)"),
    account: str | None = Query(default=None, description="Filter by AWS account ID"),
    granularity: Granularity = Query(default=Granularity.daily),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TotalCostResponse:
    """Get total spend with time buckets for the given date range."""
    svc = CostAttributionService(session, str(current_user.workspace_id))
    return await svc.get_total_cost(start_date, end_date, account, granularity)


@router.get(
    "/by-dimension",
    response_model=CostByDimensionResponse,
    summary="Spend grouped by dimension",
)
async def get_cost_by_dimension(
    dimension: str = Query(
        ..., description="Dimension to group by (e.g., team, project, environment)"
    ),
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (exclusive)"),
    account: str | None = Query(default=None, description="Filter by AWS account ID"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CostByDimensionResponse:
    """Get spend grouped by a business dimension using attribution rules."""
    svc = CostAttributionService(session, str(current_user.workspace_id))
    return await svc.get_cost_by_dimension(dimension, start_date, end_date, account)


@router.get(
    "/time-series",
    response_model=CostTimeSeriesResponse,
    summary="Spend over time",
)
async def get_cost_time_series(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (exclusive)"),
    granularity: Granularity = Query(default=Granularity.daily),
    dimension: str | None = Query(default=None, description="Optional dimension breakdown"),
    account: str | None = Query(default=None, description="Filter by AWS account ID"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CostTimeSeriesResponse:
    """Get spend over time with optional dimension breakdown."""
    svc = CostAttributionService(session, str(current_user.workspace_id))
    return await svc.get_cost_time_series(start_date, end_date, granularity, dimension, account)


@router.get(
    "/trends",
    response_model=TrendResponse,
    summary="Period-over-period trend analysis",
)
async def get_trends(
    dimension: str = Query(..., description="Dimension to analyze trends for"),
    period: TrendPeriod = Query(..., description="Comparison period (day, week, month)"),
    end_date: date | None = Query(default=None, description="End date (defaults to today)"),
    account: str | None = Query(default=None, description="Filter by AWS account ID"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TrendResponse:
    """Get period-over-period cost trends by dimension.

    Compares current partial period against the equivalent partial window
    of the previous period (e.g., first 15 days of this month vs first 15
    days of last month).
    """
    svc = CostAttributionService(session, str(current_user.workspace_id))
    return await svc.get_trends(dimension, period, end_date, account)


@router.get(
    "/significant-changes",
    response_model=SignificantChangesResponse,
    summary="Significant cost changes",
)
async def get_significant_changes(
    dimension: str = Query(..., description="Dimension to check"),
    period: TrendPeriod = Query(..., description="Comparison period"),
    end_date: date | None = Query(default=None, description="End date (defaults to today)"),
    account: str | None = Query(default=None, description="Filter by AWS account ID"),
    percentage_threshold: Decimal = Query(default=Decimal("20"), ge=0, description="Min % change"),
    absolute_threshold: Decimal = Query(default=Decimal("100"), ge=0, description="Min $ change"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SignificantChangesResponse:
    """Identify dimensions with cost changes exceeding both percentage and absolute thresholds."""
    svc = CostAttributionService(session, str(current_user.workspace_id))
    return await svc.get_significant_changes(
        dimension, period, end_date, account, percentage_threshold, absolute_threshold
    )
