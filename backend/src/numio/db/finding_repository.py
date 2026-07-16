"""Workspace-scoped data access layer for findings management."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.models.finding import Finding, FindingTransition
from numio.schemas.finding import CreateFindingRequest


class FindingRepository:
    """Read/write operations for findings with deduplication."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    # --- Create with dedup ---

    async def create_or_update(self, data: CreateFindingRequest) -> tuple[Finding, bool]:
        """Create a finding or update last_seen_at if a matching one exists.

        Returns (finding, created) where created=True if new, False if deduped.
        """
        existing = await self._get_by_dedup_key(data.type, data.resource_id, data.detection_source)
        if existing is not None:
            existing.last_seen_at = datetime.now(timezone.utc)
            await self._session.commit()
            await self._session.refresh(existing)
            return existing, False

        finding = Finding(
            workspace_id=self._workspace_id,
            type=data.type,
            severity=data.severity,
            status="open",
            title=data.title,
            description=data.description,
            resource_id=data.resource_id,
            detection_source=data.detection_source,
            suggested_action=data.suggested_action,
            estimated_cost_impact=data.estimated_cost_impact,
        )
        self._session.add(finding)
        await self._session.commit()
        await self._session.refresh(finding)
        return finding, True

    async def _get_by_dedup_key(
        self, finding_type: str, resource_id: str, detection_source: str
    ) -> Finding | None:
        result = await self._session.execute(
            select(Finding).where(
                Finding.workspace_id == self._workspace_id,
                Finding.type == finding_type,
                Finding.resource_id == resource_id,
                Finding.detection_source == detection_source,
            )
        )
        return result.scalar_one_or_none()

    # --- Read operations ---

    async def list_findings(
        self,
        *,
        finding_type: str | None = None,
        severity: str | None = None,
        status: str | None = None,
        resource_id: str | None = None,
        detection_source: str | None = None,
        detected_after: datetime | None = None,
        detected_before: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Finding], int]:
        """List findings with optional filters. Returns (findings, total_count)."""
        conditions = [Finding.workspace_id == self._workspace_id]
        if finding_type is not None:
            conditions.append(Finding.type == finding_type)
        if severity is not None:
            conditions.append(Finding.severity == severity)
        if status is not None:
            conditions.append(Finding.status == status)
        if resource_id is not None:
            conditions.append(Finding.resource_id == resource_id)
        if detection_source is not None:
            conditions.append(Finding.detection_source == detection_source)
        if detected_after is not None:
            conditions.append(Finding.detected_at >= detected_after)
        if detected_before is not None:
            conditions.append(Finding.detected_at <= detected_before)

        # Count
        from sqlalchemy import func as sa_func

        count_result = await self._session.execute(
            select(sa_func.count(Finding.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        # Fetch page
        result = await self._session.execute(
            select(Finding)
            .where(*conditions)
            .order_by(Finding.detected_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, finding_id: uuid.UUID) -> Finding | None:
        result = await self._session.execute(
            select(Finding)
            .where(Finding.id == finding_id, Finding.workspace_id == self._workspace_id)
            .options(selectinload(Finding.transitions))
        )
        return result.scalar_one_or_none()

    # --- State transitions ---

    async def acknowledge(
        self, finding_id: uuid.UUID, changed_by: str | None = None
    ) -> Finding | None:
        finding = await self._get_simple(finding_id)
        if finding is None:
            return None
        return await self._transition(finding, "acknowledged", changed_by=changed_by)

    async def resolve(
        self, finding_id: uuid.UUID, changed_by: str | None = None, reason: str | None = None
    ) -> Finding | None:
        finding = await self._get_simple(finding_id)
        if finding is None:
            return None
        return await self._transition(finding, "resolved", changed_by=changed_by, reason=reason)

    async def suppress(
        self, finding_id: uuid.UUID, reason: str, changed_by: str | None = None
    ) -> Finding | None:
        finding = await self._get_simple(finding_id)
        if finding is None:
            return None
        finding.suppression_reason = reason
        return await self._transition(finding, "suppressed", changed_by=changed_by, reason=reason)

    # --- Bulk operations ---

    async def bulk_acknowledge(
        self, finding_ids: list[uuid.UUID], changed_by: str | None = None
    ) -> list[uuid.UUID]:
        updated_ids: list[uuid.UUID] = []
        for fid in finding_ids:
            result = await self.acknowledge(fid, changed_by=changed_by)
            if result is not None:
                updated_ids.append(result.id)
        return updated_ids

    async def bulk_resolve(
        self, finding_ids: list[uuid.UUID], changed_by: str | None = None
    ) -> list[uuid.UUID]:
        updated_ids: list[uuid.UUID] = []
        for fid in finding_ids:
            result = await self.resolve(fid, changed_by=changed_by)
            if result is not None:
                updated_ids.append(result.id)
        return updated_ids

    # --- Internal helpers ---

    async def _get_simple(self, finding_id: uuid.UUID) -> Finding | None:
        """Get finding without eager-loading transitions."""
        result = await self._session.execute(
            select(Finding).where(
                Finding.id == finding_id, Finding.workspace_id == self._workspace_id
            )
        )
        return result.scalar_one_or_none()

    async def _transition(
        self,
        finding: Finding,
        to_status: str,
        changed_by: str | None = None,
        reason: str | None = None,
    ) -> Finding:
        """Apply a state transition and record it."""
        from_status = finding.status
        now = datetime.now(timezone.utc)

        finding.status = to_status
        if to_status == "acknowledged":
            finding.acknowledged_at = now
        elif to_status == "resolved":
            finding.resolved_at = now

        transition = FindingTransition(
            finding_id=finding.id,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            reason=reason,
        )
        self._session.add(transition)
        await self._session.commit()
        await self._session.refresh(finding)
        return finding
