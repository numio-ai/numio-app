"""Workspace-scoped data access layer for remediation campaigns."""

import uuid
from decimal import Decimal

from sqlalchemy import case, desc, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.models.campaign import CampaignResource, RemediationCampaign


class CampaignRepository:
    """CRUD operations for campaigns — all queries scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(
        self,
        campaign: RemediationCampaign,
    ) -> RemediationCampaign:
        self._session.add(campaign)
        await self._session.commit()
        await self._session.refresh(campaign)
        # Re-load with resources
        await self._session.execute(
            select(RemediationCampaign)
            .where(RemediationCampaign.id == campaign.id)
            .options(selectinload(RemediationCampaign.resources))
        )
        return campaign

    async def list_all(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[RemediationCampaign], int]:
        # Count
        count_result = await self._session.execute(
            select(sa_func.count(RemediationCampaign.id)).where(
                RemediationCampaign.workspace_id == self._workspace_id,
            )
        )
        total = count_result.scalar_one()

        # Fetch page
        result = await self._session.execute(
            select(RemediationCampaign)
            .where(
                RemediationCampaign.workspace_id == self._workspace_id,
            )
            .order_by(desc(RemediationCampaign.created_at))
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_by_id(
        self,
        campaign_id: uuid.UUID,
    ) -> RemediationCampaign | None:
        result = await self._session.execute(
            select(RemediationCampaign)
            .where(
                RemediationCampaign.id == campaign_id,
                RemediationCampaign.workspace_id == self._workspace_id,
            )
            .options(selectinload(RemediationCampaign.resources))
        )
        return result.scalar_one_or_none()

    async def update(
        self,
        campaign_id: uuid.UUID,
        updates: dict,
    ) -> RemediationCampaign | None:
        campaign = await self.get_by_id(campaign_id)
        if campaign is None:
            return None
        for field, value in updates.items():
            setattr(campaign, field, value)
        await self._session.commit()
        await self._session.refresh(campaign)
        return campaign

    async def get_campaign_resource(
        self,
        campaign_id: uuid.UUID,
        resource_id: uuid.UUID,
    ) -> CampaignResource | None:
        result = await self._session.execute(
            select(CampaignResource).where(
                CampaignResource.campaign_id == campaign_id,
                CampaignResource.resource_id == resource_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_resource_status(
        self,
        campaign_resource: CampaignResource,
        new_status: str,
        status_updated_at,
    ) -> CampaignResource:
        campaign_resource.remediation_status = new_status
        campaign_resource.status_updated_at = status_updated_at
        await self._session.commit()
        await self._session.refresh(campaign_resource)
        return campaign_resource

    async def get_progress(
        self,
        campaign_id: uuid.UUID,
    ) -> dict[str, int]:
        """Return {status: count} for a campaign's resources."""
        result = await self._session.execute(
            select(
                CampaignResource.remediation_status,
                sa_func.count(CampaignResource.id),
            )
            .where(CampaignResource.campaign_id == campaign_id)
            .group_by(CampaignResource.remediation_status)
        )
        return {row[0]: row[1] for row in result.all()}

    async def get_campaign_compliance_cost(
        self,
        campaign_id: uuid.UUID,
    ) -> tuple[Decimal, Decimal]:
        """Return (total_cost, fixed_cost) for campaign resources."""
        result = await self._session.execute(
            select(
                sa_func.coalesce(sa_func.sum(CampaignResource.resource_cost), 0),
                sa_func.coalesce(
                    sa_func.sum(
                        case(
                            (
                                CampaignResource.remediation_status == "fixed",
                                CampaignResource.resource_cost,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ),
            ).where(CampaignResource.campaign_id == campaign_id)
        )
        row = result.one()
        return row[0], row[1]
