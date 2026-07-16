"""IA v2 Inbox badge + finding ack — backed by the ``finding_acks`` table.

Replaces the original module-dict scaffold (see git history) with persistent
state per ``docs/conventions/numio-patterns.md`` §1–4.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.db.finding_ack_repository import FindingAckRepository
from numio.db.session import get_session
from numio.schemas.ia_v2_inbox import AckFindingResponse, InboxBadgeResponse

router = APIRouter(prefix="/inbox", tags=["ia-v2-inbox"])


@router.get(
    "/badge",
    response_model=InboxBadgeResponse,
    summary="Get the inbox unread + triage counts",
)
async def get_badge(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InboxBadgeResponse:
    """Return live unread/triage/critical counts derived from ``findings``.

    * ``unread_count`` — open findings in this workspace with no ack.
    * ``triage_count`` — same surface as unread today; the schema keeps it
      separate so a future per-type filter (e.g. exclude resolved-but-not-
      acked) can diverge without breaking the contract.
    * ``critical_count`` — unread findings whose ``severity = 'critical'``.
    """
    repo = FindingAckRepository(session, str(current_user.workspace_id))
    unread = await repo.count_unread_findings()
    critical = await repo.count_unread_by_severity("critical")
    return InboxBadgeResponse(
        unread_count=unread,
        triage_count=unread,
        critical_count=critical,
        fetched_at=datetime.now(timezone.utc),
    )


@router.post(
    "/findings/{finding_id}/ack",
    response_model=AckFindingResponse,
    summary="Acknowledge a finding; reduces the unread count",
)
async def ack_finding(
    finding_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AckFindingResponse:
    """Workspace-wide ack of a finding. Idempotent.

    A second ack for the same ``(workspace_id, finding_id)`` is a no-op —
    ``new_unread_count`` is identical to the first call's. 404 when the
    finding does not exist in this workspace.
    """
    repo = FindingAckRepository(session, str(current_user.workspace_id))
    ack = await repo.ack_finding(finding_id, current_user.id)
    if ack is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    unread = await repo.count_unread_findings()
    return AckFindingResponse(
        finding_id=str(finding_id),
        acknowledged=True,
        new_unread_count=unread,
    )
