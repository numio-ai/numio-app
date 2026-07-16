"""Job management API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.session import get_session
from numio.jobs.anomaly_detection_job import register_anomaly_detection_jobs
from numio.jobs.budget_evaluation_job import register_budget_evaluation_jobs
from numio.jobs.compliance_audit_job import register_compliance_audit_jobs
from numio.jobs.cur_job import register_cur_jobs
from numio.jobs.registry import job_registry
from numio.jobs.resource_inventory_job import register_resource_inventory_jobs
from numio.jobs.runner import run_job
from numio.jobs.sample_job import register_sample_jobs
from numio.models.job import IngestionStatus, JobRun
from numio.schemas.jobs import (
    IngestionStatusDetail,
    IngestionStatusResponse,
    JobHistoryResponse,
    JobRunAccountDetail,
    JobRunDetail,
    JobTriggerResponse,
    JobTypeInfo,
    JobTypesResponse,
)

logger = logging.getLogger("numio.api.jobs")

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Ensure all jobs are registered when the API module loads.
register_sample_jobs()
register_cur_jobs()
register_resource_inventory_jobs()
register_compliance_audit_jobs()
register_anomaly_detection_jobs()
register_budget_evaluation_jobs()


@router.get("/types", summary="List registered job types")
async def list_job_types(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JobTypesResponse:
    """List all registered job types with their schedule info."""
    job_types = [
        JobTypeInfo(
            job_type=j.job_type,
            description=j.description,
            interval_seconds=j.interval_seconds,
        )
        for j in job_registry.list_types()
    ]
    return JobTypesResponse(job_types=job_types)


@router.post("/{job_type}/trigger", summary="Trigger a job on demand")
async def trigger_job(
    job_type: str,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> JobTriggerResponse:
    """Trigger a job on demand. Returns the job run ID."""
    job_def = job_registry.get(job_type)
    if job_def is None:
        raise HTTPException(status_code=404, detail=f"Job type '{job_type}' not found")

    job_run = await run_job(
        job_type=job_type,
        job_func=job_def.func,
        session=session,
    )

    return JobTriggerResponse(
        job_run_id=job_run.id,
        job_type=job_run.job_type,
        status=job_run.status,
    )


@router.get("/history", summary="List recent job runs")
async def list_job_history(
    limit: int = Query(default=20, ge=1, le=100, description="Number of recent runs to return"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JobHistoryResponse:
    """List recent job runs with per-account details."""
    result = await session.execute(
        select(JobRun)
        .options(selectinload(JobRun.account_results))
        .order_by(JobRun.started_at.desc())
        .limit(limit)
    )
    runs = result.scalars().all()

    return JobHistoryResponse(
        runs=[
            JobRunDetail(
                id=run.id,
                workspace_id=run.workspace_id,
                job_type=run.job_type,
                status=run.status,
                started_at=run.started_at,
                finished_at=run.finished_at,
                error_details=run.error_details,
                account_results=[
                    JobRunAccountDetail(
                        account_id=ar.account_id,
                        status=ar.status,
                        record_count=ar.record_count,
                        error_details=ar.error_details,
                    )
                    for ar in run.account_results
                ],
            )
            for run in runs
        ]
    )


@router.get("/ingestion-status", summary="Per-account ingestion status")
async def get_ingestion_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IngestionStatusResponse:
    """Get per-account last sync time and status for all data sources."""
    result = await session.execute(
        select(IngestionStatus).order_by(IngestionStatus.updated_at.desc())
    )
    statuses = result.scalars().all()

    return IngestionStatusResponse(
        statuses=[
            IngestionStatusDetail(
                workspace_id=s.workspace_id,
                account_id=s.account_id,
                data_source=s.data_source,
                last_sync_at=s.last_sync_at,
                last_status=s.last_status,
                record_count=s.record_count,
                error_details=s.error_details,
            )
            for s in statuses
        ]
    )
