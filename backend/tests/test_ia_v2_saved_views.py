"""Smoke tests for the IA v2 saved-views scaffold."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client(db_session):
    """Full app with the primary session overridden to the per-test transaction."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override():
        yield db_session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


async def test_list_saved_views_by_scope_returns_view_list(client):
    response = await client.get("/api/v1/saved-views", params={"scope": "usage"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert "views" in body
    assert "count" in body
    assert body["count"] == len(body["views"])
    if body["views"]:
        first = body["views"][0]
        assert first["scope"] == "usage"
        assert "query_json" in first
        assert "shared_at_workspace" in first


async def test_list_saved_views_requires_scope_query_param(client):
    response = await client.get("/api/v1/saved-views")
    assert response.status_code == 422


async def test_list_saved_views_rejects_invalid_scope(client):
    response = await client.get("/api/v1/saved-views", params={"scope": "nonsense"})
    assert response.status_code == 422


async def test_create_saved_view_returns_201_with_id(client):
    payload = {
        "scope": "resources",
        "name": "Big spenders",
        "query_json": {"minSaving": 1000},
        "shared_at_workspace": True,
    }
    response = await client.post("/api/v1/saved-views", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["scope"] == "resources"
    assert body["name"] == "Big spenders"
    assert body["shared_at_workspace"] is True
    assert body["query_json"] == {"minSaving": 1000}
    assert "id" in body


async def test_patch_saved_view_echoes_updates(client):
    view_id = "11111111-1111-1111-1111-111111111111"
    response = await client.patch(
        f"/api/v1/saved-views/{view_id}",
        json={"name": "Renamed", "shared_at_workspace": True},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == view_id
    assert body["name"] == "Renamed"
    assert body["shared_at_workspace"] is True


async def test_delete_saved_view_returns_204(client):
    view_id = "11111111-1111-1111-1111-111111111111"
    response = await client.delete(f"/api/v1/saved-views/{view_id}")
    assert response.status_code == 204


async def test_set_default_saved_view_returns_view_with_default_flag(client):
    view_id = "22222222-2222-2222-2222-222222222222"
    response = await client.post(f"/api/v1/saved-views/{view_id}/set-default")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == view_id
    assert body["default_for_owner"] is True
