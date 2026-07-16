"""Workspace-scoped data access layer for recommendations."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.recommendation import Recommendation


class RecommendationRepository:
    """CRUD and lifecycle operations for recommendations, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    # --- Create (with dedup by finding_id) ---

    async def create(
        self,
        *,
        finding_id: uuid.UUID | None,
        category: str,
        confidence: str,
        title: str,
        description: str | None,
        resource_id: str,
        remediation_commands: str | None,
        estimated_monthly_savings: Decimal | None,
    ) -> tuple[Recommendation, bool]:
        """Create a recommendation. Dedup by finding_id — returns (rec, created)."""
        if finding_id is not None:
            existing = await self._get_by_finding_id(finding_id)
            if existing is not None:
                return existing, False

        rec = Recommendation(
            workspace_id=self._workspace_id,
            finding_id=finding_id,
            category=category,
            confidence=confidence,
            title=title,
            description=description,
            resource_id=resource_id,
            remediation_commands=remediation_commands,
            estimated_monthly_savings=estimated_monthly_savings,
        )
        self._session.add(rec)
        await self._session.commit()
        await self._session.refresh(rec)
        return rec, True

    async def _get_by_finding_id(self, finding_id: uuid.UUID) -> Recommendation | None:
        result = await self._session.execute(
            select(Recommendation).where(
                Recommendation.workspace_id == self._workspace_id,
                Recommendation.finding_id == finding_id,
            )
        )
        return result.scalar_one_or_none()

    # --- Read ---

    async def list_recommendations(
        self,
        *,
        category: str | None = None,
        status: str | None = None,
        sort_by_savings: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Recommendation], int]:
        """List recommendations with optional filters. Returns (recs, total)."""
        conditions = [Recommendation.workspace_id == self._workspace_id]
        if category is not None:
            conditions.append(Recommendation.category == category)
        if status is not None:
            conditions.append(Recommendation.status == status)

        count_result = await self._session.execute(
            select(sa_func.count(Recommendation.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        query = select(Recommendation).where(*conditions)
        if sort_by_savings:
            query = query.order_by(Recommendation.estimated_monthly_savings.desc().nulls_last())
        else:
            query = query.order_by(Recommendation.created_at.desc())
        query = query.offset(offset).limit(limit)

        result = await self._session.execute(query)
        return list(result.scalars().all()), total

    async def get_by_id(self, rec_id: uuid.UUID) -> Recommendation | None:
        result = await self._session.execute(
            select(Recommendation).where(
                Recommendation.id == rec_id,
                Recommendation.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    # --- Lifecycle transitions ---

    async def accept(self, rec_id: uuid.UUID) -> Recommendation | None:
        rec = await self.get_by_id(rec_id)
        if rec is None or rec.status != "open":
            return None
        rec.status = "accepted"
        rec.accepted_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(rec)
        return rec

    async def dismiss(self, rec_id: uuid.UUID) -> Recommendation | None:
        rec = await self.get_by_id(rec_id)
        if rec is None or rec.status in ("implemented", "dismissed"):
            return None
        rec.status = "dismissed"
        rec.dismissed_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(rec)
        return rec

    async def implement(self, rec_id: uuid.UUID) -> Recommendation | None:
        rec = await self.get_by_id(rec_id)
        if rec is None or rec.status not in ("open", "accepted"):
            return None
        rec.status = "implemented"
        rec.implemented_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(rec)
        return rec

    # --- Savings queries ---

    async def get_savings_summary(self) -> dict:
        """Get cumulative savings summary grouped by category."""
        conditions = [
            Recommendation.workspace_id == self._workspace_id,
            Recommendation.status == "implemented",
        ]

        result = await self._session.execute(
            select(
                Recommendation.category,
                sa_func.coalesce(sa_func.sum(Recommendation.estimated_monthly_savings), 0).label(
                    "estimated"
                ),
                sa_func.coalesce(sa_func.sum(Recommendation.actual_savings), 0).label("actual"),
                sa_func.count(Recommendation.id).label("count"),
            )
            .where(*conditions)
            .group_by(Recommendation.category)
        )
        rows = result.all()

        by_category = []
        total_estimated = Decimal("0")
        total_actual = Decimal("0")
        total_count = 0

        for row in rows:
            estimated = row.estimated or Decimal("0")
            actual = row.actual or Decimal("0")
            by_category.append(
                {
                    "category": row.category,
                    "estimated_monthly_savings": estimated,
                    "actual_savings": actual,
                    "recommendation_count": row.count,
                }
            )
            total_estimated += estimated
            total_actual += actual
            total_count += row.count

        return {
            "total_estimated_monthly_savings": total_estimated,
            "total_actual_savings": total_actual,
            "total_implemented": total_count,
            "by_category": by_category,
        }

    async def get_savings_timeline(self) -> list[dict]:
        """Get implemented recommendations ordered by implementation date."""
        result = await self._session.execute(
            select(Recommendation)
            .where(
                Recommendation.workspace_id == self._workspace_id,
                Recommendation.status == "implemented",
                Recommendation.implemented_at.isnot(None),
            )
            .order_by(Recommendation.implemented_at)
        )
        recs = list(result.scalars().all())

        entries = []
        cumulative = Decimal("0")
        for rec in recs:
            savings = rec.actual_savings or rec.estimated_monthly_savings or Decimal("0")
            cumulative += savings
            entries.append(
                {
                    "date": rec.implemented_at.date().isoformat(),
                    "cumulative_savings": cumulative,
                    "recommendation_id": rec.id,
                    "category": rec.category,
                    "resource_id": rec.resource_id,
                }
            )
        return entries

    # --- Savings update (called by service) ---

    async def update_savings(
        self, rec_id: uuid.UUID, actual_savings: Decimal, label: str
    ) -> Recommendation | None:
        rec = await self.get_by_id(rec_id)
        if rec is None:
            return None
        rec.actual_savings = actual_savings
        rec.savings_data_label = label
        await self._session.commit()
        await self._session.refresh(rec)
        return rec
