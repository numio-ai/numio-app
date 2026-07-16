"""Tests for findings management — model, repository, deduplication, and API."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from numio.db.finding_repository import FindingRepository
from numio.schemas.finding import CreateFindingRequest

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo(db_session):
    return FindingRepository(db_session, WORKSPACE_ID)


def _make_finding_request(**overrides) -> CreateFindingRequest:
    defaults = {
        "type": "anomaly",
        "severity": "high",
        "title": "Cost spike on EC2",
        "resource_id": "i-abc123",
        "detection_source": "anomaly_detector",
    }
    defaults.update(overrides)
    return CreateFindingRequest(**defaults)


# ---------------------------------------------------------------------------
# Repository tests — create, dedup, lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_finding(repo):
    finding, created = await repo.create_or_update(_make_finding_request())
    assert created is True
    assert finding.type == "anomaly"
    assert finding.severity == "high"
    assert finding.status == "open"
    assert finding.resource_id == "i-abc123"


@pytest.mark.asyncio
async def test_deduplication_updates_last_seen(repo):
    finding1, created1 = await repo.create_or_update(_make_finding_request())
    assert created1 is True

    finding2, created2 = await repo.create_or_update(_make_finding_request())
    assert created2 is False
    assert finding2.id == finding1.id
    assert finding2.last_seen_at >= finding1.last_seen_at


@pytest.mark.asyncio
async def test_suppressed_finding_stays_suppressed_on_dedup(repo):
    finding, _ = await repo.create_or_update(_make_finding_request())
    await repo.suppress(finding.id, reason="known issue")

    # Re-detect the same finding
    deduped, created = await repo.create_or_update(_make_finding_request())
    assert created is False
    assert deduped.status == "suppressed"
    assert deduped.suppression_reason == "known issue"


@pytest.mark.asyncio
async def test_acknowledge_finding(repo):
    finding, _ = await repo.create_or_update(_make_finding_request())
    result = await repo.acknowledge(finding.id, changed_by="alice")
    assert result is not None
    assert result.status == "acknowledged"
    assert result.acknowledged_at is not None


@pytest.mark.asyncio
async def test_resolve_finding(repo):
    finding, _ = await repo.create_or_update(_make_finding_request())
    result = await repo.resolve(finding.id, changed_by="bob", reason="fixed")
    assert result is not None
    assert result.status == "resolved"
    assert result.resolved_at is not None


@pytest.mark.asyncio
async def test_suppress_finding(repo):
    finding, _ = await repo.create_or_update(_make_finding_request())
    result = await repo.suppress(finding.id, reason="false positive", changed_by="carol")
    assert result is not None
    assert result.status == "suppressed"
    assert result.suppression_reason == "false positive"


@pytest.mark.asyncio
async def test_state_transition_recorded(repo):
    finding, _ = await repo.create_or_update(_make_finding_request())
    await repo.acknowledge(finding.id, changed_by="alice")

    detail = await repo.get_by_id(finding.id)
    assert detail is not None
    assert len(detail.transitions) == 1
    assert detail.transitions[0].from_status == "open"
    assert detail.transitions[0].to_status == "acknowledged"
    assert detail.transitions[0].changed_by == "alice"


@pytest.mark.asyncio
async def test_list_findings_with_filters(repo):
    await repo.create_or_update(
        _make_finding_request(
            type="anomaly", severity="high", resource_id="r-1", detection_source="det-a"
        )
    )
    await repo.create_or_update(
        _make_finding_request(
            type="zombie", severity="medium", resource_id="r-2", detection_source="det-b"
        )
    )
    await repo.create_or_update(
        _make_finding_request(
            type="tag_violation", severity="low", resource_id="r-3", detection_source="det-c"
        )
    )

    # Filter by type
    results, count = await repo.list_findings(finding_type="zombie")
    assert count == 1
    assert results[0].type == "zombie"

    # Filter by severity
    results, count = await repo.list_findings(severity="high")
    assert count == 1
    assert results[0].severity == "high"

    # No filter returns all
    results, count = await repo.list_findings()
    assert count == 3


@pytest.mark.asyncio
async def test_nullable_cost_impact(repo):
    finding, _ = await repo.create_or_update(
        _make_finding_request(type="tag_violation", resource_id="r-tag", detection_source="audit")
    )
    assert finding.estimated_cost_impact is None

    from decimal import Decimal

    finding2, _ = await repo.create_or_update(
        _make_finding_request(
            type="zombie",
            resource_id="r-zombie",
            detection_source="zombie_hunter",
            estimated_cost_impact=Decimal("42.50"),
        )
    )
    assert finding2.estimated_cost_impact == Decimal("42.50")


@pytest.mark.asyncio
async def test_bulk_acknowledge(repo):
    req1 = _make_finding_request(resource_id="r-b1", detection_source="d1")
    req2 = _make_finding_request(resource_id="r-b2", detection_source="d2")
    f1, _ = await repo.create_or_update(req1)
    f2, _ = await repo.create_or_update(req2)

    updated_ids = await repo.bulk_acknowledge([f1.id, f2.id], changed_by="bulk-user")
    assert len(updated_ids) == 2

    for fid in updated_ids:
        f = await repo.get_by_id(fid)
        assert f.status == "acknowledged"


@pytest.mark.asyncio
async def test_bulk_resolve(repo):
    req1 = _make_finding_request(resource_id="r-br1", detection_source="d1")
    req2 = _make_finding_request(resource_id="r-br2", detection_source="d2")
    f1, _ = await repo.create_or_update(req1)
    f2, _ = await repo.create_or_update(req2)

    updated_ids = await repo.bulk_resolve([f1.id, f2.id])
    assert len(updated_ids) == 2

    for fid in updated_ids:
        f = await repo.get_by_id(fid)
        assert f.status == "resolved"


@pytest.mark.asyncio
async def test_different_sources_coexist(repo):
    """Findings from different sources for the same resource are not deduped."""
    f1, c1 = await repo.create_or_update(
        _make_finding_request(
            type="anomaly", resource_id="r-shared", detection_source="anomaly_det"
        )
    )
    f2, c2 = await repo.create_or_update(
        _make_finding_request(
            type="zombie", resource_id="r-shared", detection_source="zombie_hunter"
        )
    )
    assert c1 is True
    assert c2 is True
    assert f1.id != f2.id


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client(db_session):
    """Create an httpx AsyncClient wired to the FastAPI app with a test session."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session

    transport = ASGITransport(app=app)

    class _Client:
        async def __aenter__(self):
            self._client = AsyncClient(transport=transport, base_url="http://test")
            return await self._client.__aenter__()

        async def __aexit__(self, *args):
            await self._client.__aexit__(*args)
            app.dependency_overrides.clear()

    return _Client()


@pytest.mark.asyncio
async def test_api_create_and_list(api_client):
    async with api_client as c:
        # Create
        resp = await c.post(
            "/api/v1/findings",
            json={
                "type": "anomaly",
                "severity": "high",
                "title": "API spike",
                "resource_id": "i-api-001",
                "detection_source": "anomaly_detector",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "anomaly"
        finding_id = data["id"]

        # List
        resp = await c.get("/api/v1/findings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] >= 1

        # Get detail
        resp = await c.get(f"/api/v1/findings/{finding_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == finding_id


@pytest.mark.asyncio
async def test_api_acknowledge_and_resolve(api_client):
    async with api_client as c:
        # Create
        resp = await c.post(
            "/api/v1/findings",
            json={
                "type": "zombie",
                "severity": "medium",
                "title": "Idle EBS volume",
                "resource_id": "vol-api-001",
                "detection_source": "zombie_hunter",
            },
        )
        finding_id = resp.json()["id"]

        # Acknowledge
        resp = await c.post(
            f"/api/v1/findings/{finding_id}/acknowledge",
            json={
                "changed_by": "alice",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "acknowledged"

        # Resolve
        resp = await c.post(
            f"/api/v1/findings/{finding_id}/resolve",
            json={
                "changed_by": "bob",
                "reason": "volume deleted",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_api_suppress(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/findings",
            json={
                "type": "policy_violation",
                "severity": "low",
                "title": "Missing owner tag",
                "resource_id": "i-api-002",
                "detection_source": "policy_engine",
            },
        )
        finding_id = resp.json()["id"]

        resp = await c.post(
            f"/api/v1/findings/{finding_id}/suppress",
            json={
                "reason": "known exception",
                "changed_by": "carol",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "suppressed"
        assert resp.json()["suppression_reason"] == "known exception"


@pytest.mark.asyncio
async def test_api_bulk_acknowledge(api_client):
    async with api_client as c:
        ids = []
        for i in range(3):
            resp = await c.post(
                "/api/v1/findings",
                json={
                    "type": "idle",
                    "severity": "info",
                    "title": f"Idle resource {i}",
                    "resource_id": f"i-bulk-{i}",
                    "detection_source": "idle_detector",
                },
            )
            ids.append(resp.json()["id"])

        resp = await c.post(
            "/api/v1/findings/bulk/acknowledge",
            json={
                "finding_ids": ids,
                "changed_by": "bulk-op",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["updated"] == 3


@pytest.mark.asyncio
async def test_api_filter_by_type(api_client):
    async with api_client as c:
        await c.post(
            "/api/v1/findings",
            json={
                "type": "anomaly",
                "severity": "high",
                "title": "A1",
                "resource_id": "r-ft-1",
                "detection_source": "d1",
            },
        )
        await c.post(
            "/api/v1/findings",
            json={
                "type": "zombie",
                "severity": "medium",
                "title": "Z1",
                "resource_id": "r-ft-2",
                "detection_source": "d2",
            },
        )

        resp = await c.get("/api/v1/findings", params={"type": "zombie"})
        assert resp.status_code == 200
        body = resp.json()
        assert all(f["type"] == "zombie" for f in body["findings"])


@pytest.mark.asyncio
async def test_api_404_for_missing_finding(api_client):
    async with api_client as c:
        fake_id = str(uuid.uuid4())
        resp = await c.get(f"/api/v1/findings/{fake_id}")
        assert resp.status_code == 404
