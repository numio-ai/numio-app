"""Workspace-scoped data access layer for tag policies and rules."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.models.tag_policy import TagPolicy, TagPolicyRule
from numio.schemas.tag_policy import TagPolicyCreate, TagPolicyUpdate


class TagPolicyRepository:
    """CRUD operations for TagPolicy — all queries scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: TagPolicyCreate) -> TagPolicy:
        policy = TagPolicy(
            workspace_id=self._workspace_id,
            name=data.name,
            description=data.description,
            priority=data.priority,
            is_active=data.is_active,
        )
        for rule_data in data.rules:
            rule = TagPolicyRule(
                tag_name=rule_data.tag_name,
                value_type=rule_data.value_type.value,
                allowed_values=rule_data.allowed_values,
                equivalence_groups=rule_data.equivalence_groups,
                default_value=rule_data.default_value,
                applicable_resource_types=rule_data.applicable_resource_types,
                applicable_accounts=rule_data.applicable_accounts,
            )
            policy.rules.append(rule)
        self._session.add(policy)
        await self._session.commit()
        await self._session.refresh(policy)
        # Eagerly load rules after commit
        await self._session.execute(
            select(TagPolicy)
            .where(TagPolicy.id == policy.id)
            .options(selectinload(TagPolicy.rules))
        )
        return policy

    async def list_active(self) -> list[TagPolicy]:
        result = await self._session.execute(
            select(TagPolicy)
            .where(
                TagPolicy.workspace_id == self._workspace_id,
                TagPolicy.is_active.is_(True),
            )
            .options(selectinload(TagPolicy.rules))
            .order_by(TagPolicy.priority.asc().nulls_last(), TagPolicy.name)
        )
        return list(result.scalars().unique().all())

    async def list_all(self) -> list[TagPolicy]:
        result = await self._session.execute(
            select(TagPolicy)
            .where(TagPolicy.workspace_id == self._workspace_id)
            .options(selectinload(TagPolicy.rules))
            .order_by(TagPolicy.priority.asc().nulls_last(), TagPolicy.name)
        )
        return list(result.scalars().unique().all())

    async def get_by_id(self, policy_id: uuid.UUID) -> TagPolicy | None:
        result = await self._session.execute(
            select(TagPolicy)
            .where(
                TagPolicy.id == policy_id,
                TagPolicy.workspace_id == self._workspace_id,
            )
            .options(selectinload(TagPolicy.rules))
        )
        return result.scalar_one_or_none()

    async def update(self, policy_id: uuid.UUID, data: TagPolicyUpdate) -> TagPolicy | None:
        policy = await self.get_by_id(policy_id)
        if policy is None:
            return None

        update_fields = data.model_dump(exclude_unset=True, exclude={"rules"})
        for field, value in update_fields.items():
            setattr(policy, field, value)

        # If rules are provided, replace all existing rules
        if data.rules is not None:
            # Remove existing rules
            policy.rules.clear()
            for rule_data in data.rules:
                rule = TagPolicyRule(
                    tag_name=rule_data.tag_name,
                    value_type=rule_data.value_type.value,
                    allowed_values=rule_data.allowed_values,
                    default_value=rule_data.default_value,
                    applicable_resource_types=rule_data.applicable_resource_types,
                    applicable_accounts=rule_data.applicable_accounts,
                )
                policy.rules.append(rule)

        await self._session.commit()
        await self._session.refresh(policy)
        # Re-load rules
        await self._session.execute(
            select(TagPolicy)
            .where(TagPolicy.id == policy.id)
            .options(selectinload(TagPolicy.rules))
        )
        return policy

    async def delete(self, policy_id: uuid.UUID) -> bool:
        policy = await self.get_by_id(policy_id)
        if policy is None:
            return False
        await self._session.delete(policy)
        await self._session.commit()
        return True
