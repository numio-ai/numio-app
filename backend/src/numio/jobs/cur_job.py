"""CUR ingestion job registration."""

from numio.core.cur_service import cur_ingestion_job
from numio.jobs.registry import job_registry


def register_cur_jobs() -> None:
    """Register the CUR ingestion job with the global registry."""
    job_registry.register(
        job_type="cur_ingestion",
        func=cur_ingestion_job,
        description="Ingest CUR Parquet files from S3 into cost_records",
        interval_seconds=86400,  # daily
    )
