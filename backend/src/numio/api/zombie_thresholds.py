"""Zombie/idle detection threshold configuration API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.zombie_detection_service import THRESHOLD_DEFAULTS
from numio.db.session import get_session
from numio.models.zombie_threshold import ZombieThreshold
from numio.schemas.zombie_threshold import (
    SetZombieThresholdRequest,
    ZombieThresholdEntry,
    ZombieThresholdListResponse,
    ZombieThresholdResponse,
)

logger = logging.getLogger("numio.api.zombie_thresholds")

router = APIRouter(prefix="/zombie-thresholds", tags=["zombie-thresholds"])


@router.get("", summary="List zombie/idle detection thresholds")
async def list_thresholds(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ZombieThresholdListResponse:
    """Return current thresholds (defaults merged with any overrides)."""
    result = await session.execute(
        select(ZombieThreshold).where(
            ZombieThreshold.workspace_id == str(current_user.workspace_id)
        )
    )
    overrides = {t.threshold_key: t.threshold_value for t in result.scalars().all()}

    entries = []
    for key, default_value in THRESHOLD_DEFAULTS.items():
        if key in overrides:
            entries.append(ZombieThresholdEntry(key=key, value=overrides[key], is_override=True))
        else:
            entries.append(ZombieThresholdEntry(key=key, value=default_value, is_override=False))

    return ZombieThresholdListResponse(thresholds=entries)


@router.put("/{threshold_key}", summary="Set a zombie/idle detection threshold")
async def set_threshold(
    threshold_key: str,
    body: SetZombieThresholdRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> ZombieThresholdResponse:
    """Set or update a threshold value. Use GET to see valid keys."""
    if threshold_key not in THRESHOLD_DEFAULTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown threshold key: {threshold_key}. "
            f"Valid keys: {list(THRESHOLD_DEFAULTS.keys())}",
        )

    result = await session.execute(
        select(ZombieThreshold).where(
            ZombieThreshold.workspace_id == str(current_user.workspace_id),
            ZombieThreshold.threshold_key == threshold_key,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.threshold_value = body.value
    else:
        existing = ZombieThreshold(
            workspace_id=str(current_user.workspace_id),
            threshold_key=threshold_key,
            threshold_value=body.value,
        )
        session.add(existing)

    await session.commit()
    await session.refresh(existing)
    return ZombieThresholdResponse.model_validate(existing)


@router.delete(
    "/{threshold_key}",
    summary="Reset threshold to default",
    status_code=204,
)
async def delete_threshold(
    threshold_key: str,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a threshold override, reverting to the default value."""
    result = await session.execute(
        select(ZombieThreshold).where(
            ZombieThreshold.workspace_id == str(current_user.workspace_id),
            ZombieThreshold.threshold_key == threshold_key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Threshold override not found")

    await session.delete(existing)
    await session.commit()
