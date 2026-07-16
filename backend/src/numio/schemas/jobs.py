"""Pydantic schemas for job-related API endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class JobTypeInfo(BaseModel):
    """Information about a registered job type."""

    job_type: str
    description: str
    interval_seconds: int | None = None


class JobTypesResponse(BaseModel):
    """Response for GET /api/v1/jobs/types."""

    job_types: list[JobTypeInfo]


class JobTriggerResponse(BaseModel):
    """Response for POST /api/v1/jobs/{job_type}/trigger."""

    job_run_id: uuid.UUID
    job_type: str
    status: str


class JobRunAccountDetail(BaseModel):
    """Per-account detail within a job run."""

    account_id: str
    status: str
    record_count: int
    error_details: str | None = None


class JobRunDetail(BaseModel):
    """Detail of a single job run."""

    id: uuid.UUID
    workspace_id: str
    job_type: str
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    error_details: str | None = None
    account_results: list[JobRunAccountDetail] = []


class JobHistoryResponse(BaseModel):
    """Response for GET /api/v1/jobs/history."""

    runs: list[JobRunDetail]


class IngestionStatusDetail(BaseModel):
    """Ingestion status for one account and data source."""

    workspace_id: str
    account_id: str
    data_source: str
    last_sync_at: datetime | None = None
    last_status: str
    record_count: int
    error_details: str | None = None


class IngestionStatusResponse(BaseModel):
    """Response for GET /api/v1/jobs/ingestion-status."""

    statuses: list[IngestionStatusDetail]
