"""Budget evaluation job registration.

Runs at the workspace level (not per-account). The account_id parameter
is accepted for interface compatibility with the job runner but is ignored.
"""

from sqlalchemy import select

from numio.core.budget_evaluation_service import BudgetEvaluationService
from numio.db.session import AsyncSessionLocal
from numio.jobs.registry import job_registry
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace


async def budget_evaluation_job(account_id: str) -> int:
    """Entry point for the job runner.

    Evaluates all budgets, calculates burn rate projections, and creates
    alert findings when thresholds are crossed. Returns the number of
    new alerts created.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()
        if workspace is None:
            raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
        service = BudgetEvaluationService(session, str(workspace.id))
        return await service.evaluate_all_and_alert()


def register_budget_evaluation_jobs() -> None:
    """Register the budget evaluation job with the global registry."""
    job_registry.register(
        job_type="budget_evaluation",
        func=budget_evaluation_job,
        description="Evaluate budgets and create overspend alerts",
        interval_seconds=86400,  # Daily
    )
