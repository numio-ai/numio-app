"""Integration test: health endpoint against a running database."""

import httpx
from sqlalchemy import text

from numio.main import app


async def test_health_endpoint_returns_ok(db_session):
    """GET /health returns status ok when the database is reachable."""
    # Verify DB connectivity within the test session first.
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "numio"
