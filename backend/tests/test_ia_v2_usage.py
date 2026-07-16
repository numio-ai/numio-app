"""Smoke tests for the IA v2 Usage scaffold."""

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


async def test_get_usage_cloud_default(client):
    resp = await client.get("/api/v1/usage")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["scope"] == "cloud"
    assert body["range"] == "30D"
    assert body["group_by"] == "tag:cost-center"
    assert body["total"]
    assert isinstance(body["series"], list) and body["series"]
    assert isinstance(body["breakdown"], list) and body["breakdown"]
    untagged = [r for r in body["breakdown"] if r["untagged"]]
    assert len(untagged) == 1
    assert untagged[0]["name"] == "Untagged"


async def test_get_usage_ai_scope(client):
    resp = await client.get("/api/v1/usage", params={"scope": "ai"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["scope"] == "ai"
    assert body["forecast"] is None


async def test_get_usage_range_param_changes_series_length(client):
    r7 = (await client.get("/api/v1/usage", params={"range": "7D"})).json()
    r30 = (await client.get("/api/v1/usage", params={"range": "30D"})).json()
    assert len(r7["series"][0]["points"]) == 7
    assert len(r30["series"][0]["points"]) == 30


async def test_get_usage_invalid_range_returns_422(client):
    resp = await client.get("/api/v1/usage", params={"range": "nonsense"})
    assert resp.status_code == 422


async def test_tag_keys_endpoint_returns_schema_keys(client):
    resp = await client.get("/api/v1/usage/tag-keys")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert "env" in body
    assert "team" in body
    assert "cost-center" in body


async def test_get_usage_exposes_available_dimensions(client):
    resp = await client.get("/api/v1/usage")
    body = resp.json()
    assert set(body["platform_dims_available"]) >= {"service", "account", "region"}
    assert set(body["tag_keys_available"]) >= {"env", "team", "cost-center"}
