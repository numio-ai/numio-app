"""REST API endpoints for cloud resource inventory."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.db.session import get_session
from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord
from numio.schemas.cloud_resource import CloudResourceListResponse, CloudResourceResponse

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get(
    "",
    response_model=CloudResourceListResponse,
    summary="List cloud resources",
)
async def list_resources(
    service: str | None = Query(default=None, description="Filter by service (ec2, rds, s3, etc.)"),
    resource_type: str | None = Query(default=None, description="Filter by resource type"),
    account_id: str | None = Query(default=None, description="Filter by AWS account ID"),
    region: str | None = Query(default=None, description="Filter by region"),
    state: str | None = Query(default=None, description="Filter by state"),
    search: str | None = Query(default=None, description="Search by resource ID or name"),
    include_terminated: bool = Query(default=False, description="Include terminated resources"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CloudResourceListResponse:
    """List cloud resources with optional filters."""
    query = select(CloudResource).where(
        CloudResource.workspace_id == str(current_user.workspace_id),
    )

    if not include_terminated:
        query = query.where(CloudResource.terminated_at.is_(None))

    if service:
        query = query.where(CloudResource.service == service)
    if resource_type:
        query = query.where(CloudResource.resource_type == resource_type)
    if account_id:
        query = query.where(CloudResource.account_id == account_id)
    if region:
        query = query.where(CloudResource.region == region)
    if state:
        query = query.where(CloudResource.state == state)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            CloudResource.resource_id.ilike(pattern) | CloudResource.name.ilike(pattern)
        )

    # Count total matching
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    # Fetch page
    query = query.order_by(CloudResource.last_seen_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    resources = result.scalars().all()

    # Build per-resource cost lookup from CUR data
    cost_map: dict[str, float] = {}
    if resources:
        latest_period = await session.execute(
            select(func.max(CostRecord.billing_period)).where(
                CostRecord.workspace_id == str(current_user.workspace_id),
            )
        )
        billing_period = latest_period.scalar_one_or_none()

        if billing_period:
            cost_rows = await session.execute(
                select(
                    CostRecord.resource_id,
                    func.sum(CostRecord.unblended_cost).label("total_cost"),
                )
                .where(
                    CostRecord.workspace_id == str(current_user.workspace_id),
                    CostRecord.billing_period == billing_period,
                    CostRecord.resource_id.isnot(None),
                )
                .group_by(CostRecord.resource_id)
            )
            for row in cost_rows.all():
                if row.resource_id:
                    cost_map[row.resource_id] = float(row.total_cost)

    # Build responses, matching cost by ARN first, then resource_id
    responses = []
    for r in resources:
        cost = None
        if r.arn and r.arn in cost_map:
            cost = cost_map[r.arn]
        elif r.resource_id and r.resource_id in cost_map:
            cost = cost_map[r.resource_id]
        resp = CloudResourceResponse.model_validate(r)
        responses.append(resp.model_copy(update={"cost": cost}))

    return CloudResourceListResponse(resources=responses, count=total)
