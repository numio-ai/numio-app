"""Smoke tests for IA v2 policies scaffold."""

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
def _reset_policies():
    from numio.api.ia_v2_policies import _POLICIES
    _POLICIES.clear()
    yield
    _POLICIES.clear()


async def test_list_policies_seeds_on_first_call(client):
    resp = await client.get("/api/v1/policies")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] >= 7
    assert body["open_violations_total"] > 0
    modes = {p["mode"] for p in body["policies"]}
    assert modes == {"block", "warn", "auto"}


async def test_create_policy_returns_201(client):
    resp = await client.post(
        "/api/v1/policies",
        json={"name": "Test policy", "type": "CI guard", "mode": "warn"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Test policy"
    assert body["mode"] == "warn"


async def test_patch_policy_flips_enabled(client):
    await client.get("/api/v1/policies")
    resp = await client.patch("/api/v1/policies/p-1", json={"enabled": False})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


async def test_patch_unknown_policy_404(client):
    resp = await client.patch("/api/v1/policies/p-nope", json={"enabled": False})
    assert resp.status_code == 404


async def test_bulk_disable_flips_multiple_policies(client):
    await client.get("/api/v1/policies")
    resp = await client.post(
        "/api/v1/policies/bulk",
        json={"action": "disable", "policy_ids": ["p-1", "p-2", "p-3"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["accepted"] == 3
    after = (await client.get("/api/v1/policies")).json()
    by_id = {p["id"]: p for p in after["policies"]}
    assert by_id["p-1"]["enabled"] is False
    assert by_id["p-2"]["enabled"] is False
    assert by_id["p-3"]["enabled"] is False


async def test_bulk_change_mode_requires_target_mode(client):
    await client.get("/api/v1/policies")
    resp = await client.post(
        "/api/v1/policies/bulk",
        json={"action": "change_mode", "policy_ids": ["p-1"]},
    )
    body = resp.json()
    assert body["accepted"] == 0
    assert body["rejected"] == 1


async def test_bulk_change_mode_applies(client):
    await client.get("/api/v1/policies")
    resp = await client.post(
        "/api/v1/policies/bulk",
        json={"action": "change_mode", "policy_ids": ["p-1"], "target_mode": "warn"},
    )
    assert resp.json()["accepted"] == 1
    after = (await client.get("/api/v1/policies")).json()
    by_id = {p["id"]: p for p in after["policies"]}
    assert by_id["p-1"]["mode"] == "warn"


async def test_delete_policy(client):
    await client.get("/api/v1/policies")
    resp = await client.delete("/api/v1/policies/p-1")
    assert resp.status_code == 204
    after = (await client.get("/api/v1/policies")).json()
    ids = {p["id"] for p in after["policies"]}
    assert "p-1" not in ids
