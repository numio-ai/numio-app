"""Smoke tests for IA v2 budgets scaffold."""

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


async def test_list_budgets_v2_returns_summary(client):
    resp = await client.get("/api/v1/budgets-v2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] >= 6
    assert body["over_count"] >= 1  # ML Platform is over
    assert body["at_risk_count"] >= 1  # Payments is at risk
    for b in body["budgets"]:
        assert b["status"] in ("on-track", "at-risk", "over")
        assert b["pct_spent"] >= 0
        assert b["expected_pct_at_today"] >= 0
        assert "drift_pp" in b


async def test_status_derivation(client):
    body = (await client.get("/api/v1/budgets-v2")).json()
    by_id = {b["id"]: b for b in body["budgets"]}
    assert by_id["team-ml"]["status"] == "over"  # 24840/24000 > 100%
    assert by_id["team-payments"]["status"] == "at-risk"  # 41280/48000 = 86%
    assert by_id["team-data"]["status"] == "on-track"  # 11402/18000 = 63%


async def test_period_param_scales_budgets(client):
    monthly = (await client.get("/api/v1/budgets-v2")).json()
    yearly = (await client.get("/api/v1/budgets-v2", params={"period": "year"})).json()
    assert float(yearly["total_budget"]) > float(monthly["total_budget"])


async def test_create_budget_returns_201(client):
    resp = await client.post(
        "/api/v1/budgets-v2",
        json={"team": "Platform", "budget": "9000"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["team"] == "Platform"
    assert body["spent"] == "0"


async def test_pacing_endpoint(client):
    resp = await client.get("/api/v1/budgets-v2/team-eng/pacing")
    assert resp.status_code == 200
    body = resp.json()
    assert body["expected_pct_at_today"] > 0
    assert len(body["by_day"]) == 31


async def test_create_budget_rejects_zero_amount(client):
    resp = await client.post("/api/v1/budgets-v2", json={"team": "Platform", "budget": "0"})
    assert resp.status_code == 422
