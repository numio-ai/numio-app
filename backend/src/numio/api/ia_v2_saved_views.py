"""IA v2 saved-views REST API.

Scaffold-only. Returns realistic fixtures so the frontend can flip from its
local mock store to real HTTP calls. Persistence (alembic migration +
SQLAlchemy model + repository) is deferred to a follow-up task; the API
contract is what the frontend depends on.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_saved_views import (
    CreateSavedViewRequest,
    SavedViewListResponse,
    SavedViewResponse,
    SavedViewScope,
    UpdateSavedViewRequest,
)

router = APIRouter(prefix="/saved-views", tags=["ia-v2-saved-views"])


def _fixture_view(
    *,
    workspace_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    scope: SavedViewScope,
    name: str,
    query_json: dict | None = None,
    shared: bool = False,
    is_default: bool = False,
) -> SavedViewResponse:
    now = datetime.now(timezone.utc)
    return SavedViewResponse(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        owner_user_id=owner_user_id,
        scope=scope,
        name=name,
        query_json=query_json or {},
        default_for_owner=is_default,
        shared_at_workspace=shared,
        created_at=now,
        updated_at=now,
    )


def _seed_views_for(user: AuthenticatedUser, scope: SavedViewScope) -> list[SavedViewResponse]:
    """Return a small canned set of views for the given scope.

    Frontend tests can flip individual flags by calling POST then GET.
    """
    workspace_id = user.workspace_id
    owner_user_id = user.id
    seeds: dict[SavedViewScope, list[tuple[str, dict, bool, bool]]] = {
        SavedViewScope.usage: [
            ("By cost-center · prod", {"scope": "cloud", "groupBy": "tag:cost-center"}, True, True),
            ("By team", {"scope": "cloud", "groupBy": "tag:team"}, False, False),
            ("By environment", {"scope": "cloud", "groupBy": "tag:env"}, True, False),
        ],
        SavedViewScope.resources: [
            ("All resources", {}, True, True),
            ("Orphans (waste)", {"status": "orphans"}, True, False),
        ],
        SavedViewScope.tag_governance: [
            ("Resources missing required tags", {"status": "missing-req"}, True, True),
            ("Drift (invalid values)", {"status": "drift"}, True, False),
        ],
        SavedViewScope.recommendations: [
            ("All recommendations", {}, True, True),
            ("Zombie Hunter", {"categories": ["Idle resource", "Orphan reclaim"]}, True, False),
        ],
        SavedViewScope.autopilot: [],
        SavedViewScope.budgets: [
            ("All teams", {}, True, True),
            ("Teams at risk", {"status": "at-risk"}, True, False),
        ],
        SavedViewScope.policies: [
            ("All policies", {}, True, True),
            ("With open violations", {"hasViolations": True}, True, False),
        ],
    }
    return [
        _fixture_view(
            workspace_id=workspace_id,
            owner_user_id=owner_user_id,
            scope=scope,
            name=name,
            query_json=query,
            shared=shared,
            is_default=is_default,
        )
        for (name, query, shared, is_default) in seeds.get(scope, [])
    ]


@router.get("", response_model=SavedViewListResponse, summary="List saved views by scope")
async def list_saved_views(
    scope: SavedViewScope = Query(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SavedViewListResponse:
    views = _seed_views_for(current_user, scope)
    return SavedViewListResponse(views=views, count=len(views))


@router.post(
    "",
    response_model=SavedViewResponse,
    status_code=201,
    summary="Create a saved view",
)
async def create_saved_view(
    body: CreateSavedViewRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SavedViewResponse:
    return _fixture_view(
        workspace_id=current_user.workspace_id,
        owner_user_id=current_user.id,
        scope=body.scope,
        name=body.name,
        query_json=body.query_json,
        shared=body.shared_at_workspace,
        is_default=body.default_for_owner,
    )


@router.patch(
    "/{view_id}",
    response_model=SavedViewResponse,
    summary="Update a saved view (rename, share toggle, default toggle)",
)
async def update_saved_view(
    view_id: uuid.UUID,
    body: UpdateSavedViewRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SavedViewResponse:
    base = _fixture_view(
        workspace_id=current_user.workspace_id,
        owner_user_id=current_user.id,
        scope=SavedViewScope.usage,
        name=body.name or "Untitled view",
        query_json=body.query_json,
        shared=bool(body.shared_at_workspace),
        is_default=bool(body.default_for_owner),
    )
    return base.model_copy(update={"id": view_id})


@router.delete(
    "/{view_id}",
    status_code=204,
    summary="Delete a saved view (owner only)",
)
async def delete_saved_view(
    view_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> None:
    return None


@router.post(
    "/{view_id}/set-default",
    response_model=SavedViewResponse,
    summary="Mark a view as the caller's default for its scope",
)
async def set_default_saved_view(
    view_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SavedViewResponse:
    return _fixture_view(
        workspace_id=current_user.workspace_id,
        owner_user_id=current_user.id,
        scope=SavedViewScope.usage,
        name="Default view",
        is_default=True,
    ).model_copy(update={"id": view_id})
