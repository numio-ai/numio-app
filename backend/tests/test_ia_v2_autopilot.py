"""Smoke tests for the IA v2 Autopilot rules scaffold."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


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
def _reset_rule_store():
    from numio.api.ia_v2_autopilot import _PAUSED_ALL, _RULES

    _RULES.clear()
    _PAUSED_ALL.clear()
    yield
    _RULES.clear()
    _PAUSED_ALL.clear()


async def test_list_rules_seeds_on_first_call(client):
    resp = await client.get("/api/v1/autopilot/rules")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] >= 3
    assert {"rule-hibernate-dev", "rule-pr-cost-guard", "rule-reclaim-ebs"} <= {r["id"] for r in body["rules"]}


async def test_create_rule_with_dry_run_starts_paused(client):
    resp = await client.post("/api/v1/autopilot/rules", json={"name": "Test", "dry_run": True})
    assert resp.status_code == 201
    assert resp.json()["state"] == "paused"


async def test_create_rule_without_dry_run_starts_active(client):
    resp = await client.post("/api/v1/autopilot/rules", json={"name": "Test", "dry_run": False})
    assert resp.json()["state"] == "active"


async def test_archive_then_delete(client):
    await client.get("/api/v1/autopilot/rules")
    resp = await client.delete("/api/v1/autopilot/rules/rule-hibernate-dev")
    assert resp.status_code == 409  # archive first
    resp = await client.post("/api/v1/autopilot/rules/rule-hibernate-dev/archive")
    assert resp.status_code == 200
    assert resp.json()["archived"] is True
    resp = await client.delete("/api/v1/autopilot/rules/rule-hibernate-dev")
    assert resp.status_code == 204


async def test_dry_run_returns_would_act_on(client):
    await client.get("/api/v1/autopilot/rules")
    resp = await client.post("/api/v1/autopilot/rules/rule-hibernate-dev/dry-run")
    assert resp.status_code == 200
    body = resp.json()
    assert body["rule_id"] == "rule-hibernate-dev"
    assert body["would_act_on"]


async def test_pause_all_then_resume_all(client):
    await client.get("/api/v1/autopilot/rules")
    resp = await client.post("/api/v1/autopilot/pause-all", json={})
    assert resp.status_code == 200
    assert resp.json()["paused_all"] is True
    assert resp.json()["affected_rule_count"] >= 3
    # After pause, no active rules
    after = await client.get("/api/v1/autopilot/rules")
    states = {r["state"] for r in after.json()["rules"]}
    assert states == {"paused"}
    # Resume restores
    resp = await client.post("/api/v1/autopilot/resume-all")
    assert resp.json()["paused_all"] is False
    after = await client.get("/api/v1/autopilot/rules")
    states = {r["state"] for r in after.json()["rules"]}
    assert states == {"active"}


async def test_history_returns_actions_with_undo_states(client):
    resp = await client.get("/api/v1/autopilot/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] >= 3
    undo_states = {a["undo_state"] for a in body["actions"]}
    assert {"within", "advisory", "expired"} <= undo_states


async def test_history_filter_by_rule(client):
    resp = await client.get("/api/v1/autopilot/history", params={"rule_id": "rule-hibernate-dev"})
    body = resp.json()
    assert all(a["rule_id"] == "rule-hibernate-dev" for a in body["actions"])


async def test_undo_endpoint_returns_undone(client):
    resp = await client.post("/api/v1/autopilot/history/ah-1/undo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["undone"] is True
