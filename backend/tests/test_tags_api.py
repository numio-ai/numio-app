"""Tests for the tag apply / preview API — risky gate, bulk cap, dedupe."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from numio.core.tag_write_service import ActionEventResult
from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord


@pytest.fixture
async def client(db_session):
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
async def _clean(db_session):
    await db_session.execute(delete(CostRecord))
    await db_session.execute(delete(CloudResource))
    yield
    await db_session.execute(delete(CostRecord))
    await db_session.execute(delete(CloudResource))


async def _resource(db_session, workspace_id, n, *, env=None, spend=None):
    tags = {"env": env} if env else {}
    r = CloudResource(
        workspace_id=workspace_id,
        account_id="555555555555",
        region="us-east-1",
        service="ec2",
        resource_type="instance",
        resource_id=f"i-{n:04d}",
        arn=f"arn:aws:ec2:us-east-1:555555555555:instance/i-{n:04d}",
        name=f"res-{n}",
        tags=tags,
    )
    db_session.add(r)
    await db_session.flush()
    if spend is not None:
        db_session.add(
            CostRecord(
                workspace_id=workspace_id,
                provider="aws",
                data_source="cur",
                line_item_id=f"li-{n}",
                billing_period=date(2026, 5, 1),
                usage_account_id="555555555555",
                usage_start=datetime(2026, 5, 1, tzinfo=timezone.utc),
                usage_end=datetime(2026, 5, 2, tzinfo=timezone.utc),
                service="ec2",
                resource_id=f"i-{n:04d}",
                line_item_type="Usage",
                unblended_cost=Decimal(str(spend)),
                currency="USD",
            )
        )
        await db_session.flush()
    return r


# --- preview ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_preview_not_risky(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="dev", spend=10)
    resp = await client.post(
        "/api/v1/tags/apply/preview",
        json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["risky"] is False
    assert body["affected_resources"][0]["monthly_cost"] == 10.0


@pytest.mark.asyncio
async def test_preview_risky_on_prod(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 2, env="production", spend=5)
    resp = await client.post(
        "/api/v1/tags/apply/preview",
        json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}]},
    )
    body = resp.json()
    assert body["risky"] is True
    assert any("production" in reason for reason in body["reasons"])


@pytest.mark.asyncio
async def test_preview_risky_on_cost(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 3, env="dev", spend=1500)
    resp = await client.post(
        "/api/v1/tags/apply/preview",
        json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}]},
    )
    body = resp.json()
    assert body["risky"] is True
    assert any("1,000" in reason or "exceeds" in reason for reason in body["reasons"])


# --- apply -----------------------------------------------------------------


def _result():
    import uuid

    return ActionEventResult(
        event_id=uuid.uuid4(),
        status="success",
        summary={"item_count": 1, "success_count": 1, "failure_count": 0},
    )


@pytest.mark.asyncio
async def test_apply_success(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="dev", spend=5)
    with patch("numio.api.tags.apply_tag_changes", return_value=_result()) as svc:
        resp = await client.post(
            "/api/v1/tags/apply",
            json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}]},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    svc.assert_called_once()
    # operation_type derived as tag_apply (value set, not None).
    assert svc.call_args.kwargs["operation_type"] == "tag_apply"


@pytest.mark.asyncio
async def test_apply_bulk_limit(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="dev", spend=1)
    changes = [{"resource_id": str(r.id), "tag_key": f"k{i}", "value": "v"} for i in range(101)]
    with patch("numio.api.tags.apply_tag_changes") as svc:
        resp = await client.post("/api/v1/tags/apply", json={"changes": changes})
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "BULK_LIMIT_EXCEEDED"
    svc.assert_not_called()


@pytest.mark.asyncio
async def test_apply_risky_not_confirmed(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="production", spend=5)
    with patch("numio.api.tags.apply_tag_changes") as svc:
        resp = await client.post(
            "/api/v1/tags/apply",
            json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}]},
        )
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "RISKY_WRITE_NOT_CONFIRMED"
    svc.assert_not_called()


@pytest.mark.asyncio
async def test_apply_risky_confirmed_proceeds(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="production", spend=5)
    with patch("numio.api.tags.apply_tag_changes", return_value=_result()) as svc:
        resp = await client.post(
            "/api/v1/tags/apply",
            json={
                "changes": [{"resource_id": str(r.id), "tag_key": "team", "value": "x"}],
                "confirm_risky": True,
            },
        )
    assert resp.status_code == 200
    svc.assert_called_once()


@pytest.mark.asyncio
async def test_apply_rejects_empty_value(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="dev", spend=1)
    with patch("numio.api.tags.apply_tag_changes") as svc:
        resp = await client.post(
            "/api/v1/tags/apply",
            json={"changes": [{"resource_id": str(r.id), "tag_key": "team", "value": ""}]},
        )
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INVALID_TAG_VALUE"
    svc.assert_not_called()


@pytest.mark.asyncio
async def test_apply_dedupes_changes(client, db_session, default_workspace_id):
    r = await _resource(db_session, default_workspace_id, 1, env="dev", spend=1)
    with patch("numio.api.tags.apply_tag_changes", return_value=_result()) as svc:
        resp = await client.post(
            "/api/v1/tags/apply",
            json={
                "changes": [
                    {"resource_id": str(r.id), "tag_key": "team", "value": "a"},
                    {"resource_id": str(r.id), "tag_key": "team", "value": "b"},
                ]
            },
        )
    assert resp.status_code == 200
    # Deduped to one change; last write wins.
    passed_changes = svc.call_args.args[2]
    assert len(passed_changes) == 1
    assert passed_changes[0].value == "b"
