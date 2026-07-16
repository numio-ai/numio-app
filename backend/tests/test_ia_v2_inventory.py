"""Smoke tests for the IA v2 inventory scaffold."""

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


async def test_columns_available_returns_three_sections(client):
    resp = await client.get("/api/v1/inventory/columns/available")
    assert resp.status_code == 200
    cols = resp.json()["columns"]
    sections = {c["section"] for c in cols}
    assert sections == {"always", "builtin", "tag"}
    always_ids = {c["id"] for c in cols if c["always"]}
    assert always_ids == {"name", "svc", "spend"}
    tag_cols = [c for c in cols if c["tag_column"]]
    assert {c["id"] for c in tag_cols} >= {"tag:env", "tag:team", "tag:cost-center"}


async def test_list_resources_default_columns(client):
    resp = await client.get("/api/v1/inventory/resources")
    assert resp.status_code == 200
    body = resp.json()
    assert body["columns_returned"][:3] == ["name", "svc", "spend"]
    assert body["total_count"] == 1284
    assert len(body["rows"]) > 0


async def test_list_resources_cols_param(client):
    resp = await client.get("/api/v1/inventory/resources", params={"cols": "name,svc,spend,tag:env"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["columns_returned"] == ["name", "svc", "spend", "tag:env"]


async def test_list_resources_search_filters(client):
    resp = await client.get("/api/v1/inventory/resources", params={"search": "payments"})
    assert resp.status_code == 200
    body = resp.json()
    assert all("payments" in (r["name"] + r["id"] + str(r["tags"])).lower() for r in body["rows"])


async def test_bulk_export_requires_ids_or_view(client):
    resp = await client.post("/api/v1/inventory/bulk/export", json={})
    assert resp.status_code == 400


async def test_bulk_export_returns_artifact_url(client):
    resp = await client.post(
        "/api/v1/inventory/bulk/export",
        json={"resource_ids": ["i-aaa", "i-bbb"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "export"
    assert body["accepted"] == 2
    assert body["artifact_url"].startswith("https://")


async def test_bulk_hibernate_enforces_cap(client):
    ids = [f"i-{i}" for i in range(201)]
    resp = await client.post("/api/v1/inventory/bulk/hibernate", json={"resource_ids": ids})
    assert resp.status_code == 400


async def test_bulk_hibernate_returns_job_id(client):
    resp = await client.post(
        "/api/v1/inventory/bulk/hibernate",
        json={"resource_ids": ["i-a", "i-b", "i-c"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "hibernate"
    assert body["accepted"] == 3
    assert body["job_id"].startswith("hib-")
