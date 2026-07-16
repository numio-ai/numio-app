"""REST API for AWS onboarding — CloudFormation tenant-template generator."""

from __future__ import annotations

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, require_role
from numio.core.config import settings
from numio.db.onboarding_in_progress_repository import OnboardingInProgressRepository
from numio.db.session import get_session
from numio.models.onboarding_in_progress import PERSISTED_STEPS
from numio.models.workspace import Workspace
from numio.onboarding.cfn_template import (
    DEFAULT_REGION,
    LABEL_EXAMPLE,
    LABEL_HELP_TEXT,
    LABEL_REGEX_STR,
    CurMode,
    LabelValidationError,
    TemplateParameters,
    build_launch_url,
    cur_bucket_name_for,
    cur_report_name_for,
    render_template,
    stack_name_for,
    validate_label,
)
from numio.schemas.responses import ErrorDetail, ErrorResponse

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# AWS region names look like us-east-1, eu-west-3, ap-southeast-2, etc.
_REGION_RE = re.compile(r"^[a-z]{2}-[a-z]+-\d$")


class CfnTemplateResponse(BaseModel):
    """Payload returned by ``GET /onboarding/cfn-template``."""

    stack_name: str = Field(..., description="Recommended CloudFormation stack name.")
    region: str = Field(..., description="AWS region the launch URL targets.")
    external_id: str = Field(..., description="Workspace external id embedded in the template.")
    label: str = Field(..., description="Per-instance label embedded in IAM names and tags.")
    template_format: str = Field("yaml", description="Template body format.")
    template_body: str = Field(..., description="CloudFormation template as a YAML string.")
    launch_url: str = Field(..., description="Click-through AWS Console URL.")
    launch_mode: str = Field(
        ...,
        description=(
            "'quickcreate' when the URL pre-loads the template via templateURL; "
            "'upload' when the user must upload the downloaded file manually."
        ),
    )
    download_url: str = Field(
        ...,
        description=(
            "Relative path the frontend should call to download the template as a .yaml file."
        ),
    )


class OnboardingFeaturesResponse(BaseModel):
    """Surface server-side feature flags so the UI can gate methods."""

    chat_enabled: bool = Field(..., description="Whether the Chat onboarding method is enabled.")


def _public_template_url(
    region: str, label: str, cur_mode: str, enable_tag_writes: bool
) -> str | None:
    """Return the publicly fetchable template URL, or ``None`` if not configured.

    AWS CloudFormation's quick-create URL fetches ``templateURL`` server-side,
    so the URL must be reachable from AWS, not just from the user's browser.
    When ``settings.public_base_url`` is empty (typical in local dev) we fall
    back to the manual-upload launch mode.
    """
    if not settings.public_base_url:
        return None
    base = settings.public_base_url.rstrip("/")
    return (
        f"{base}/api/v1/onboarding/cfn-template/download"
        f"?region={region}&label={label}&cur_mode={cur_mode}"
        f"&enable_tag_writes={'true' if enable_tag_writes else 'false'}"
    )


def _normalize_region(region: str | None) -> str:
    if region is None or region == "":
        return DEFAULT_REGION
    if not _REGION_RE.match(region):
        return DEFAULT_REGION
    return region


def _coerce_cur_mode(value: str | None) -> CurMode:
    """Map the query-string value to the typed ``CurMode`` literal.

    Empty / unrecognised values fall back to ``existing`` so the legacy
    callers (no ``cur_mode`` in the URL) keep their current behaviour.
    """
    if value == "create_new":
        return "create_new"
    return "existing"


def _resolve_create_new_region(region: str) -> str:
    """In create_new mode the region is locked to us-east-1.

    AWS Data Exports / CUR 2.0 is a us-east-1-only service, and the
    bucket policy this template emits embeds the region in its
    ``aws:SourceArn`` condition. Surfacing 422 here is friendlier than
    letting CloudFormation fail mid-stack-create.
    """
    if region != DEFAULT_REGION:
        raise HTTPException(
            status_code=422,
            detail=(
                f"cur_mode='create_new' requires region='{DEFAULT_REGION}'. "
                f"AWS Data Exports / CUR 2.0 is only available in {DEFAULT_REGION}."
            ),
        )
    return region


def _build_template_params(
    *,
    external_id: str,
    label: str,
    cur_mode: CurMode,
    cur_bucket_name: str,
    cur_report_name: str,
    cur_path_prefix: str,
    enable_tag_writes: bool = False,
) -> TemplateParameters:
    """Compose ``TemplateParameters``, defaulting CUR fields in create_new mode.

    In create_new mode the caller may either accept Numio's defaults
    (``numio-cur-<label>`` for bucket and report, ``daily`` for prefix) or
    override any of them. Empty strings fall back to the defaults so the
    IAM read policy, the auto-provisioned bucket, and the Data Export all
    agree. In existing mode the values are passed through untouched.
    """
    if cur_mode == "create_new":
        return TemplateParameters(
            external_id=external_id,
            label=label,
            cur_bucket_name=cur_bucket_name or cur_bucket_name_for(label),
            cur_report_name=cur_report_name or cur_report_name_for(label),
            cur_path_prefix=cur_path_prefix or "daily",
            cur_mode="create_new",
            enable_tag_writes=enable_tag_writes,
        )
    return TemplateParameters(
        external_id=external_id,
        label=label,
        cur_bucket_name=cur_bucket_name,
        cur_report_name=cur_report_name,
        cur_path_prefix=cur_path_prefix or "cur",
        cur_mode="existing",
        enable_tag_writes=enable_tag_writes,
    )


async def label_validation_handler(request: Request, exc: LabelValidationError) -> JSONResponse:
    """Convert a ``LabelValidationError`` into the project's 422 response shape.

    The body must explain (per the bug-fix acceptance criteria) why the
    label is needed, what format is allowed, and give an example — both for
    a UI showing it inline and for an operator hitting the API directly
    without reading the source.
    """
    detail_message = f"Label must match {exc.pattern} (e.g. {exc.example!r}). {exc.help}"
    body = ErrorResponse(
        error_code="VALIDATION_ERROR",
        message=detail_message,
        request_id=getattr(request.state, "request_id", ""),
        details=[ErrorDetail(field=exc.field, message=detail_message)],
    )
    # 422 = Unprocessable Content (formerly Unprocessable Entity).
    return JSONResponse(status_code=422, content=body.model_dump())


async def _load_external_id(session: AsyncSession, workspace_id) -> str:
    """Return the workspace's external id as a string."""
    result = await session.execute(
        select(Workspace.external_id).where(Workspace.id == workspace_id)
    )
    row = result.scalar_one()
    return str(row)


@router.get(
    "/cfn-template",
    response_model=CfnTemplateResponse,
    summary="Generate a per-tenant CloudFormation onboarding template",
)
async def get_cfn_template(
    label: str = Query(
        default="",
        description=LABEL_HELP_TEXT,
        examples=[LABEL_EXAMPLE],
    ),
    region: str = Query(default=DEFAULT_REGION, description="AWS region for the stack."),
    cur_mode: str = Query(
        default="existing",
        description=(
            "CUR provisioning mode. 'existing' (default): caller supplies "
            "bucket/prefix/report fields. 'create_new': Numio also "
            "provisions an S3 bucket and a CUR 2.0 Data Export inside the "
            "stack; bucket and report names are derived from label and "
            "region is forced to us-east-1."
        ),
    ),
    cur_bucket_name: str = Query(default="", description="Pre-fill CUR bucket name."),
    cur_report_name: str = Query(default="", description="Pre-fill CUR report name."),
    cur_path_prefix: str = Query(default="cur", description="Pre-fill CUR path prefix."),
    enable_tag_writes: bool = Query(
        default=False,
        description="Provision the NumioTagWriterRole so Numio can write tags.",
    ),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> CfnTemplateResponse:
    """Return the CloudFormation template plus a launch URL.

    The template embeds the caller workspace's ``external_id`` as the default
    value of the ``WorkspaceExternalId`` parameter (with ``NoEcho``), so the
    resulting role is bound to this Numio workspace and nothing else. The
    ``label`` query parameter is mandatory and seeds the IAM resource names,
    the recommended stack name, and the ``numio:instance-label`` tag.
    """
    label = validate_label(label)
    region = _normalize_region(region)
    mode = _coerce_cur_mode(cur_mode)
    if mode == "create_new":
        region = _resolve_create_new_region(region)
    external_id = await _load_external_id(session, current_user.workspace_id)

    params = _build_template_params(
        external_id=external_id,
        label=label,
        cur_mode=mode,
        cur_bucket_name=cur_bucket_name,
        cur_report_name=cur_report_name,
        cur_path_prefix=cur_path_prefix,
        enable_tag_writes=enable_tag_writes,
    )
    template_body = render_template(params)
    stack_name = stack_name_for(label)

    template_url = _public_template_url(region, label, mode, enable_tag_writes)
    launch_url = build_launch_url(
        region=region,
        stack_name=stack_name,
        template_url=template_url,
        params=params,
    )

    return CfnTemplateResponse(
        stack_name=stack_name,
        region=region,
        external_id=external_id,
        label=label,
        template_format="yaml",
        template_body=template_body,
        launch_url=launch_url,
        launch_mode="quickcreate" if template_url else "upload",
        download_url=(
            f"/api/v1/onboarding/cfn-template/download"
            f"?region={region}&label={label}&cur_mode={mode}"
            f"&enable_tag_writes={'true' if enable_tag_writes else 'false'}"
        ),
    )


@router.get(
    "/cfn-template/download",
    summary="Download the CloudFormation onboarding template as a YAML file",
    response_class=Response,
)
async def download_cfn_template(
    label: str = Query(
        default="",
        description=LABEL_HELP_TEXT,
        examples=[LABEL_EXAMPLE],
    ),
    region: str = Query(default=DEFAULT_REGION, description="AWS region for the stack."),
    cur_mode: str = Query(default="existing", description="CUR provisioning mode."),
    cur_bucket_name: str = Query(default="", description="Pre-fill CUR bucket name."),
    cur_report_name: str = Query(default="", description="Pre-fill CUR report name."),
    cur_path_prefix: str = Query(default="cur", description="Pre-fill CUR path prefix."),
    enable_tag_writes: bool = Query(
        default=False,
        description="Provision the NumioTagWriterRole so Numio can write tags.",
    ),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Return the template as an `application/x-yaml` attachment.

    The download filename embeds the label so multiple instances saved
    side-by-side don't clobber each other on disk.
    """
    label = validate_label(label)
    region = _normalize_region(region)
    mode = _coerce_cur_mode(cur_mode)
    if mode == "create_new":
        _resolve_create_new_region(region)
    external_id = await _load_external_id(session, current_user.workspace_id)
    params = _build_template_params(
        external_id=external_id,
        label=label,
        cur_mode=mode,
        cur_bucket_name=cur_bucket_name,
        cur_report_name=cur_report_name,
        cur_path_prefix=cur_path_prefix,
        enable_tag_writes=enable_tag_writes,
    )
    body = render_template(params)
    filename = f"{stack_name_for(label)}.yaml"
    return Response(
        content=body,
        media_type="application/x-yaml",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get(
    "/features",
    response_model=OnboardingFeaturesResponse,
    summary="Return onboarding feature flags",
)
async def get_features(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
) -> OnboardingFeaturesResponse:
    """Report which onboarding methods are currently enabled server-side."""
    return OnboardingFeaturesResponse(chat_enabled=settings.onboarding_chat_enabled)


# ---------------------------------------------------------------------------
# In-progress Guided onboarding state — workspace-scoped, single record.
# ---------------------------------------------------------------------------


class InProgressUpsertRequest(BaseModel):
    """Body of ``PUT /onboarding/in-progress``."""

    label: str = Field(..., description="Per-instance label captured at Customize.")
    step: str = Field(
        ...,
        description=(
            f"Wizard step the user is currently on. One of: {', '.join(PERSISTED_STEPS)}."
        ),
    )


class InProgressResponse(BaseModel):
    """Body of ``GET`` and ``PUT /onboarding/in-progress``."""

    label: str
    step: str
    created_at: datetime
    updated_at: datetime


@router.get(
    "/in-progress",
    summary="Return the workspace's in-progress Guided onboarding state",
    responses={
        200: {"model": InProgressResponse},
        204: {"description": "No onboarding in progress for this workspace."},
    },
)
async def get_in_progress(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Return the in-progress record or 204 when none exists."""
    repo = OnboardingInProgressRepository(session, current_user.workspace_id)
    row = await repo.get()
    if row is None:
        return Response(status_code=204)
    payload = InProgressResponse(
        label=row.label,
        step=row.step,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
    return JSONResponse(content=payload.model_dump(mode="json"))


@router.put(
    "/in-progress",
    response_model=InProgressResponse,
    summary="Create or update the workspace's in-progress Guided onboarding state",
)
async def upsert_in_progress(
    body: InProgressUpsertRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> InProgressResponse:
    """Idempotent upsert. Validates the label and step before persisting."""
    label = validate_label(body.label)
    if body.step not in PERSISTED_STEPS:
        raise HTTPException(
            status_code=422,
            detail=(f"step must be one of: {', '.join(PERSISTED_STEPS)} (got {body.step!r})"),
        )
    repo = OnboardingInProgressRepository(session, current_user.workspace_id)
    row = await repo.upsert(label=label, step=body.step)
    return InProgressResponse(
        label=row.label,
        step=row.step,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete(
    "/in-progress",
    status_code=204,
    summary="Delete the workspace's in-progress Guided onboarding state",
)
async def delete_in_progress(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Idempotent delete. 204 whether or not a record existed."""
    repo = OnboardingInProgressRepository(session, current_user.workspace_id)
    await repo.delete()
    return Response(status_code=204)


# Re-export the regex so external callers (tests, OpenAPI consumers) can
# pin against the same pattern the validator enforces.
__all__ = [
    "router",
    "LABEL_REGEX_STR",
]
