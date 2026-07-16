"""Job runner — executes a job across accounts with per-account isolation."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.aws_account import AwsAccount
from numio.models.job import IngestionStatus, JobRun, JobRunAccount
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace

logger = logging.getLogger("numio.jobs.runner")


async def _get_default_workspace_id(session: AsyncSession) -> str:
    """Look up the default workspace ID by slug."""
    result = await session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
    return str(workspace.id)


# Account statuses that make an account eligible to run background jobs.
# - "connected": full validation (credentials + role + S3) succeeded.
# - "incomplete": credentials + role succeeded, CUR not yet reachable — Cost Explorer
#   jobs can still run; CUR-specific jobs fail per-account with a clear error.
# Excluded: "disconnected" (credentials broken) and "inactive" (soft-deleted).
_JOB_ELIGIBLE_STATUSES: tuple[str, ...] = ("connected", "incomplete")


async def _get_registered_accounts(session: AsyncSession, workspace_id: str) -> list[str]:
    """Query job-eligible registered accounts from the database."""
    result = await session.execute(
        select(AwsAccount.aws_account_id)
        .where(AwsAccount.workspace_id == workspace_id)
        .where(AwsAccount.status.in_(_JOB_ELIGIBLE_STATUSES))
    )
    return [row[0] for row in result.all()]


async def run_job(
    job_type: str,
    job_func,
    session: AsyncSession,
    workspace_id: str | None = None,
    accounts: list[str] | None = None,
) -> JobRun:
    """Execute a job across all accounts, recording results to the database.

    Per-account failures are isolated — one account failing does not block others.
    """
    if workspace_id is None:
        workspace_id = await _get_default_workspace_id(session)

    if accounts is None:
        accounts = await _get_registered_accounts(session, workspace_id)

    if not accounts:
        logger.warning(
            "No connected accounts in workspace %s (eligible statuses: %s). Skipping %s.",
            workspace_id, ", ".join(_JOB_ELIGIBLE_STATUSES), job_type,
        )
        job_run = JobRun(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            job_type=job_type,
            status="skipped",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        session.add(job_run)
        await session.commit()
        return job_run

    job_run = JobRun(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        job_type=job_type,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    session.add(job_run)
    await session.flush()

    has_failure = False
    has_success = False

    for account_id in accounts:
        account_result = JobRunAccount(
            id=uuid.uuid4(),
            job_run_id=job_run.id,
            account_id=account_id,
            status="success",
            record_count=0,
        )

        try:
            record_count = await job_func(account_id)
            account_result.record_count = record_count
            account_result.status = "success"
            has_success = True
            logger.info(
                "Job %s account %s: success (%d records)",
                job_type,
                account_id,
                record_count,
            )
        except Exception as e:
            account_result.status = "failure"
            account_result.error_details = str(e)
            has_failure = True
            logger.error(
                "Job %s account %s: failure — %s",
                job_type,
                account_id,
                e,
            )

        session.add(account_result)

        # Update ingestion status for this account
        await _update_ingestion_status(
            session=session,
            workspace_id=workspace_id,
            account_id=account_id,
            data_source=job_type,
            status=account_result.status,
            record_count=account_result.record_count,
            error_details=account_result.error_details,
        )

    # Determine overall job status
    if has_failure and has_success:
        job_run.status = "partial"
    elif has_failure:
        job_run.status = "failure"
    else:
        job_run.status = "success"

    job_run.finished_at = datetime.now(timezone.utc)
    await session.commit()
    # Refresh to get DB-generated values
    await session.refresh(job_run)
    return job_run


async def _update_ingestion_status(
    session: AsyncSession,
    workspace_id: str,
    account_id: str,
    data_source: str,
    status: str,
    record_count: int,
    error_details: str | None,
) -> None:
    """Update or create the ingestion status record for an account/data_source pair."""
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(IngestionStatus).where(
            IngestionStatus.workspace_id == workspace_id,
            IngestionStatus.account_id == account_id,
            IngestionStatus.data_source == data_source,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await session.execute(
            update(IngestionStatus)
            .where(IngestionStatus.id == existing.id)
            .values(
                last_sync_at=now,
                last_status=status,
                record_count=record_count,
                error_details=error_details,
                updated_at=now,
            )
        )
    else:
        ingestion = IngestionStatus(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            account_id=account_id,
            data_source=data_source,
            last_sync_at=now,
            last_status=status,
            record_count=record_count,
            error_details=error_details,
            updated_at=now,
        )
        session.add(ingestion)
