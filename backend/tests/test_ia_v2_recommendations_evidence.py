"""Smoke tests for the IA v2 recommendations evidence scaffold."""

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


async def test_get_evidence_returns_all_five_sections(client):
    resp = await client.get("/api/v1/recommendations-v2/r-201/evidence")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["recommendation_id"] == "r-201"
    assert body["signals"]
    assert body["sample"]
    assert body["what_happens"]
    assert body["exclusions"]
    assert body["risk"]
    assert body["risk"]["level"] in ("low", "med", "high")


async def test_get_evidence_missing_returns_404(client):
    resp = await client.get("/api/v1/recommendations-v2/missing/evidence")
    assert resp.status_code == 404


async def test_rescan_returns_job_id(client):
    resp = await client.post("/api/v1/recommendations-v2/rescan", json={"idempotency_key": "scan-a"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"].startswith("rescan-")
    assert body["deduped"] is False


async def test_rescan_dedupes_within_window(client):
    first = await client.post("/api/v1/recommendations-v2/rescan", json={"idempotency_key": "scan-b"})
    second = await client.post("/api/v1/recommendations-v2/rescan", json={"idempotency_key": "scan-b"})
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["deduped"] is True
    assert second.json()["started_at"] == first.json()["started_at"]


async def test_evidence_includes_manual_remediation_block(client):
    resp = await client.get("/api/v1/recommendations-v2/r-201/evidence")
    body = resp.json()
    assert body["manual_remediation"] is not None
    assert body["manual_remediation"]["cmd"].startswith("$ numio")
