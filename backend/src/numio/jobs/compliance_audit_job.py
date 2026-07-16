"""Compliance audit job registration.

The compliance audit runs at the workspace level (evaluating all resources
across all accounts), so it doesn't follow the per-account pattern.
The account_id parameter is accepted but ignored to satisfy the job runner
interface.
"""

from sqlalchemy import select

from numio.core.compliance_service import run_compliance_audit
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace


async def compliance_audit_job(account_id: str) -> int:
    """Entry point for the job runner.

    Runs a full compliance audit for the workspace.
    The account_id parameter is accepted for interface compatibility
    but the audit evaluates all accounts.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        _, result_count = await run_compliance_audit(session, str(workspace.id))
        return result_count


def register_compliance_audit_jobs() -> None:
    """Register the compliance audit job with the global registry."""
    job_registry.register(
        job_type="compliance_audit",
        func=compliance_audit_job,
        description="Evaluate all resources against active tag policies",
        interval_seconds=None,  # Not scheduled — triggered after resource inventory sync
    )
