"""Cost Explorer pass-through API endpoints.

Proxies requests to AWS Cost Explorer API via STS AssumeRole.
Responses are cached in ValKey when available.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core import cache
from numio.core.auth import AuthenticatedUser, get_current_user
from numio.core.cost_explorer_service import CostExplorerError, get_cost_by_region
from numio.core.cost_explorer_service import get_cost_by_service as ce_get_cost_by_service
from numio.core.cost_explorer_service import get_cost_by_tag as ce_get_cost_by_tag
from numio.core.cost_explorer_service import get_tags as ce_get_tags
from numio.core.cost_explorer_service import get_total_cost as ce_get_total_cost
from numio.db.session import get_session
from numio.models.aws_account import AwsAccount
from numio.schemas.cost_explorer import (
    CostByRegionResponse,
    CostByServiceResponse,
    CostByTagResponse,
    Granularity,
    TagsResponse,
    TotalCostResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cost-explorer", tags=["cost-explorer"])


async def _get_role_arn(account_id: str, workspace_id: str, session: AsyncSession) -> str:
    """Look up the role ARN for an AWS account ID."""
    result = await session.execute(
        select(AwsAccount).where(
            AwsAccount.aws_account_id == account_id,
            AwsAccount.workspace_id == workspace_id,
            AwsAccount.status != "inactive",
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")
    return account.role_arn


def _handle_ce_error(e: CostExplorerError):
    """Convert CostExplorerError to HTTPException."""
    raise HTTPException(status_code=e.status_code, detail=str(e))


@router.get("/cost-by-service", summary="Cost breakdown by AWS service")
async def cost_by_service(
    account_id: str = Query(description="AWS account ID"),
    start_date: date = Query(description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(description="End date (YYYY-MM-DD)"),
    granularity: Granularity = Query(default=Granularity.DAILY),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CostByServiceResponse:
    workspace_id = str(current_user.workspace_id)
    role_arn = await _get_role_arn(account_id, workspace_id, session)

    cache_key = cache.make_cache_key(
        workspace_id,
        account_id,
        "cost-by-service",
        {"start": str(start_date), "end": str(end_date), "granularity": granularity.value},
    )
    cached = cache.cache_get(cache_key)
    if cached is not None:
        return CostByServiceResponse(**cached)

    try:
        data = await ce_get_cost_by_service(role_arn, start_date, end_date, granularity.value)
    except CostExplorerError as e:
        _handle_ce_error(e)

    response = CostByServiceResponse(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity.value,
        data=data,
    )
    cache.cache_set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/cost-by-region", summary="Cost breakdown by AWS region")
async def cost_by_region(
    account_id: str = Query(description="AWS account ID"),
    start_date: date = Query(description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(description="End date (YYYY-MM-DD)"),
    granularity: Granularity = Query(default=Granularity.DAILY),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CostByRegionResponse:
    workspace_id = str(current_user.workspace_id)
    role_arn = await _get_role_arn(account_id, workspace_id, session)

    cache_key = cache.make_cache_key(
        workspace_id,
        account_id,
        "cost-by-region",
        {"start": str(start_date), "end": str(end_date), "granularity": granularity.value},
    )
    cached = cache.cache_get(cache_key)
    if cached is not None:
        return CostByRegionResponse(**cached)

    try:
        data = await get_cost_by_region(role_arn, start_date, end_date, granularity.value)
    except CostExplorerError as e:
        _handle_ce_error(e)

    response = CostByRegionResponse(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity.value,
        data=data,
    )
    cache.cache_set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/cost-by-tag", summary="Cost breakdown by tag key")
async def cost_by_tag(
    account_id: str = Query(description="AWS account ID"),
    start_date: date = Query(description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(description="End date (YYYY-MM-DD)"),
    tag_key: str = Query(description="Tag key to group by"),
    granularity: Granularity = Query(default=Granularity.DAILY),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CostByTagResponse:
    workspace_id = str(current_user.workspace_id)
    role_arn = await _get_role_arn(account_id, workspace_id, session)

    cache_key = cache.make_cache_key(
        workspace_id,
        account_id,
        "cost-by-tag",
        {
            "start": str(start_date),
            "end": str(end_date),
            "tag_key": tag_key,
            "granularity": granularity.value,
        },
    )
    cached = cache.cache_get(cache_key)
    if cached is not None:
        return CostByTagResponse(**cached)

    try:
        data = await ce_get_cost_by_tag(role_arn, start_date, end_date, tag_key, granularity.value)
    except CostExplorerError as e:
        _handle_ce_error(e)

    response = CostByTagResponse(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        tag_key=tag_key,
        granularity=granularity.value,
        data=data,
    )
    cache.cache_set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/tags", summary="List available tag keys")
async def list_tags(
    account_id: str = Query(description="AWS account ID"),
    start_date: date = Query(description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(description="End date (YYYY-MM-DD)"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagsResponse:
    workspace_id = str(current_user.workspace_id)
    role_arn = await _get_role_arn(account_id, workspace_id, session)

    cache_key = cache.make_cache_key(
        workspace_id,
        account_id,
        "tags",
        {"start": str(start_date), "end": str(end_date)},
    )
    cached = cache.cache_get(cache_key)
    if cached is not None:
        return TagsResponse(**cached)

    try:
        tags = await ce_get_tags(role_arn, start_date, end_date)
    except CostExplorerError as e:
        _handle_ce_error(e)

    response = TagsResponse(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        tags=tags,
    )
    cache.cache_set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/total", summary="Total cost time series")
async def total_cost(
    account_id: str = Query(description="AWS account ID"),
    start_date: date = Query(description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(description="End date (YYYY-MM-DD)"),
    granularity: Granularity = Query(default=Granularity.DAILY),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TotalCostResponse:
    workspace_id = str(current_user.workspace_id)
    role_arn = await _get_role_arn(account_id, workspace_id, session)

    cache_key = cache.make_cache_key(
        workspace_id,
        account_id,
        "total",
        {"start": str(start_date), "end": str(end_date), "granularity": granularity.value},
    )
    cached = cache.cache_get(cache_key)
    if cached is not None:
        return TotalCostResponse(**cached)

    try:
        data = await ce_get_total_cost(role_arn, start_date, end_date, granularity.value)
    except CostExplorerError as e:
        _handle_ce_error(e)

    response = TotalCostResponse(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity.value,
        data=data,
    )
    cache.cache_set(cache_key, response.model_dump(mode="json"))
    return response
