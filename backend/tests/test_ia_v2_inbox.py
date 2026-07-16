"""Integration tests for IA v2 inbox badge — persisted via ``finding_acks``.

Replaces the original module-dict smoke tests. Exercises the full
router → repo → DB path against the test Postgres per
``docs/conventions/numio-patterns.md`` §8.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from numio.models.finding import Finding
from numio.models.finding_ack import FindingAck


@pytest.fixture
async def client(db_session):
    """ASGI client wired to the function-scoped ``db_session`` transaction."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override():
        yield db_session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture(autouse=True)
async def _clean_inbox_tables(db_session):
    """Tests share the rolled-back ``db_session`` transaction, but the bypass
    user is auto-inserted by ``get_current_user``. Clear ack + finding rows
    pre- and post-test so order-independence holds when run with other suites."""
    await db_session.execute(delete(FindingAck))
    await db_session.execute(delete(Finding))
    yield
    await db_session.execute(delete(FindingAck))
    await db_session.execute(delete(Finding))


async def _seed_finding(
    db_session,
    workspace_id: str,
    *,
    severity: str = "warning",
    status: str = "open",
    resource_id: str | None = None,
    type_: str = "zombie",
) -> uuid.UUID:
    """Insert one minimal open finding; return its id."""
    f = Finding(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        type=type_,
        severity=severity,
        status=status,
        title=f"Test finding {uuid.uuid4().hex[:8]}",
        resource_id=resource_id or f"arn:aws:test:{uuid.uuid4().hex[:8]}",
        detection_source="test",
        estimated_cost_impact=Decimal("0"),
        detected_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    db_session.add(f)
    await db_session.flush()
    return f.id


# --------------------------------------------------------------------------- #
# Badge counts                                                                #
# --------------------------------------------------------------------------- #


async def test_badge_cold_start_unread_equals_open_findings(
    client, db_session, default_workspace_id
):
    """No findings → counts are all zero (replaces hardcoded 11)."""
    resp = await client.get("/api/v1/inbox/badge")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "unread_count": 0,
        "triage_count": 0,
        "critical_count": body["critical_count"],  # 0; assert via separate line
        "fetched_at": body["fetched_at"],
    }
    assert body["critical_count"] == 0
    assert "fetched_at" in body

    # Seed 5 findings, 1 critical — unread reflects real data.
    for _ in range(4):
        await _seed_finding(db_session, default_workspace_id, severity="warning")
    await _seed_finding(db_session, default_workspace_id, severity="critical")
    await db_session.commit()

    resp = await client.get("/api/v1/inbox/badge")
    body = resp.json()
    assert body["unread_count"] == 5
    assert body["triage_count"] == 5
    assert body["critical_count"] == 1


async def test_resolved_findings_do_not_count_as_unread(client, db_session, default_workspace_id):
    """Only ``status='open'`` findings contribute to unread."""
    await _seed_finding(db_session, default_workspace_id, status="open")
    await _seed_finding(db_session, default_workspace_id, status="resolved")
    await _seed_finding(db_session, default_workspace_id, status="suppressed")
    await db_session.commit()

    body = (await client.get("/api/v1/inbox/badge")).json()
    assert body["unread_count"] == 1


# --------------------------------------------------------------------------- #
# Ack behavior                                                                #
# --------------------------------------------------------------------------- #


async def test_ack_decrements_unread(client, db_session, default_workspace_id):
    f1 = await _seed_finding(db_session, default_workspace_id, severity="critical")
    await _seed_finding(db_session, default_workspace_id, severity="warning")
    await db_session.commit()

    before = (await client.get("/api/v1/inbox/badge")).json()
    assert before["unread_count"] == 2
    assert before["critical_count"] == 1

    resp = await client.post(f"/api/v1/inbox/findings/{f1}/ack")
    assert resp.status_code == 200
    body = resp.json()
    assert body["finding_id"] == str(f1)
    assert body["acknowledged"] is True
    assert body["new_unread_count"] == 1

    after = (await client.get("/api/v1/inbox/badge")).json()
    assert after["unread_count"] == 1
    assert after["critical_count"] == 0  # the critical one was acked


async def test_ack_is_idempotent(client, db_session, default_workspace_id):
    """Second ack on the same finding is a no-op; unread does not double-drop."""
    fid = await _seed_finding(db_session, default_workspace_id)
    await _seed_finding(db_session, default_workspace_id)
    await db_session.commit()

    first = await client.post(f"/api/v1/inbox/findings/{fid}/ack")
    second = await client.post(f"/api/v1/inbox/findings/{fid}/ack")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["new_unread_count"] == 1
    assert second.json()["new_unread_count"] == 1

    body = (await client.get("/api/v1/inbox/badge")).json()
    assert body["unread_count"] == 1  # only one finding effectively acked


async def test_ack_unknown_finding_returns_404(client, db_session, default_workspace_id):
    """An ack against a finding that does not exist in this workspace is 404."""
    stranger = uuid.uuid4()
    resp = await client.post(f"/api/v1/inbox/findings/{stranger}/ack")
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Workspace isolation                                                         #
# --------------------------------------------------------------------------- #


async def test_workspace_isolation(client, db_session, default_workspace_id, workspace_factory):
    """Acks in workspace B do not affect workspace A's unread count.

    The HTTP client always resolves to the bypass admin in workspace A
    (default); workspace B's data is inserted directly and asserted to be
    invisible to the client.
    """
    # Workspace A (the caller's): 2 findings
    fa1 = await _seed_finding(db_session, default_workspace_id)
    await _seed_finding(db_session, default_workspace_id)

    # Workspace B: 3 findings, 1 ack
    other_ws = await workspace_factory(slug="other", name="Other Workspace")
    other_ws_id = str(other_ws.id)
    fb1 = await _seed_finding(db_session, other_ws_id)
    await _seed_finding(db_session, other_ws_id)
    await _seed_finding(db_session, other_ws_id)
    db_session.add(FindingAck(workspace_id=other_ws_id, finding_id=fb1, user_id=None))
    await db_session.commit()

    # Caller sees workspace A's 2 unread, not workspace B's 3.
    body = (await client.get("/api/v1/inbox/badge")).json()
    assert body["unread_count"] == 2

    # Acking fa1 reduces A by 1; B is untouched.
    await client.post(f"/api/v1/inbox/findings/{fa1}/ack")
    body = (await client.get("/api/v1/inbox/badge")).json()
    assert body["unread_count"] == 1


async def test_ack_cross_workspace_is_404(client, db_session, workspace_factory):
    """A finding that exists in another workspace is 404 from the caller's."""
    other_ws = await workspace_factory(slug="other2", name="Other 2")
    foreign = await _seed_finding(db_session, str(other_ws.id))
    await db_session.commit()

    resp = await client.post(f"/api/v1/inbox/findings/{foreign}/ack")
    assert resp.status_code == 404
