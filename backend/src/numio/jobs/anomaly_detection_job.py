"""Anomaly detection job registration.

Runs at the workspace level (not per-account). The account_id parameter
is accepted for interface compatibility with the job runner but is ignored.
"""

from sqlalchemy import select

from numio.core.anomaly_detection_service import AnomalyDetectionService
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace


async def anomaly_detection_job(account_id: str) -> int:
    """Entry point for the job runner.

    Runs anomaly detection for the workspace. Returns the number
    of new findings created.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        service = AnomalyDetectionService(session, str(workspace.id))
        return await service.run_detection()


def register_anomaly_detection_jobs() -> None:
    """Register the anomaly detection job with the global registry."""
    job_registry.register(
        job_type="anomaly_detection",
        func=anomaly_detection_job,
        description="Detect cost spikes and drift across dimensions",
        interval_seconds=86400,  # Daily
    )
