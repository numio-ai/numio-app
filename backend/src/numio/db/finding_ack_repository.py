"""Repository for finding acknowledgements — backs the IA v2 Inbox badge.

Workspace scoping is enforced at the constructor — every query carries
``workspace_id`` in its where clause (per ``docs/conventions/numio-patterns.md`` §1).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.finding import Finding
from numio.models.finding_ack import FindingAck


class FindingAckRepository:
    """CRUD operations for finding acks — all queries scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def ack_finding(
        self, finding_id: uuid.UUID, user_id: uuid.UUID | None
    ) -> FindingAck | None:
        """Insert an ack idempotently; return the resulting row.

        Returns ``None`` when the finding does not exist in this workspace —
        the router maps this to HTTP 404 without leaking which case it was.

        Idempotency: a second ack for the same ``(workspace_id, finding_id)``
        is a no-op (``ON CONFLICT DO NOTHING``) and returns the original row,
        preserving the first ack's ``user_id`` and ``acknowledged_at``.
        """
        # Verify the finding belongs to this workspace before inserting.
        # The FK guarantees the finding exists; the workspace_id check
        # prevents acks against findings in other workspaces.
        finding = await self._session.execute(
            select(Finding.id).where(
                Finding.id == finding_id,
                Finding.workspace_id == self._workspace_id,
            )
        )
        if finding.scalar_one_or_none() is None:
            return None

        stmt = (
            pg_insert(FindingAck)
            .values(
                workspace_id=self._workspace_id,
                finding_id=finding_id,
                user_id=user_id,
            )
            .on_conflict_do_nothing(index_elements=["workspace_id", "finding_id"])
        )
        await self._session.execute(stmt)
        await self._session.commit()

        # Fetch the canonical row (either the one we just inserted or a prior one).
        existing = await self._session.execute(
            select(FindingAck).where(
                FindingAck.workspace_id == self._workspace_id,
                FindingAck.finding_id == finding_id,
            )
        )
        return existing.scalar_one()

    async def count_unread_findings(self) -> int:
        """Count findings in this workspace with no ack."""
        return await self._count_unread(severity=None)

    async def count_unread_by_severity(self, severity: str) -> int:
        """Count findings in this workspace with no ack matching ``severity``."""
        return await self._count_unread(severity=severity)

    async def _count_unread(self, severity: str | None) -> int:
        ack_subq = (
            select(FindingAck.finding_id)
            .where(FindingAck.workspace_id == self._workspace_id)
            .scalar_subquery()
        )
        stmt = select(func.count(Finding.id)).where(
            Finding.workspace_id == self._workspace_id,
            Finding.status == "open",
            Finding.id.not_in(ack_subq),
        )
        if severity is not None:
            stmt = stmt.where(Finding.severity == severity)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())
