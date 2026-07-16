"""Numio background worker entrypoint.

Starts the worker process: verifies database connectivity, registers jobs,
and runs the APScheduler loop for periodic job execution.
"""

import asyncio
import logging
import signal
import sys

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from numio.db.session import AsyncSessionLocal
from numio.jobs.anomaly_detection_job import register_anomaly_detection_jobs
from numio.jobs.aws_org_tag_policy_sync_job import register_aws_org_tag_policy_sync_jobs
from numio.jobs.budget_evaluation_job import register_budget_evaluation_jobs
from numio.jobs.cur_job import register_cur_jobs
from numio.jobs.infra_policy_job import register_infra_policy_jobs
from numio.jobs.registry import job_registry
from numio.jobs.runner import run_job
from numio.jobs.sample_job import register_sample_jobs
from numio.jobs.zombie_detection_job import register_zombie_detection_jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("numio.worker")


async def check_database() -> bool:
    """Verify database connectivity."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection failed: %s", e)
        return False


async def execute_scheduled_job(job_type: str) -> None:
    """Wrapper that runs a registered job within a fresh DB session."""
    job_def = job_registry.get(job_type)
    if job_def is None:
        logger.error("Job type %s not found in registry.", job_type)
        return

    async with AsyncSessionLocal() as session:
        try:
            job_run = await run_job(
                job_type=job_type,
                job_func=job_def.func,
                session=session,
            )
            logger.info(
                "Scheduled job %s completed: status=%s, id=%s",
                job_type,
                job_run.status,
                job_run.id,
            )
        except Exception as e:
            logger.error("Scheduled job %s failed: %s", job_type, e)


async def main() -> None:
    """Worker main loop: verify DB, register jobs, run scheduler."""
    logger.info("Numio worker starting...")

    if not await check_database():
        logger.error("Cannot connect to database. Exiting.")
        sys.exit(1)

    logger.info("Database connection verified.")

    # Register all jobs
    register_sample_jobs()
    register_cur_jobs()
    register_anomaly_detection_jobs()
    register_zombie_detection_jobs()
    register_budget_evaluation_jobs()
    register_infra_policy_jobs()
    register_aws_org_tag_policy_sync_jobs()
    logger.info("Registered %d job types.", len(job_registry.list_types()))

    # Configure APScheduler
    scheduler = AsyncIOScheduler()

    for job_def in job_registry.list_types():
        if job_def.interval_seconds:
            scheduler.add_job(
                execute_scheduled_job,
                "interval",
                seconds=job_def.interval_seconds,
                args=[job_def.job_type],
                id=job_def.job_type,
                name=f"Scheduled: {job_def.job_type}",
            )
            logger.info(
                "Scheduled job %s every %d seconds.",
                job_def.job_type,
                job_def.interval_seconds,
            )

    scheduler.start()
    logger.info("Scheduler started. Worker is running.")

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    await stop.wait()
    scheduler.shutdown(wait=False)
    logger.info("Worker shutting down.")


if __name__ == "__main__":
    asyncio.run(main())
