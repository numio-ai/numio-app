"""REST API endpoints for AWS account registration and management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.audit_service import audit_trail
from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.aws_service import validate_account
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.session import get_session
from numio.schemas.aws_account import (
    AccountListResponse,
    AccountRegistrationResponse,
    AccountResponse,
    RegisterAccountRequest,
    UpdateAccountRequest,
    ValidationResult,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _account_to_response(account) -> AccountResponse:
    """Convert an AwsAccount model to an AccountResponse with redacted credentials."""
    key_hint = None
    if account.aws_access_key_id and len(account.aws_access_key_id) >= 4:
        key_hint = f"...{account.aws_access_key_id[-4:]}"
    return AccountResponse(
        id=account.id,
        workspace_id=account.workspace_id,
        aws_account_id=account.aws_account_id,
        alias=account.alias,
        role_arn=account.role_arn,
        tag_writer_role_arn=account.tag_writer_role_arn,
        aws_access_key_id_hint=key_hint,
        external_id=account.external_id,
        status=account.status,
        environment_label=account.environment_label,
        status_message=account.status_message,
        cur_s3_bucket=account.cur_s3_bucket,
        cur_s3_prefix=account.cur_s3_prefix,
        cur_report_name=account.cur_report_name,
        cur_managed_by_numio=account.cur_managed_by_numio,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


def _status_from_validation(validation: ValidationResult) -> tuple[str, str | None]:
    """Derive account status and status_message from validation results."""
    status = validation.overall_status
    failed_steps = [s for s in validation.steps if s.status == "fail"]
    if failed_steps:
        parts = [f"{s.label}: {s.error}" for s in failed_steps]
        return status, "; ".join(parts)
    # The tag-writer step is an optional capability; its "skip" (no writer role
    # configured) must not become a connected account's status message.
    skipped_steps = [
        s
        for s in validation.steps
        if s.status == "skip" and s.name != "tag_writer_assume_role"
    ]
    if skipped_steps:
        parts = [s.detail or s.label for s in skipped_steps]
        return status, "; ".join(parts)
    return status, None


def _run_validation(account) -> ValidationResult:
    """Run validation using the account's stored credentials and config."""
    return validate_account(
        aws_access_key_id=account.aws_access_key_id or "",
        aws_secret_access_key=account.aws_secret_access_key or "",
        role_arn=account.role_arn,
        external_id=account.external_id or "",
        cur_s3_bucket=account.cur_s3_bucket,
        cur_s3_prefix=account.cur_s3_prefix,
        cur_managed_by_numio=bool(account.cur_managed_by_numio),
        tag_writer_role_arn=account.tag_writer_role_arn,
    )


def _tag_writer_passed(validation: ValidationResult) -> bool:
    return any(
        s.name == "tag_writer_assume_role" and s.status == "pass" for s in validation.steps
    )


async def _validate_and_persist(repo, account) -> tuple[object, ValidationResult]:
    """Validate, persist status, and enforce the tag-writer persistence rule.

    The ``tag_writer_role_arn`` column holds a verified ARN only: if the
    tag_writer_assume_role step did not pass, clear it so the column always
    reflects current write capability (spec §6.2).
    """
    validation = _run_validation(account)
    status, status_message = _status_from_validation(validation)
    await repo.update_status(account.id, status, status_message)
    if not _tag_writer_passed(validation):
        await repo.set_tag_writer_role_arn(account.id, None)
    return await repo.get_by_id(account.id), validation


@router.post(
    "",
    response_model=AccountRegistrationResponse,
    status_code=201,
    summary="Register an AWS account",
)
@audit_trail("account_registered", entity_type="account")
async def register_account(
    body: RegisterAccountRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AccountRegistrationResponse:
    """Register a new AWS account with connectivity validation.

    The account is always persisted regardless of validation outcome.
    Status reflects the connection health: connected, incomplete, or disconnected.
    """
    repo = AwsAccountRepository(session, str(current_user.workspace_id))

    existing = await repo.get_by_aws_account_id(body.aws_account_id)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"AWS account {body.aws_account_id} is already registered",
        )

    account = await repo.create(body)

    account, validation = await _validate_and_persist(repo, account)

    return AccountRegistrationResponse(
        account=_account_to_response(account),
        validation=validation,
    )


@router.get(
    "",
    response_model=AccountListResponse,
    summary="List AWS accounts",
)
async def list_accounts(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountListResponse:
    """List all registered AWS accounts for the current workspace."""
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    accounts = await repo.list_by_workspace()
    return AccountListResponse(
        accounts=[_account_to_response(a) for a in accounts],
        count=len(accounts),
    )


@router.get(
    "/{account_id}",
    response_model=AccountResponse,
    summary="Get AWS account details",
)
async def get_account(
    account_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    """Get details for a specific registered AWS account."""
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return _account_to_response(account)


@router.put(
    "/{account_id}",
    response_model=AccountRegistrationResponse,
    summary="Update AWS account",
)
async def update_account(
    account_id: uuid.UUID,
    body: UpdateAccountRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AccountRegistrationResponse:
    """Update account fields and re-validate the connection.

    All fields are optional — only provided fields are updated.
    The account is always persisted; status reflects validation outcome.
    """
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    account = await repo.update(account_id, body)

    account, validation = await _validate_and_persist(repo, account)

    return AccountRegistrationResponse(
        account=_account_to_response(account),
        validation=validation,
    )


@router.post(
    "/{account_id}/validate",
    response_model=AccountRegistrationResponse,
    summary="Re-validate an existing AWS account",
)
async def revalidate_account(
    account_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountRegistrationResponse:
    """Re-run all validation checks for an existing account and update its status."""
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    account, validation = await _validate_and_persist(repo, account)

    return AccountRegistrationResponse(
        account=_account_to_response(account),
        validation=validation,
    )


@router.post(
    "/{account_id}/deactivate",
    response_model=AccountResponse,
    summary="Deactivate an AWS account",
)
async def deactivate_account(
    account_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    """Set an AWS account to inactive status without deleting data."""
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    account = await repo.soft_delete(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return _account_to_response(account)


@router.delete(
    "/{account_id}",
    status_code=204,
    summary="Permanently delete an AWS account",
)
@audit_trail("account_deleted", entity_type="account")
async def delete_account(
    account_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Permanently delete an AWS account and all associated data."""
    repo = AwsAccountRepository(session, str(current_user.workspace_id))
    deleted = await repo.hard_delete(account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")
