"""Resource inventory sync job registration."""

from numio.core.resource_inventory_service import resource_inventory_sync_job
from numio.jobs.registry import job_registry


def register_resource_inventory_jobs() -> None:
    """Register the resource inventory sync job with the global registry."""
    job_registry.register(
        job_type="resource_inventory_sync",
        func=resource_inventory_sync_job,
        description="Sync resource inventory from AWS service APIs",
        interval_seconds=86400,  # daily
    )
