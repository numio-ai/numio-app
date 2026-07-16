"""Workspace-scoped data access layer for budget management."""

import uuid

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.budget import Budget
from numio.schemas.budget import CreateBudgetRequest, UpdateBudgetRequest


class BudgetRepository:
    """CRUD operations for budgets, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: CreateBudgetRequest) -> Budget:
        budget = Budget(
            workspace_id=self._workspace_id,
            name=data.name,
            amount=data.amount,
            currency=data.currency,
            period=data.period,
            dimension=data.dimension,
            dimension_value=data.dimension_value,
            alert_thresholds=data.alert_thresholds,
        )
        self._session.add(budget)
        await self._session.commit()
        await self._session.refresh(budget)
        return budget

    async def list_all(self, *, limit: int = 100, offset: int = 0) -> tuple[list[Budget], int]:
        """List budgets for the workspace. Returns (budgets, total_count)."""
        conditions = [Budget.workspace_id == self._workspace_id]

        count_result = await self._session.execute(
            select(sa_func.count(Budget.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(Budget).where(*conditions).order_by(Budget.name).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, budget_id: uuid.UUID) -> Budget | None:
        result = await self._session.execute(
            select(Budget).where(
                Budget.id == budget_id,
                Budget.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(self, budget_id: uuid.UUID, data: UpdateBudgetRequest) -> Budget | None:
        budget = await self.get_by_id(budget_id)
        if budget is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(budget, field, value)

        await self._session.commit()
        await self._session.refresh(budget)
        return budget

    async def delete(self, budget_id: uuid.UUID) -> bool:
        budget = await self.get_by_id(budget_id)
        if budget is None:
            return False

        await self._session.delete(budget)
        await self._session.commit()
        return True
