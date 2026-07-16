"""Infrastructure policy evaluation job registration.

Runs at the workspace level (not per-account). The account_id parameter
is accepted for interface compatibility with the job runner but is ignored.
"""

from sqlalchemy import select

from numio.core.infra_policy_service import InfraPolicyEvaluationService
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace


async def infra_policy_evaluation_job(account_id: str) -> int:
    """Entry point for the job runner.

    Evaluates all active infrastructure policies against current resources
    and costs. Returns the number of new violations created.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        service = InfraPolicyEvaluationService(session, str(workspace.id))
        return await service.evaluate_all()


def register_infra_policy_jobs() -> None:
    """Register the infrastructure policy evaluation job with the global registry."""
    job_registry.register(
        job_type="infra_policy_evaluation",
        func=infra_policy_evaluation_job,
        description="Evaluate infrastructure policies and create violation findings",
        interval_seconds=3600,  # Hourly
    )
