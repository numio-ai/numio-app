"""REST API endpoints for budget management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.audit_service import audit_trail
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.budget_evaluation_service import BudgetEvaluationService
from numio.db.budget_repository import BudgetRepository
from numio.db.finding_repository import FindingRepository
from numio.db.session import get_session
from numio.models.budget import Budget
from numio.schemas.budget import (
    BudgetDetailResponse,
    BudgetListResponse,
    BudgetResponse,
    CreateBudgetRequest,
    UpdateBudgetRequest,
)
from numio.schemas.finding import FindingListResponse, FindingResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])


# --- CRUD ---


@router.post(
    "",
    response_model=BudgetResponse,
    status_code=201,
    summary="Create a budget",
)
@audit_trail("budget_created", entity_type="budget")
async def create_budget(
    body: CreateBudgetRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    repo = BudgetRepository(session, str(current_user.workspace_id))
    budget = await repo.create(body)
    return BudgetResponse.model_validate(budget)


@router.get(
    "",
    response_model=BudgetListResponse,
    summary="List budgets with current status",
)
async def list_budgets(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetListResponse:
    """List all budgets with live spend-vs-budget status."""
    workspace_id = str(current_user.workspace_id)
    repo = BudgetRepository(session, workspace_id)
    eval_service = BudgetEvaluationService(session, workspace_id)
    budgets, total = await repo.list_all(limit=limit, offset=offset)

    details = []
    for budget in budgets:
        detail = await eval_service.evaluate_budget(budget)
        details.append(detail)

    return BudgetListResponse(budgets=details, count=total)


@router.get(
    "/{budget_id}",
    response_model=BudgetDetailResponse,
    summary="Get budget detail with spend data",
)
async def get_budget(
    budget_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetDetailResponse:
    """Get budget detail including current spend, burn rate, projection, and cost drivers."""
    workspace_id = str(current_user.workspace_id)
    repo = BudgetRepository(session, workspace_id)
    budget = await repo.get_by_id(budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")

    eval_service = BudgetEvaluationService(session, workspace_id)
    return await eval_service.evaluate_budget(budget)


@router.put(
    "/{budget_id}",
    response_model=BudgetResponse,
    summary="Update a budget",
)
@audit_trail("budget_modified", entity_type="budget", model_class=Budget)
async def update_budget(
    budget_id: uuid.UUID,
    body: UpdateBudgetRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    repo = BudgetRepository(session, str(current_user.workspace_id))
    budget = await repo.update(budget_id, body)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    return BudgetResponse.model_validate(budget)


@router.delete(
    "/{budget_id}",
    status_code=204,
    summary="Delete a budget",
)
@audit_trail("budget_deleted", entity_type="budget")
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    repo = BudgetRepository(session, str(current_user.workspace_id))
    deleted = await repo.delete(budget_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget not found")


# --- Budget alerts ---


@router.get(
    "/{budget_id}/alerts",
    response_model=FindingListResponse,
    summary="Get alerts for a budget",
)
async def get_budget_alerts(
    budget_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FindingListResponse:
    """Get findings/alerts generated for a specific budget."""
    workspace_id = str(current_user.workspace_id)
    budget_repo = BudgetRepository(session, workspace_id)
    budget = await budget_repo.get_by_id(budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")

    finding_repo = FindingRepository(session, workspace_id)
    # Budget alerts use resource_id prefix "budget:{id}:"
    findings, total = await finding_repo.list_findings(
        detection_source="budget_evaluation",
        resource_id=f"budget:{budget_id}:threshold",
        limit=limit,
        offset=offset,
    )
    # Also get projection findings
    proj_findings, proj_total = await finding_repo.list_findings(
        detection_source="budget_evaluation",
        resource_id=f"budget:{budget_id}:projection",
        limit=limit,
        offset=offset,
    )

    all_findings = findings + proj_findings
    all_findings.sort(key=lambda f: f.detected_at, reverse=True)
    combined = all_findings[:limit]

    return FindingListResponse(
        findings=[FindingResponse.model_validate(f) for f in combined],
        count=total + proj_total,
    )
