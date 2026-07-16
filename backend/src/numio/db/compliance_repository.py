"""Workspace-scoped data access layer for compliance audit results and snapshots."""

import uuid
from decimal import Decimal

from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.compliance import ComplianceResult, ComplianceSnapshot


class ComplianceRepository:
    """Read/write operations for compliance results and snapshots."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    # --- Write operations (used by audit service) ---

    async def delete_results_for_run(self, audit_run_id: uuid.UUID) -> None:
        """Delete existing results for an audit run (idempotent re-run)."""
        await self._session.execute(
            delete(ComplianceResult).where(
                ComplianceResult.audit_run_id == audit_run_id,
                ComplianceResult.workspace_id == self._workspace_id,
            )
        )
        await self._session.execute(
            delete(ComplianceSnapshot).where(
                ComplianceSnapshot.audit_run_id == audit_run_id,
                ComplianceSnapshot.workspace_id == self._workspace_id,
            )
        )

    async def bulk_insert_results(self, results: list[ComplianceResult]) -> None:
        self._session.add_all(results)
        await self._session.flush()

    async def bulk_insert_snapshots(self, snapshots: list[ComplianceSnapshot]) -> None:
        self._session.add_all(snapshots)
        await self._session.flush()

    # --- Read operations (used by API) ---

    async def get_latest_snapshot(
        self, dimension: str = "overall", dimension_value: str | None = None
    ) -> ComplianceSnapshot | None:
        stmt = (
            select(ComplianceSnapshot)
            .where(
                ComplianceSnapshot.workspace_id == self._workspace_id,
                ComplianceSnapshot.dimension == dimension,
            )
            .order_by(desc(ComplianceSnapshot.snapshot_date))
            .limit(1)
        )
        if dimension_value is not None:
            stmt = stmt.where(ComplianceSnapshot.dimension_value == dimension_value)
        else:
            stmt = stmt.where(ComplianceSnapshot.dimension_value.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_snapshots_by_dimension(self, dimension: str) -> list[ComplianceSnapshot]:
        """Get the most recent snapshot for each dimension_value within a dimension."""
        # Get latest audit_run_id
        latest_run = await self._session.execute(
            select(ComplianceSnapshot.audit_run_id)
            .where(
                ComplianceSnapshot.workspace_id == self._workspace_id,
                ComplianceSnapshot.dimension == dimension,
            )
            .order_by(desc(ComplianceSnapshot.snapshot_date))
            .limit(1)
        )
        run_id = latest_run.scalar_one_or_none()
        if run_id is None:
            return []

        result = await self._session.execute(
            select(ComplianceSnapshot)
            .where(
                ComplianceSnapshot.workspace_id == self._workspace_id,
                ComplianceSnapshot.dimension == dimension,
                ComplianceSnapshot.audit_run_id == run_id,
            )
            .order_by(ComplianceSnapshot.dimension_value)
        )
        return list(result.scalars().all())

    async def get_non_compliant_results(
        self,
        limit: int = 100,
        offset: int = 0,
        sort_by_cost: bool = True,
    ) -> tuple[list[ComplianceResult], int, Decimal]:
        """Get non-compliant results from the latest audit run."""
        # Find latest audit run
        latest_run = await self._session.execute(
            select(ComplianceResult.audit_run_id)
            .where(
                ComplianceResult.workspace_id == self._workspace_id,
                ComplianceResult.status != "compliant",
            )
            .order_by(desc(ComplianceResult.created_at))
            .limit(1)
        )
        run_id = latest_run.scalar_one_or_none()
        if run_id is None:
            return [], 0, Decimal("0")

        base_where = [
            ComplianceResult.workspace_id == self._workspace_id,
            ComplianceResult.audit_run_id == run_id,
            ComplianceResult.status != "compliant",
        ]

        # Count
        from sqlalchemy import func as sa_func

        count_result = await self._session.execute(
            select(
                sa_func.count(ComplianceResult.id),
                sa_func.coalesce(sa_func.sum(ComplianceResult.resource_cost), 0),
            ).where(*base_where)
        )
        row = count_result.one()
        total_count = row[0]
        total_cost = row[1]

        # Fetch page
        stmt = select(ComplianceResult).where(*base_where).offset(offset).limit(limit)
        if sort_by_cost:
            stmt = stmt.order_by(desc(ComplianceResult.resource_cost))
        else:
            stmt = stmt.order_by(desc(ComplianceResult.created_at))

        result = await self._session.execute(stmt)
        return list(result.scalars().all()), total_count, total_cost

    async def get_trend(
        self,
        dimension: str = "overall",
        dimension_value: str | None = None,
        limit: int = 90,
    ) -> list[ComplianceSnapshot]:
        stmt = (
            select(ComplianceSnapshot)
            .where(
                ComplianceSnapshot.workspace_id == self._workspace_id,
                ComplianceSnapshot.dimension == dimension,
            )
            .order_by(desc(ComplianceSnapshot.snapshot_date))
            .limit(limit)
        )
        if dimension_value is not None:
            stmt = stmt.where(ComplianceSnapshot.dimension_value == dimension_value)
        else:
            stmt = stmt.where(ComplianceSnapshot.dimension_value.is_(None))
        result = await self._session.execute(stmt)
        return list(reversed(result.scalars().all()))
