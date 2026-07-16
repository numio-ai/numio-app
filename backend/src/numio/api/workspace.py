"""Workspace settings and Andon cord API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.session import get_session
from numio.models.workspace import AutomationToggle, Workspace
from numio.schemas.workspace import (
    AutomationStatusResponse,
    DomainToggleResponse,
    SetDomainToggleRequest,
    SetGlobalToggleRequest,
    UpdateWorkspaceSettingsRequest,
    WorkspaceInfoResponse,
    WorkspaceSettingsResponse,
)

router = APIRouter(prefix="/workspace", tags=["workspace"])


async def _get_workspace(workspace_id, session: AsyncSession) -> Workspace:
    """Load workspace by ID or raise 404."""
    result = await session.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


# ---------------------------------------------------------------------------
# Workspace identity info (ExternalId + Numio principal ARN)
# ---------------------------------------------------------------------------


@router.get("/info", response_model=WorkspaceInfoResponse, summary="Get workspace identity info")
async def get_workspace_info(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceInfoResponse:
    """Return the workspace ExternalId and Numio's own principal ARN.

    Used by the IAM Setup Guide to render the trust policy with real values.
    """
    ws = await _get_workspace(current_user.workspace_id, session)
    return WorkspaceInfoResponse(external_id=ws.external_id)


# ---------------------------------------------------------------------------
# Workspace settings
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=WorkspaceSettingsResponse, summary="Get workspace settings")
async def get_workspace_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceSettingsResponse:
    """Return the current workspace settings."""
    ws = await _get_workspace(current_user.workspace_id, session)
    return WorkspaceSettingsResponse(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        default_currency=ws.default_currency,
        timezone=ws.timezone,
        data_retention_days=ws.data_retention_days,
        automation_paused=ws.automation_paused,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


@router.put(
    "/settings",
    response_model=WorkspaceSettingsResponse,
    summary="Update workspace settings",
)
async def update_workspace_settings(
    body: UpdateWorkspaceSettingsRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceSettingsResponse:
    """Update workspace settings. Admin only."""
    ws = await _get_workspace(current_user.workspace_id, session)

    if body.name is not None:
        ws.name = body.name
    if body.default_currency is not None:
        ws.default_currency = body.default_currency
    if body.timezone is not None:
        ws.timezone = body.timezone
    if body.data_retention_days is not None:
        ws.data_retention_days = body.data_retention_days

    await session.commit()
    await session.refresh(ws)

    return WorkspaceSettingsResponse(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        default_currency=ws.default_currency,
        timezone=ws.timezone,
        data_retention_days=ws.data_retention_days,
        automation_paused=ws.automation_paused,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


# ---------------------------------------------------------------------------
# Andon cord — automation safety toggles
# ---------------------------------------------------------------------------


@router.get("/automation", response_model=AutomationStatusResponse, summary="Get automation status")
async def get_automation_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AutomationStatusResponse:
    """Return global and per-domain automation status."""
    ws = await _get_workspace(current_user.workspace_id, session)
    result = await session.execute(
        select(AutomationToggle).where(AutomationToggle.workspace_id == current_user.workspace_id)
    )
    toggles = list(result.scalars().all())

    return AutomationStatusResponse(
        automation_paused=ws.automation_paused,
        domain_toggles=[DomainToggleResponse(domain=t.domain, paused=t.paused) for t in toggles],
    )


@router.put(
    "/automation/global",
    response_model=AutomationStatusResponse,
    summary="Toggle global automation",
)
async def set_global_toggle(
    body: SetGlobalToggleRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AutomationStatusResponse:
    """Set the global automation pause flag. Admin only."""
    ws = await _get_workspace(current_user.workspace_id, session)
    ws.automation_paused = body.paused
    await session.commit()
    await session.refresh(ws)

    result = await session.execute(
        select(AutomationToggle).where(AutomationToggle.workspace_id == current_user.workspace_id)
    )
    toggles = list(result.scalars().all())

    return AutomationStatusResponse(
        automation_paused=ws.automation_paused,
        domain_toggles=[DomainToggleResponse(domain=t.domain, paused=t.paused) for t in toggles],
    )


@router.put(
    "/automation/domain",
    response_model=AutomationStatusResponse,
    summary="Toggle domain automation",
)
async def set_domain_toggle(
    body: SetDomainToggleRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AutomationStatusResponse:
    """Set a per-domain automation toggle. Creates the toggle if it doesn't exist. Admin only."""
    ws = await _get_workspace(current_user.workspace_id, session)

    result = await session.execute(
        select(AutomationToggle).where(
            AutomationToggle.workspace_id == current_user.workspace_id,
            AutomationToggle.domain == body.domain,
        )
    )
    toggle = result.scalar_one_or_none()

    if toggle is None:
        toggle = AutomationToggle(
            workspace_id=current_user.workspace_id,
            domain=body.domain,
            paused=body.paused,
        )
        session.add(toggle)
    else:
        toggle.paused = body.paused

    await session.commit()

    # Reload all toggles for the response
    all_result = await session.execute(
        select(AutomationToggle).where(AutomationToggle.workspace_id == current_user.workspace_id)
    )
    toggles = list(all_result.scalars().all())

    return AutomationStatusResponse(
        automation_paused=ws.automation_paused,
        domain_toggles=[DomainToggleResponse(domain=t.domain, paused=t.paused) for t in toggles],
    )
