"""REST API endpoints for applying AWS resource tag changes."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.aws_org_tag_policy_service import detect_schema_conflicts
from numio.core.tag_risk import assess_risk
from numio.core.tag_write_service import (
    MAX_CHANGES,
    BulkLimitExceeded,
    TagChange,
    apply_tag_changes,
)
from numio.db.session import get_session
from numio.models.cloud_resource import CloudResource
from numio.schemas.aws_org_tag_policy import ConflictListResponse
from numio.schemas.responses import ErrorResponse
from numio.schemas.tag_apply import (
    AffectedResource,
    TagApplyChange,
    TagApplyPreviewRequest,
    TagApplyPreviewResponse,
    TagApplyRequest,
    TagApplyResultResponse,
)

router = APIRouter(prefix="/tags", tags=["tags"])


def _coded_error(request: Request, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(
        error_code=code,
        message=message,
        request_id=getattr(request.state, "request_id", ""),
    )
    return JSONResponse(status_code=400, content=body.model_dump())


def _dedupe(changes: list[TagApplyChange]) -> list[TagApplyChange]:
    """Keep the last change per (resource_id, tag_key) — the service does not dedupe."""
    seen: dict[tuple, TagApplyChange] = {}
    for c in changes:
        seen[(c.resource_id, c.tag_key)] = c
    return list(seen.values())


async def _load_resources(
    session: AsyncSession, workspace_id: str, changes: list[TagApplyChange]
) -> dict:
    ids = list({c.resource_id for c in changes})
    rows = (
        await session.execute(
            select(CloudResource).where(
                CloudResource.workspace_id == workspace_id,
                CloudResource.id.in_(ids),
            )
        )
    ).scalars().all()
    return {r.id: r for r in rows}


def _operation_type(changes: list[TagApplyChange]) -> str:
    return "tag_remove" if all(c.value is None for c in changes) else "tag_apply"


@router.post(
    "/apply/preview",
    response_model=TagApplyPreviewResponse,
    summary="Preview a tag apply — returns risky flag, reasons, and affected resources",
)
async def preview_tag_apply(
    body: TagApplyPreviewRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagApplyPreviewResponse:
    workspace_id = str(current_user.workspace_id)
    changes = _dedupe(body.changes)
    by_id = await _load_resources(session, workspace_id, changes)
    resources = list(by_id.values())

    risk = await assess_risk(session, workspace_id, resources)

    affected = [
        AffectedResource(
            resource_id=r.id,
            arn=r.arn,
            name=r.name,
            env=(r.tags or {}).get("env"),
            monthly_cost=risk.cost_by_resource_id.get(r.id, 0.0),
        )
        for r in resources
    ]
    return TagApplyPreviewResponse(
        risky=risk.risky, reasons=risk.reasons, affected_resources=affected
    )


@router.post(
    "/apply",
    response_model=TagApplyResultResponse,
    summary="Apply tag changes to AWS resources",
)
async def apply_tags(
    body: TagApplyRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
):
    workspace_id = str(current_user.workspace_id)
    changes = _dedupe(body.changes)

    # Reject empty-string values — callers mean "remove" (value=null), not set "".
    for c in changes:
        if c.value == "":
            return _coded_error(
                request,
                "INVALID_TAG_VALUE",
                f"Tag '{c.tag_key}' has an empty value. Use null to remove a tag.",
            )

    if len(changes) > MAX_CHANGES:
        return _coded_error(
            request,
            "BULK_LIMIT_EXCEEDED",
            f"{len(changes)} changes exceeds the {MAX_CHANGES}-per-operation limit",
        )

    by_id = await _load_resources(session, workspace_id, changes)
    resources = list(by_id.values())
    risk = await assess_risk(session, workspace_id, resources)
    if risk.risky and not body.confirm_risky:
        reasons = "; ".join(risk.reasons)
        return _coded_error(
            request,
            "RISKY_WRITE_NOT_CONFIRMED",
            f"This write is risky ({reasons}). Resubmit with confirm_risky=true.",
        )

    try:
        result = await apply_tag_changes(
            session,
            workspace_id,
            [TagChange(c.resource_id, c.tag_key, c.value) for c in changes],
            actor=current_user.email,
            rationale=body.rationale,
            operation_type=_operation_type(changes),
        )
    except BulkLimitExceeded as e:
        return _coded_error(request, "BULK_LIMIT_EXCEEDED", str(e))

    return TagApplyResultResponse(
        event_id=result.event_id, status=result.status, summary=result.summary
    )


@router.get(
    "/schema/conflicts",
    response_model=ConflictListResponse,
    summary="List schema conflicts between Numio tag policies and the AWS Org tag policy",
)
async def list_schema_conflicts(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ConflictListResponse:
    conflicts = await detect_schema_conflicts(session, str(current_user.workspace_id))
    return ConflictListResponse(conflicts=conflicts, count=len(conflicts))
