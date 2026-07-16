"""Sample/placeholder job for testing the job framework.

Simulates processing by sleeping briefly and returning fake record counts.
"""

import asyncio
import random

from numio.jobs.registry import job_registry


async def sample_ingestion_job(account_id: str) -> int:
    """Simulate a data ingestion job for one account.

    Sleeps briefly to mimic real work, then returns a random record count.
    """
    # Simulate processing time
    await asyncio.sleep(0.1)
    record_count = random.randint(10, 500)
    return record_count


def register_sample_jobs() -> None:
    """Register all sample/placeholder jobs with the global registry."""
    job_registry.register(
        job_type="sample_ingestion",
        func=sample_ingestion_job,
        description="Sample ingestion job for testing the job framework",
        interval_seconds=3600,  # every hour
    )
