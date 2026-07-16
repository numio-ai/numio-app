"""Integration tests for audit action events — repository, endpoints, filters, cascade.

Exercises router → repo → DB against the test Postgres.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from numio.db.audit_action_event_repository import AuditActionEventRepository
from numio.models.audit_action_event import AuditActionEvent, AuditActionEventItem


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
async def _clean_tables(db_session):
    await db_session.execute(delete(AuditActionEventItem))
    await db_session.execute(delete(AuditActionEvent))
    yield
    await db_session.execute(delete(AuditActionEventItem))
    await db_session.execute(delete(AuditActionEvent))


@pytest.fixture
def repo(db_session, default_workspace_id):
    # Scope to the seeded default workspace's UUID so rows written here are
    # visible to auth-protected endpoints, which resolve workspace_id from
    # the bypass admin user.
    return AuditActionEventRepository(db_session, default_workspace_id)


async def _seed_event(
    repo,
    *,
    operation_type: str = "tag_apply",
    actor: str = "admin@test.com",
    status: str = "success",
    item_count: int = 1,
) -> AuditActionEvent:
    event = await repo.create_event(
        actor=actor,
        operation_type=operation_type,
        status=status,
        summary={"item_count": item_count, "success_count": item_count, "failure_count": 0},
    )
    for i in range(item_count):
        repo.add_item(
            event_id=event.id,
            target_type="aws_resource",
            target_id=f"arn:aws:ec2:::instance/i-{i}",
            change_key="env",
            status="success",
            before_value=None,
            after_value="production",
            aws_request_id=f"req-{i}",
            completed_at=datetime.now(timezone.utc),
        )
    await repo.finalize_event(
        event,
        status=status,
        summary={"item_count": item_count, "success_count": item_count, "failure_count": 0},
        completed_at=datetime.now(timezone.utc),
    )
    return event


# --- Repository ------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_event_with_items_and_fetch(repo, db_session):
    event = await _seed_event(repo, item_count=3)
    fetched = await repo.get_with_items(event.id)
    assert fetched is not None
    assert fetched.operation_type == "tag_apply"
    assert len(fetched.items) == 3


@pytest.mark.asyncio
async def test_cascade_delete_removes_items(repo, db_session):
    event = await _seed_event(repo, item_count=2)
    await db_session.execute(delete(AuditActionEvent).where(AuditActionEvent.id == event.id))
    await db_session.flush()
    remaining = (await db_session.execute(select(AuditActionEventItem))).scalars().all()
    assert remaining == []


@pytest.mark.asyncio
async def test_list_filters(repo):
    await _seed_event(repo, operation_type="tag_apply", actor="a@x.com", status="success")
    await _seed_event(repo, operation_type="tag_remove", actor="b@x.com", status="failure")

    events, total = await repo.list_events(operation_type="tag_remove")
    assert total == 1 and events[0].operation_type == "tag_remove"

    events, total = await repo.list_events(actor="a@x.com")
    assert total == 1 and events[0].actor == "a@x.com"

    events, total = await repo.list_events(status="failure")
    assert total == 1 and events[0].status == "failure"


@pytest.mark.asyncio
async def test_list_date_range(repo):
    await _seed_event(repo)
    future = datetime.now(timezone.utc) + timedelta(days=1)
    _, total = await repo.list_events(start_date=future)
    assert total == 0


# --- Endpoints -------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_endpoint_empty(client):
    resp = await client.get("/api/v1/audit-action-events")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["events"] == []


@pytest.mark.asyncio
async def test_list_endpoint_and_optype_filter(client, repo):
    await _seed_event(repo, operation_type="tag_apply")
    await _seed_event(repo, operation_type="tag_remove")

    resp = await client.get("/api/v1/audit-action-events")
    assert resp.json()["count"] == 2

    resp = await client.get("/api/v1/audit-action-events?operation_type=tag_remove")
    body = resp.json()
    assert body["count"] == 1
    assert body["events"][0]["operation_type"] == "tag_remove"


@pytest.mark.asyncio
async def test_detail_endpoint_returns_items(client, repo):
    event = await _seed_event(repo, item_count=2)
    resp = await client.get(f"/api/v1/audit-action-events/{event.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(event.id)
    assert len(body["items"]) == 2
    assert body["items"][0]["aws_request_id"] is not None


@pytest.mark.asyncio
async def test_detail_endpoint_404(client):
    resp = await client.get("/api/v1/audit-action-events/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_action_event_routes_registered():
    from numio.main import app

    paths = [route.path for route in app.routes]
    assert "/api/v1/audit-action-events" in paths
    assert "/api/v1/audit-action-events/{event_id}" in paths
