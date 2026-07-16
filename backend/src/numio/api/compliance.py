"""REST API endpoints for compliance audit and reporting."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.compliance_service import run_compliance_audit
from numio.db.compliance_repository import ComplianceRepository
from numio.db.session import get_session
from numio.models.cloud_resource import CloudResource
from numio.models.tag_policy import TagPolicyRule
from numio.schemas.tag_policy import (
    AuditTriggerResponse,
    ComplianceByDimensionResponse,
    ComplianceDimensionScore,
    ComplianceResultResponse,
    ComplianceSummaryResponse,
    ComplianceTrendPoint,
    ComplianceTrendResponse,
    NonCompliantListResponse,
)

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.post(
    "/audit",
    response_model=AuditTriggerResponse,
    status_code=202,
    summary="Trigger compliance audit",
)
async def trigger_audit(
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> AuditTriggerResponse:
    """Run an on-demand compliance audit against all active tag policies."""
    audit_run_id, result_count = await run_compliance_audit(session, str(current_user.workspace_id))
    return AuditTriggerResponse(
        job_run_id=audit_run_id,
        status="completed",
        message=f"Audit completed: {result_count} compliance evaluations",
    )


@router.get(
    "/summary",
    response_model=ComplianceSummaryResponse,
    summary="Get compliance summary",
)
async def get_summary(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ComplianceSummaryResponse:
    """Get the overall compliance summary from the most recent audit run."""
    repo = ComplianceRepository(session, str(current_user.workspace_id))
    overall = await repo.get_latest_snapshot("overall")

    if overall is None:
        return ComplianceSummaryResponse(
            overall=None,
            untagged_spend=0,
            total_resources=0,
            compliant_resources=0,
            non_compliant_resources=0,
        )

    non_compliant = overall.total_resources - overall.compliant_resources
    untagged_spend = overall.total_cost - overall.compliant_cost

    return ComplianceSummaryResponse(
        overall=ComplianceDimensionScore.model_validate(overall),
        untagged_spend=untagged_spend,
        total_resources=overall.total_resources,
        compliant_resources=overall.compliant_resources,
        non_compliant_resources=non_compliant,
    )


@router.get(
    "/by-dimension",
    response_model=ComplianceByDimensionResponse,
    summary="Get compliance by dimension",
)
async def get_by_dimension(
    dimension: str = Query(
        ..., description="Dimension: per_tag, per_policy, per_account, per_resource_type"
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ComplianceByDimensionResponse:
    """Get compliance scores broken down by a specific dimension."""
    valid_dimensions = {"per_tag", "per_policy", "per_account", "per_resource_type"}
    if dimension not in valid_dimensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid dimension. Must be one of: {', '.join(sorted(valid_dimensions))}",
        )

    repo = ComplianceRepository(session, str(current_user.workspace_id))
    snapshots = await repo.get_latest_snapshots_by_dimension(dimension)

    return ComplianceByDimensionResponse(
        dimension=dimension,
        scores=[ComplianceDimensionScore.model_validate(s) for s in snapshots],
    )


@router.get(
    "/non-compliant",
    response_model=NonCompliantListResponse,
    summary="List non-compliant resources",
)
async def list_non_compliant(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    sort_by_cost: bool = Query(default=True),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NonCompliantListResponse:
    """List non-compliant resources from the most recent audit, sorted by cost impact."""
    repo = ComplianceRepository(session, str(current_user.workspace_id))
    results, total_count, total_cost = await repo.get_non_compliant_results(
        limit=limit,
        offset=offset,
        sort_by_cost=sort_by_cost,
    )

    # Enrich results with resource and rule details
    enriched = []
    for r in results:
        resp = ComplianceResultResponse(
            id=r.id,
            resource_id=r.resource_id,
            policy_id=r.policy_id,
            rule_id=r.rule_id,
            status=r.status,
            current_value=r.current_value,
            resource_cost=r.resource_cost,
        )
        # Load resource details
        resource = await session.get(CloudResource, r.resource_id)
        if resource:
            resp.resource_arn = resource.arn
            resp.resource_name = resource.name
            resp.resource_type = f"{resource.service}/{resource.resource_type}"
            resp.account_id = resource.account_id
            resp.service = resource.service
        # Load rule tag name
        rule = await session.get(TagPolicyRule, r.rule_id)
        if rule:
            resp.tag_name = rule.tag_name
        # Load policy name
        from numio.models.tag_policy import TagPolicy

        policy = await session.get(TagPolicy, r.policy_id)
        if policy:
            resp.policy_name = policy.name
        enriched.append(resp)

    return NonCompliantListResponse(
        results=enriched,
        count=total_count,
        total_non_compliant_cost=total_cost,
    )


@router.get(
    "/trend",
    response_model=ComplianceTrendResponse,
    summary="Get compliance trend over time",
)
async def get_trend(
    dimension: str = Query(default="overall"),
    dimension_value: str | None = Query(default=None),
    limit: int = Query(default=90, ge=1, le=365),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ComplianceTrendResponse:
    """Get compliance score trend over time for a specific dimension."""
    repo = ComplianceRepository(session, str(current_user.workspace_id))
    snapshots = await repo.get_trend(dimension, dimension_value, limit)

    return ComplianceTrendResponse(
        dimension=dimension,
        dimension_value=dimension_value,
        trend=[ComplianceTrendPoint.model_validate(s) for s in snapshots],
    )
