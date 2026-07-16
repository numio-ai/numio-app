"""Zombie hunter and idle detection job registration.

Runs per-account: assumes role into each registered AWS account,
discovers orphaned/idle resources, and creates findings.
"""

import logging

from sqlalchemy import select

from numio.core.aws_service import _get_session as get_boto_session
from numio.core.aws_service import validate_connectivity
from numio.core.resource_inventory_service import DEFAULT_REGIONS
from numio.core.zombie_detection_service import ZombieDetectionService
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace

logger = logging.getLogger("numio.jobs.zombie_detection")


async def zombie_detection_job(account_id: str) -> int:
    """Entry point for the job runner.

    Assumes role into the account, then runs zombie and idle detection.
    Returns the number of new findings created.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        workspace_id = str(workspace.id)
        repo = AwsAccountRepository(session, workspace_id)
        account = await repo.get_by_aws_account_id(account_id)
        if account is None:
            raise ValueError(f"Account {account_id} not found")

        ok, error_msg, credentials = validate_connectivity(account.role_arn)
        if not ok:
            raise RuntimeError(f"STS AssumeRole failed for {account_id}: {error_msg}")

        boto_session = get_boto_session(credentials)
        service = ZombieDetectionService(session, workspace_id)

        return await service.run_detection(
            account_id=account_id,
            boto_session=boto_session,
            regions=DEFAULT_REGIONS,
        )


def register_zombie_detection_jobs() -> None:
    """Register the zombie detection job with the global registry."""
    job_registry.register(
        job_type="zombie_detection",
        func=zombie_detection_job,
        description="Detect orphaned and idle resources across AWS accounts",
        interval_seconds=86400,  # Daily
    )
