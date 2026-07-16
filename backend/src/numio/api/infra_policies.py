"""REST API endpoints for infrastructure policy engine."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.audit_service import audit_trail
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.infra_policy_service import InfraPolicyEvaluationService
from numio.db.infra_policy_repository import InfraPolicyRepository
from numio.db.session import get_session
from numio.models.infra_policy import InfraPolicy
from numio.schemas.infra_policy import (
    CreateInfraPolicyRequest,
    InfraPolicyDetailResponse,
    InfraPolicyListResponse,
    InfraPolicyResponse,
    UpdateInfraPolicyRequest,
)

router = APIRouter(prefix="/infra-policies", tags=["infra-policies"])


# --- CRUD ---


@router.post(
    "",
    response_model=InfraPolicyResponse,
    status_code=201,
    summary="Create an infrastructure policy",
)
@audit_trail("policy_created", entity_type="infra_policy")
async def create_policy(
    body: CreateInfraPolicyRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> InfraPolicyResponse:
    repo = InfraPolicyRepository(session, str(current_user.workspace_id))
    policy = await repo.create(body)
    return InfraPolicyResponse.model_validate(policy)


@router.get(
    "",
    response_model=InfraPolicyListResponse,
    summary="List policies with compliance status",
)
async def list_policies(
    policy_type: str | None = Query(default=None, alias="type"),
    is_active: bool | None = Query(default=None),
    is_guardrail: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InfraPolicyListResponse:
    repo = InfraPolicyRepository(session, str(current_user.workspace_id))
    policies, total = await repo.list_all(
        policy_type=policy_type,
        is_active=is_active,
        is_guardrail=is_guardrail,
        limit=limit,
        offset=offset,
    )
    return InfraPolicyListResponse(
        policies=[InfraPolicyResponse.model_validate(p) for p in policies],
        count=total,
    )


@router.get(
    "/{policy_id}",
    response_model=InfraPolicyDetailResponse,
    summary="Get policy detail with current violations",
)
async def get_policy(
    policy_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InfraPolicyDetailResponse:
    workspace_id = str(current_user.workspace_id)
    repo = InfraPolicyRepository(session, workspace_id)
    policy = await repo.get_by_id(policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")

    eval_service = InfraPolicyEvaluationService(session, workspace_id)
    violations = await eval_service.get_violations_for_policy(str(policy_id))

    response_data = InfraPolicyResponse.model_validate(policy).model_dump()
    return InfraPolicyDetailResponse(**response_data, violations=violations)


@router.put(
    "/{policy_id}",
    response_model=InfraPolicyResponse,
    summary="Update a policy",
)
@audit_trail("policy_modified", entity_type="infra_policy", model_class=InfraPolicy)
async def update_policy(
    policy_id: uuid.UUID,
    body: UpdateInfraPolicyRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> InfraPolicyResponse:
    repo = InfraPolicyRepository(session, str(current_user.workspace_id))
    policy = await repo.update(policy_id, body)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return InfraPolicyResponse.model_validate(policy)


@router.delete(
    "/{policy_id}",
    status_code=204,
    summary="Delete a policy",
)
@audit_trail("policy_deleted", entity_type="infra_policy")
async def delete_policy(
    policy_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    workspace_id = str(current_user.workspace_id)
    repo = InfraPolicyRepository(session, workspace_id)
    policy = await repo.get_by_id(policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")

    # Resolve active findings for this policy before deleting
    eval_service = InfraPolicyEvaluationService(session, workspace_id)
    await eval_service.resolve_policy_findings(str(policy_id))

    await repo.delete(policy_id)


@router.post(
    "/{policy_id}/evaluate",
    response_model=InfraPolicyDetailResponse,
    summary="Trigger evaluation for a single policy",
)
async def evaluate_policy(
    policy_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> InfraPolicyDetailResponse:
    """Manually trigger evaluation for a specific policy."""
    workspace_id = str(current_user.workspace_id)
    repo = InfraPolicyRepository(session, workspace_id)
    policy = await repo.get_by_id(policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")

    eval_service = InfraPolicyEvaluationService(session, workspace_id)
    await eval_service.evaluate_policy(policy)

    # Refresh policy to get updated compliance
    policy = await repo.get_by_id(policy_id)
    violations = await eval_service.get_violations_for_policy(str(policy_id))

    response_data = InfraPolicyResponse.model_validate(policy).model_dump()
    return InfraPolicyDetailResponse(**response_data, violations=violations)
