"""Workspace-scoped data access layer for infrastructure policies."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.infra_policy import InfraPolicy
from numio.schemas.infra_policy import CreateInfraPolicyRequest, UpdateInfraPolicyRequest


class InfraPolicyRepository:
    """CRUD operations for infrastructure policies, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: CreateInfraPolicyRequest) -> InfraPolicy:
        policy = InfraPolicy(
            workspace_id=self._workspace_id,
            name=data.name,
            description=data.description,
            type=data.type,
            severity=data.severity,
            rule=data.rule,
            applicability=data.applicability.model_dump(),
            is_guardrail=data.is_guardrail,
            is_active=data.is_active,
        )
        self._session.add(policy)
        await self._session.commit()
        await self._session.refresh(policy)
        return policy

    async def list_all(
        self,
        *,
        policy_type: str | None = None,
        is_active: bool | None = None,
        is_guardrail: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[InfraPolicy], int]:
        """List policies with optional filters. Returns (policies, total_count)."""
        conditions = [InfraPolicy.workspace_id == self._workspace_id]
        if policy_type is not None:
            conditions.append(InfraPolicy.type == policy_type)
        if is_active is not None:
            conditions.append(InfraPolicy.is_active == is_active)
        if is_guardrail is not None:
            conditions.append(InfraPolicy.is_guardrail == is_guardrail)

        count_result = await self._session.execute(
            select(sa_func.count(InfraPolicy.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(InfraPolicy)
            .where(*conditions)
            .order_by(InfraPolicy.name)
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, policy_id: uuid.UUID) -> InfraPolicy | None:
        result = await self._session.execute(
            select(InfraPolicy).where(
                InfraPolicy.id == policy_id,
                InfraPolicy.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self,
        policy_id: uuid.UUID,
        data: UpdateInfraPolicyRequest,
    ) -> InfraPolicy | None:
        policy = await self.get_by_id(policy_id)
        if policy is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "applicability" and value is not None:
                value = value if isinstance(value, dict) else value.model_dump()
            setattr(policy, field, value)

        await self._session.commit()
        await self._session.refresh(policy)
        return policy

    async def delete(self, policy_id: uuid.UUID) -> bool:
        policy = await self.get_by_id(policy_id)
        if policy is None:
            return False

        await self._session.delete(policy)
        await self._session.commit()
        return True

    async def get_active_policies(self) -> list[InfraPolicy]:
        """Get all active policies for evaluation."""
        result = await self._session.execute(
            select(InfraPolicy).where(
                InfraPolicy.workspace_id == self._workspace_id,
                InfraPolicy.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_guardrail_policies(self) -> list[InfraPolicy]:
        """Get active guardrail policies for immediate evaluation."""
        result = await self._session.execute(
            select(InfraPolicy).where(
                InfraPolicy.workspace_id == self._workspace_id,
                InfraPolicy.is_active.is_(True),
                InfraPolicy.is_guardrail.is_(True),
            )
        )
        return list(result.scalars().all())

    async def update_compliance(
        self, policy_id: uuid.UUID, compliance_percentage: Decimal, evaluated_at: datetime
    ) -> None:
        """Update compliance percentage and evaluation timestamp."""
        policy = await self.get_by_id(policy_id)
        if policy is not None:
            policy.compliance_percentage = compliance_percentage
            policy.last_evaluated_at = evaluated_at
            await self._session.commit()
