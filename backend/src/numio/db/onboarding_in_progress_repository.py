"""Workspace-scoped data access for in-progress Guided onboarding state."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.onboarding_in_progress import OnboardingInProgress


class OnboardingInProgressRepository:
    """Single-row-per-workspace upsert for the Guided wizard's saved step."""

    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def get(self) -> OnboardingInProgress | None:
        result = await self._session.execute(
            select(OnboardingInProgress).where(
                OnboardingInProgress.workspace_id == self._workspace_id
            )
        )
        return result.scalar_one_or_none()

    async def upsert(self, *, label: str, step: str) -> OnboardingInProgress:
        existing = await self.get()
        if existing is None:
            row = OnboardingInProgress(workspace_id=self._workspace_id, label=label, step=step)
            self._session.add(row)
            await self._session.commit()
            await self._session.refresh(row)
            return row
        existing.label = label
        existing.step = step
        await self._session.commit()
        await self._session.refresh(existing)
        return existing

    async def delete(self) -> bool:
        result = await self._session.execute(
            delete(OnboardingInProgress).where(
                OnboardingInProgress.workspace_id == self._workspace_id
            )
        )
        await self._session.commit()
        return (result.rowcount or 0) > 0
