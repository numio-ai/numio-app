"""Anomaly threshold configuration API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.anomaly_detection_service import (
    DEFAULT_DRIFT_THRESHOLD_PCT,
    DEFAULT_SIGMA_THRESHOLD,
    DEFAULT_WINDOW_DAYS,
    NATIVE_DIMENSIONS,
)
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.session import get_session
from numio.models.anomaly_threshold import AnomalyThreshold
from numio.schemas.anomaly_threshold import (
    SetThresholdRequest,
    ThresholdListResponse,
    ThresholdResponse,
    ThresholdWithDefault,
)

logger = logging.getLogger("numio.api.anomaly_thresholds")

router = APIRouter(prefix="/anomaly-thresholds", tags=["anomaly-thresholds"])


@router.get("", summary="List anomaly thresholds")
async def list_thresholds(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ThresholdListResponse:
    """Return per-dimension overrides and global defaults for each dimension type."""
    # Build defaults for native dimensions
    defaults = {}
    for dim_type in NATIVE_DIMENSIONS:
        defaults[dim_type] = ThresholdWithDefault(
            dimension_type=dim_type,
            dimension_value="*",
            window_days=DEFAULT_WINDOW_DAYS,
            sigma_threshold=DEFAULT_SIGMA_THRESHOLD,
            drift_threshold_pct=DEFAULT_DRIFT_THRESHOLD_PCT,
            is_override=False,
        )

    # Fetch all overrides for this workspace
    result = await session.execute(
        select(AnomalyThreshold)
        .where(AnomalyThreshold.workspace_id == str(current_user.workspace_id))
        .order_by(AnomalyThreshold.dimension_type, AnomalyThreshold.dimension_value)
    )
    overrides = list(result.scalars().all())

    # Wildcard overrides replace the defaults
    override_responses = []
    for o in overrides:
        if o.dimension_value == "*":
            defaults[o.dimension_type] = ThresholdWithDefault(
                dimension_type=o.dimension_type,
                dimension_value="*",
                window_days=o.window_days,
                sigma_threshold=o.sigma_threshold,
                drift_threshold_pct=o.drift_threshold_pct,
                is_override=True,
            )
        else:
            override_responses.append(ThresholdResponse.model_validate(o))

    return ThresholdListResponse(defaults=defaults, overrides=override_responses)


@router.put(
    "/{dimension_type}/{dimension_value}",
    summary="Set threshold for a dimension",
)
async def set_threshold(
    dimension_type: str,
    dimension_value: str,
    body: SetThresholdRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> ThresholdResponse:
    """Set or update the anomaly detection threshold for a specific dimension.

    Use dimension_value='*' to set the default for an entire dimension type.
    """
    result = await session.execute(
        select(AnomalyThreshold).where(
            AnomalyThreshold.workspace_id == str(current_user.workspace_id),
            AnomalyThreshold.dimension_type == dimension_type,
            AnomalyThreshold.dimension_value == dimension_value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.window_days = body.window_days
        existing.sigma_threshold = body.sigma_threshold
        existing.drift_threshold_pct = body.drift_threshold_pct
    else:
        existing = AnomalyThreshold(
            workspace_id=str(current_user.workspace_id),
            dimension_type=dimension_type,
            dimension_value=dimension_value,
            window_days=body.window_days,
            sigma_threshold=body.sigma_threshold,
            drift_threshold_pct=body.drift_threshold_pct,
        )
        session.add(existing)

    await session.commit()
    await session.refresh(existing)
    return ThresholdResponse.model_validate(existing)


@router.delete(
    "/{dimension_type}/{dimension_value}",
    summary="Delete threshold override",
    status_code=204,
)
async def delete_threshold(
    dimension_type: str,
    dimension_value: str,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a per-dimension threshold override, reverting to defaults."""
    result = await session.execute(
        select(AnomalyThreshold).where(
            AnomalyThreshold.workspace_id == str(current_user.workspace_id),
            AnomalyThreshold.dimension_type == dimension_type,
            AnomalyThreshold.dimension_value == dimension_value,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Threshold override not found")

    await session.delete(existing)
    await session.commit()
