"""Tests for the Data Explorer saved-query CRUD endpoints."""

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


# ---------------------------------------------------------------------------
# CRUD happy paths
# ---------------------------------------------------------------------------


async def test_list_empty(client):
    resp = await client.get("/api/v1/data-explorer/queries")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {"items": [], "count": 0}


async def test_create_then_list(client):
    payload = {
        "name": "Workspaces snapshot",
        "sql": "SELECT * FROM workspaces",
        "description": "All workspaces",
    }
    resp = await client.post("/api/v1/data-explorer/queries", json=payload)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["name"] == payload["name"]
    assert created["sql"] == payload["sql"]
    assert created["description"] == payload["description"]
    assert created["created_by_user_id"] == created["updated_by_user_id"]
    assert created["created_at"]
    assert created["updated_at"]

    listing = (await client.get("/api/v1/data-explorer/queries")).json()
    assert listing["count"] == 1
    assert listing["items"][0]["id"] == created["id"]


async def test_get_by_id(client):
    created = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "X", "sql": "SELECT 1"},
        )
    ).json()
    resp = await client.get(f"/api/v1/data-explorer/queries/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_by_id_404(client):
    resp = await client.get("/api/v1/data-explorer/queries/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


async def test_update_partial(client):
    created = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "Old", "sql": "SELECT 1", "description": "old"},
        )
    ).json()
    resp = await client.put(
        f"/api/v1/data-explorer/queries/{created['id']}",
        json={"name": "New"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "New"
    assert body["sql"] == "SELECT 1"
    assert body["description"] == "old"


async def test_update_clears_description(client):
    created = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "Y", "sql": "SELECT 1", "description": "to clear"},
        )
    ).json()
    resp = await client.put(
        f"/api/v1/data-explorer/queries/{created['id']}",
        json={"description": None},
    )
    assert resp.status_code == 200
    assert resp.json()["description"] is None


async def test_update_404(client):
    resp = await client.put(
        "/api/v1/data-explorer/queries/00000000-0000-0000-0000-000000000099",
        json={"name": "X"},
    )
    assert resp.status_code == 404


async def test_delete(client):
    created = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "Z", "sql": "SELECT 1"},
        )
    ).json()
    resp = await client.delete(f"/api/v1/data-explorer/queries/{created['id']}")
    assert resp.status_code == 204
    follow = await client.get(f"/api/v1/data-explorer/queries/{created['id']}")
    assert follow.status_code == 404


async def test_delete_404(client):
    resp = await client.delete("/api/v1/data-explorer/queries/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Name uniqueness
# ---------------------------------------------------------------------------


async def test_create_name_collision_returns_409(client):
    body = {"name": "dup", "sql": "SELECT 1"}
    first = await client.post("/api/v1/data-explorer/queries", json=body)
    assert first.status_code == 201
    second = await client.post("/api/v1/data-explorer/queries", json=body)
    assert second.status_code == 409
    err = second.json()
    assert err["error_code"] == "HTTP_409"
    assert "dup" in err["message"]


async def test_update_to_existing_name_returns_409(client):
    a = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "a", "sql": "SELECT 1"},
        )
    ).json()
    b = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "b", "sql": "SELECT 1"},
        )
    ).json()
    resp = await client.put(
        f"/api/v1/data-explorer/queries/{b['id']}",
        json={"name": "a"},
    )
    assert resp.status_code == 409
    # And the row still has its original name.
    again = (await client.get(f"/api/v1/data-explorer/queries/{b['id']}")).json()
    assert again["name"] == "b"
    # a still exists too
    assert a["id"] != b["id"]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


async def test_create_missing_name_rejected(client):
    resp = await client.post("/api/v1/data-explorer/queries", json={"sql": "SELECT 1"})
    assert resp.status_code == 422


async def test_create_empty_name_rejected(client):
    resp = await client.post(
        "/api/v1/data-explorer/queries",
        json={"name": "", "sql": "SELECT 1"},
    )
    assert resp.status_code == 422


async def test_create_overlong_name_rejected(client):
    resp = await client.post(
        "/api/v1/data-explorer/queries",
        json={"name": "x" * 121, "sql": "SELECT 1"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Audit fields
# ---------------------------------------------------------------------------


async def test_audit_fields_set_to_caller(client, db_session):
    """created_by and updated_by should match the synthetic admin in bypass mode."""
    from sqlalchemy import select

    from numio.models.user import User

    created = (
        await client.post(
            "/api/v1/data-explorer/queries",
            json={"name": "audit", "sql": "SELECT 1"},
        )
    ).json()
    # Synthetic admin user is inserted on first /me call; check directly.
    res = await db_session.execute(select(User).where(User.email == "admin@localhost"))
    admin = res.scalar_one()
    assert created["created_by_user_id"] == str(admin.id)
    assert created["updated_by_user_id"] == str(admin.id)
