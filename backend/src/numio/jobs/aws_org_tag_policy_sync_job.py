"""AWS Organizations tag policy sync job registration.

The runner fans out across connected accounts; each invocation syncs only when
its account is the Org management account (spec §6.4). ``account_id`` is the
12-digit ``AwsAccount.aws_account_id`` the runner passes.
"""

from sqlalchemy import select

from numio.core.aws_org_tag_policy_service import sync_for_account
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace


async def aws_org_tag_policy_sync_job(account_id: str) -> int:
    """Sync the AWS Org tag policy if this account is the management account."""
    async with AsyncSessionLocal() as session:
        workspace = (
            await session.execute(
                select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
            )
        ).scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        return await sync_for_account(session, str(workspace.id), account_id)


def register_aws_org_tag_policy_sync_jobs() -> None:
    """Register the daily AWS Org tag policy sync job."""
    job_registry.register(
        job_type="aws_org_tag_policy_sync",
        func=aws_org_tag_policy_sync_job,
        description="Sync the effective AWS Organizations tag policy from the management account",
        interval_seconds=86400,  # Daily
    )
