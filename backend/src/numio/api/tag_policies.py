"""REST API endpoints for tag policy management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.session import get_session
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.schemas.tag_policy import (
    TagPolicyCreate,
    TagPolicyListResponse,
    TagPolicyResponse,
    TagPolicyUpdate,
)

router = APIRouter(prefix="/tag-policies", tags=["tag-policies"])


@router.post(
    "",
    response_model=TagPolicyResponse,
    status_code=201,
    summary="Create a tag policy",
)
async def create_policy(
    body: TagPolicyCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> TagPolicyResponse:
    """Create a new tag policy with one or more required tag rules."""
    repo = TagPolicyRepository(session, str(current_user.workspace_id))
    policy = await repo.create(body)
    return TagPolicyResponse.model_validate(policy)


@router.get(
    "",
    response_model=TagPolicyListResponse,
    summary="List tag policies",
)
async def list_policies(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagPolicyListResponse:
    """List all tag policies for the current workspace."""
    repo = TagPolicyRepository(session, str(current_user.workspace_id))
    policies = await repo.list_all()
    return TagPolicyListResponse(
        policies=[TagPolicyResponse.model_validate(p) for p in policies],
        count=len(policies),
    )


@router.get(
    "/{policy_id}",
    response_model=TagPolicyResponse,
    summary="Get tag policy details",
)
async def get_policy(
    policy_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagPolicyResponse:
    """Get a specific tag policy with its rules."""
    repo = TagPolicyRepository(session, str(current_user.workspace_id))
    policy = await repo.get_by_id(policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Tag policy not found")
    return TagPolicyResponse.model_validate(policy)


@router.put(
    "/{policy_id}",
    response_model=TagPolicyResponse,
    summary="Update a tag policy",
)
async def update_policy(
    policy_id: uuid.UUID,
    body: TagPolicyUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> TagPolicyResponse:
    """Update a tag policy. If rules are provided, they replace all existing rules."""
    repo = TagPolicyRepository(session, str(current_user.workspace_id))
    policy = await repo.update(policy_id, body)
    if policy is None:
        raise HTTPException(status_code=404, detail="Tag policy not found")
    return TagPolicyResponse.model_validate(policy)


@router.delete(
    "/{policy_id}",
    status_code=204,
    summary="Delete a tag policy",
)
async def delete_policy(
    policy_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a tag policy and all its rules."""
    repo = TagPolicyRepository(session, str(current_user.workspace_id))
    deleted = await repo.delete(policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tag policy not found")
