"""REST API endpoints for cost attribution rules."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.attribution_rule_repository import AttributionRuleRepository
from numio.db.session import get_session
from numio.schemas.attribution import (
    AttributionRuleCreate,
    AttributionRuleListResponse,
    AttributionRuleResponse,
    AttributionRuleUpdate,
)

router = APIRouter(prefix="/attribution-rules", tags=["attribution"])


@router.post(
    "",
    response_model=AttributionRuleResponse,
    status_code=201,
    summary="Create an attribution rule",
)
async def create_rule(
    body: AttributionRuleCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> AttributionRuleResponse:
    """Create a new cost attribution rule.

    Tag-based rules map a tag key to a dimension value.
    Account-based rules map account IDs to a dimension value.
    """
    _validate_mapping_config(body)
    repo = AttributionRuleRepository(session, str(current_user.workspace_id))
    rule = await repo.create(body)
    return AttributionRuleResponse.model_validate(rule)


@router.get(
    "",
    response_model=AttributionRuleListResponse,
    summary="List attribution rules",
)
async def list_rules(
    dimension: str | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttributionRuleListResponse:
    """List all attribution rules, optionally filtered by dimension."""
    repo = AttributionRuleRepository(session, str(current_user.workspace_id))
    if dimension:
        rules = await repo.list_by_dimension(dimension)
    else:
        rules = await repo.list_all()
    return AttributionRuleListResponse(
        rules=[AttributionRuleResponse.model_validate(r) for r in rules],
        count=len(rules),
    )


@router.get(
    "/{rule_id}",
    response_model=AttributionRuleResponse,
    summary="Get an attribution rule",
)
async def get_rule(
    rule_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttributionRuleResponse:
    """Get details for a specific attribution rule."""
    repo = AttributionRuleRepository(session, str(current_user.workspace_id))
    rule = await repo.get_by_id(rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Attribution rule not found")
    return AttributionRuleResponse.model_validate(rule)


@router.put(
    "/{rule_id}",
    response_model=AttributionRuleResponse,
    summary="Update an attribution rule",
)
async def update_rule(
    rule_id: uuid.UUID,
    body: AttributionRuleUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> AttributionRuleResponse:
    """Update an existing attribution rule."""
    repo = AttributionRuleRepository(session, str(current_user.workspace_id))
    rule = await repo.update(rule_id, body)
    if rule is None:
        raise HTTPException(status_code=404, detail="Attribution rule not found")
    return AttributionRuleResponse.model_validate(rule)


@router.delete(
    "/{rule_id}",
    status_code=204,
    summary="Delete an attribution rule",
)
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete an attribution rule."""
    repo = AttributionRuleRepository(session, str(current_user.workspace_id))
    deleted = await repo.delete(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Attribution rule not found")


def _validate_mapping_config(data: AttributionRuleCreate) -> None:
    """Validate mapping_config structure based on source_type."""
    config = data.mapping_config
    if data.source_type.value == "tag":
        if "tag_key" not in config or not isinstance(config["tag_key"], str):
            raise HTTPException(
                status_code=422,
                detail="Tag-based rules require mapping_config.tag_key (string)",
            )
    elif data.source_type.value == "account":
        if "account_ids" not in config or not isinstance(config["account_ids"], list):
            raise HTTPException(
                status_code=422,
                detail="Account-based rules require mapping_config.account_ids (list)",
            )
        if "dimension_value" not in config or not isinstance(config["dimension_value"], str):
            raise HTTPException(
                status_code=422,
                detail="Account-based rules require mapping_config.dimension_value (string)",
            )
