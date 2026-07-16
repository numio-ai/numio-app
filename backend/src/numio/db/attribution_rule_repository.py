"""Workspace-scoped data access layer for attribution rules."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.attribution_rule import AttributionRule
from numio.schemas.attribution import AttributionRuleCreate, AttributionRuleUpdate


class AttributionRuleRepository:
    """CRUD operations for AttributionRule — all queries are scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: AttributionRuleCreate) -> AttributionRule:
        rule = AttributionRule(
            workspace_id=self._workspace_id,
            name=data.name,
            dimension=data.dimension,
            source_type=data.source_type.value,
            priority=data.priority,
            mapping_config=data.mapping_config,
        )
        self._session.add(rule)
        await self._session.commit()
        await self._session.refresh(rule)
        return rule

    async def list_all(self) -> list[AttributionRule]:
        result = await self._session.execute(
            select(AttributionRule)
            .where(AttributionRule.workspace_id == self._workspace_id)
            .order_by(AttributionRule.dimension, AttributionRule.priority)
        )
        return list(result.scalars().all())

    async def list_by_dimension(self, dimension: str) -> list[AttributionRule]:
        result = await self._session.execute(
            select(AttributionRule)
            .where(
                AttributionRule.workspace_id == self._workspace_id,
                AttributionRule.dimension == dimension,
            )
            .order_by(AttributionRule.priority)
        )
        return list(result.scalars().all())

    async def get_by_id(self, rule_id: uuid.UUID) -> AttributionRule | None:
        result = await self._session.execute(
            select(AttributionRule).where(
                AttributionRule.id == rule_id,
                AttributionRule.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self, rule_id: uuid.UUID, data: AttributionRuleUpdate
    ) -> AttributionRule | None:
        rule = await self.get_by_id(rule_id)
        if rule is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if "source_type" in update_data and update_data["source_type"] is not None:
            update_data["source_type"] = update_data["source_type"].value
        for field, value in update_data.items():
            setattr(rule, field, value)
        await self._session.commit()
        await self._session.refresh(rule)
        return rule

    async def delete(self, rule_id: uuid.UUID) -> bool:
        rule = await self.get_by_id(rule_id)
        if rule is None:
            return False
        await self._session.delete(rule)
        await self._session.commit()
        return True
