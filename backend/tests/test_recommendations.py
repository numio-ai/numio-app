"""Tests for recommendations engine — generation, lifecycle, savings, and API."""

import uuid
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.recommendation_service import (
    RecommendationService,
    _assign_confidence,
    _extract_instance_type,
    _generate_right_sizing_commands,
    _generate_zombie_commands,
    _parse_region_from_description,
)
from numio.db.finding_repository import FindingRepository
from numio.db.recommendation_repository import RecommendationRepository
from numio.schemas.finding import CreateFindingRequest

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def finding_repo(db_session):
    return FindingRepository(db_session, WORKSPACE_ID)


@pytest.fixture
def rec_repo(db_session):
    return RecommendationRepository(db_session, WORKSPACE_ID)


@pytest.fixture
def rec_service(db_session):
    return RecommendationService(db_session, WORKSPACE_ID)


async def _create_zombie_finding(finding_repo, resource_id="vol-dead01", **kwargs):
    defaults = {
        "type": "zombie",
        "severity": "medium",
        "title": f"Unattached EBS volume {resource_id}",
        "description": "10 GB gp3 volume not attached to any instance in us-east-1",
        "resource_id": resource_id,
        "detection_source": "zombie_detection",
        "suggested_action": (
            f"Review and delete if no longer needed.\n"
            f"`aws ec2 delete-volume --volume-id {resource_id} --region us-east-1`"
        ),
        "estimated_cost_impact": Decimal("0.80"),
    }
    defaults.update(kwargs)
    finding, _ = await finding_repo.create_or_update(CreateFindingRequest(**defaults))
    return finding


async def _create_idle_finding(
    finding_repo, resource_id="i-idle01", instance_type="t3.large", **kwargs
):
    defaults = {
        "type": "idle",
        "severity": "info",
        "title": f"Idle EC2 instance {resource_id}",
        "description": (
            f"Instance {resource_id} ({instance_type}) has CPU < 5% and "
            f"network < 1 MB/day over the last 7 days in us-west-2"
        ),
        "resource_id": resource_id,
        "detection_source": "idle_detection",
        "suggested_action": (
            f"Review usage and consider stopping or right-sizing.\n"
            f"`aws ec2 stop-instances --instance-ids {resource_id} --region us-west-2`"
        ),
        "estimated_cost_impact": Decimal("60.74"),
    }
    defaults.update(kwargs)
    finding, _ = await finding_repo.create_or_update(CreateFindingRequest(**defaults))
    return finding


# ---------------------------------------------------------------------------
# Pure function tests
# ---------------------------------------------------------------------------


def test_parse_region_from_description():
    assert _parse_region_from_description("volume in us-east-1") == "us-east-1"
    assert _parse_region_from_description("instance in eu-west-2 is idle") == "eu-west-2"
    assert _parse_region_from_description("no region here") is None
    assert _parse_region_from_description(None) is None


def test_extract_instance_type():
    from numio.models.finding import Finding

    f = Finding(
        workspace_id="test",
        type="idle",
        severity="info",
        title="test",
        resource_id="i-123",
        detection_source="idle_detection",
        description="Instance i-123 (t3.large) has CPU < 5%",
    )
    assert _extract_instance_type(f) == "t3.large"

    f.description = "No instance type here"
    assert _extract_instance_type(f) is None


def test_assign_confidence_zombie_with_cost():
    from numio.models.finding import Finding

    f = Finding(
        workspace_id="test",
        type="zombie",
        severity="medium",
        title="test",
        resource_id="vol-123",
        detection_source="zombie_detection",
        estimated_cost_impact=Decimal("5.00"),
    )
    assert _assign_confidence(f) == "high"


def test_assign_confidence_idle_low_data():
    from numio.models.finding import Finding

    f = Finding(
        workspace_id="test",
        type="idle",
        severity="info",
        title="test",
        resource_id="i-123",
        detection_source="idle_detection",
        estimated_cost_impact=None,
    )
    assert _assign_confidence(f) == "low"


# ---------------------------------------------------------------------------
# CLI command syntax validation
# ---------------------------------------------------------------------------


def _validate_aws_cli_syntax(commands: str) -> bool:
    """Check that at least one valid AWS CLI command exists and all are well-formed."""
    found_command = False
    for line in commands.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Only validate lines that look like AWS CLI commands
        cleaned = line.strip("`")
        if not cleaned.startswith("aws "):
            continue
        parts = cleaned.split()
        if len(parts) < 3:
            return False
        found_command = True
    return found_command


def test_zombie_cli_commands_are_valid():
    from numio.models.finding import Finding

    f = Finding(
        workspace_id="test",
        type="zombie",
        severity="medium",
        title="Unattached EBS volume vol-dead01",
        resource_id="vol-dead01",
        detection_source="zombie_detection",
        description="in us-east-1",
        suggested_action=(
            "Review and delete if no longer needed.\n"
            "`aws ec2 delete-volume --volume-id vol-dead01 --region us-east-1`"
        ),
    )
    cmds = _generate_zombie_commands(f)
    assert _validate_aws_cli_syntax(cmds)


def test_right_sizing_cli_commands_are_valid():
    from numio.models.finding import Finding

    f = Finding(
        workspace_id="test",
        type="idle",
        severity="info",
        title="Idle instance i-123",
        resource_id="i-123",
        detection_source="idle_detection",
        description="Instance i-123 (t3.large) idle in us-east-1",
    )
    cmds = _generate_right_sizing_commands(f, "t3.large", "t3.medium")
    assert _validate_aws_cli_syntax(cmds)
    assert "modify-instance-attribute" in cmds
    assert "t3.medium" in cmds


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_recommendation(rec_repo):
    rec, created = await rec_repo.create(
        finding_id=None,
        category="zombie_cleanup",
        confidence="high",
        title="Clean up vol-dead01",
        description="Unattached EBS volume",
        resource_id="vol-dead01",
        remediation_commands="aws ec2 delete-volume --volume-id vol-dead01",
        estimated_monthly_savings=Decimal("0.80"),
    )
    assert created is True
    assert rec.category == "zombie_cleanup"
    assert rec.status == "open"
    assert rec.confidence == "high"


@pytest.mark.asyncio
async def test_dedup_by_finding_id(rec_repo, finding_repo):
    finding = await _create_zombie_finding(finding_repo)

    rec1, created1 = await rec_repo.create(
        finding_id=finding.id,
        category="zombie_cleanup",
        confidence="high",
        title="Clean up vol-dead01",
        description="test",
        resource_id="vol-dead01",
        remediation_commands="aws ec2 delete-volume --volume-id vol-dead01",
        estimated_monthly_savings=Decimal("0.80"),
    )
    assert created1 is True

    rec2, created2 = await rec_repo.create(
        finding_id=finding.id,
        category="zombie_cleanup",
        confidence="high",
        title="Clean up vol-dead01 again",
        description="test",
        resource_id="vol-dead01",
        remediation_commands="aws ec2 delete-volume --volume-id vol-dead01",
        estimated_monthly_savings=Decimal("0.80"),
    )
    assert created2 is False
    assert rec2.id == rec1.id


@pytest.mark.asyncio
async def test_lifecycle_open_to_accepted(rec_repo):
    rec, _ = await rec_repo.create(
        finding_id=None,
        category="idle_shutdown",
        confidence="medium",
        title="Shut down i-idle01",
        description="Idle",
        resource_id="i-idle01",
        remediation_commands="aws ec2 stop-instances --instance-ids i-idle01",
        estimated_monthly_savings=Decimal("60.00"),
    )
    result = await rec_repo.accept(rec.id)
    assert result is not None
    assert result.status == "accepted"
    assert result.accepted_at is not None


@pytest.mark.asyncio
async def test_lifecycle_accepted_to_implemented(rec_repo):
    rec, _ = await rec_repo.create(
        finding_id=None,
        category="idle_shutdown",
        confidence="medium",
        title="Shut down i-idle02",
        description="Idle",
        resource_id="i-idle02",
        remediation_commands="aws ec2 stop-instances --instance-ids i-idle02",
        estimated_monthly_savings=Decimal("60.00"),
    )
    await rec_repo.accept(rec.id)
    result = await rec_repo.implement(rec.id)
    assert result is not None
    assert result.status == "implemented"
    assert result.implemented_at is not None


@pytest.mark.asyncio
async def test_lifecycle_open_to_dismissed(rec_repo):
    rec, _ = await rec_repo.create(
        finding_id=None,
        category="zombie_cleanup",
        confidence="low",
        title="Clean up vol-test",
        description="test",
        resource_id="vol-test",
        remediation_commands="aws ec2 delete-volume --volume-id vol-test",
        estimated_monthly_savings=Decimal("1.00"),
    )
    result = await rec_repo.dismiss(rec.id)
    assert result is not None
    assert result.status == "dismissed"
    assert result.dismissed_at is not None


@pytest.mark.asyncio
async def test_cannot_dismiss_implemented(rec_repo):
    rec, _ = await rec_repo.create(
        finding_id=None,
        category="idle_shutdown",
        confidence="medium",
        title="Shut down i-impl",
        description="Idle",
        resource_id="i-impl",
        remediation_commands="aws ec2 stop-instances --instance-ids i-impl",
        estimated_monthly_savings=Decimal("30.00"),
    )
    await rec_repo.implement(rec.id)
    result = await rec_repo.dismiss(rec.id)
    assert result is None  # Cannot dismiss implemented


@pytest.mark.asyncio
async def test_list_with_filters(rec_repo):
    await rec_repo.create(
        finding_id=None,
        category="zombie_cleanup",
        confidence="high",
        title="Z1",
        description="t",
        resource_id="r-z1",
        remediation_commands="aws ec2 delete-volume --volume-id r-z1",
        estimated_monthly_savings=Decimal("10.00"),
    )
    await rec_repo.create(
        finding_id=None,
        category="idle_shutdown",
        confidence="medium",
        title="I1",
        description="t",
        resource_id="r-i1",
        remediation_commands="aws ec2 stop-instances --instance-ids r-i1",
        estimated_monthly_savings=Decimal("50.00"),
    )
    await rec_repo.create(
        finding_id=None,
        category="right_sizing",
        confidence="medium",
        title="R1",
        description="t",
        resource_id="r-r1",
        remediation_commands="aws ec2 modify-instance-attribute --instance-id r-r1",
        estimated_monthly_savings=Decimal("30.00"),
    )

    # Filter by category
    recs, count = await rec_repo.list_recommendations(category="zombie_cleanup")
    assert count == 1
    assert recs[0].category == "zombie_cleanup"

    # Sort by savings
    recs, count = await rec_repo.list_recommendations(sort_by_savings=True)
    assert count == 3
    assert recs[0].estimated_monthly_savings >= recs[1].estimated_monthly_savings

    # Filter by status
    recs, count = await rec_repo.list_recommendations(status="open")
    assert count == 3


@pytest.mark.asyncio
async def test_savings_summary(rec_repo):
    rec, _ = await rec_repo.create(
        finding_id=None,
        category="zombie_cleanup",
        confidence="high",
        title="Z-sav",
        description="t",
        resource_id="r-zs",
        remediation_commands="aws ec2 delete-volume --volume-id r-zs",
        estimated_monthly_savings=Decimal("10.00"),
    )
    await rec_repo.implement(rec.id)
    await rec_repo.update_savings(rec.id, Decimal("9.50"), "actual")

    summary = await rec_repo.get_savings_summary()
    assert summary["total_implemented"] == 1
    assert summary["total_actual_savings"] == Decimal("9.50")
    assert len(summary["by_category"]) == 1
    assert summary["by_category"][0]["category"] == "zombie_cleanup"


# ---------------------------------------------------------------------------
# Service tests — recommendation generation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_zombie_recommendation(finding_repo, rec_service, rec_repo):
    await _create_zombie_finding(finding_repo, resource_id="vol-gen01")

    count = await rec_service.generate_recommendations()
    assert count == 1

    recs, total = await rec_repo.list_recommendations(category="zombie_cleanup")
    assert total == 1
    assert recs[0].resource_id == "vol-gen01"
    assert recs[0].remediation_commands is not None
    assert "delete-volume" in recs[0].remediation_commands


@pytest.mark.asyncio
async def test_generate_right_sizing_recommendation(finding_repo, rec_service, rec_repo):
    """Idle finding with a known instance type that has a smaller alternative."""
    await _create_idle_finding(finding_repo, resource_id="i-rs01", instance_type="t3.large")

    count = await rec_service.generate_recommendations()
    assert count == 1

    recs, total = await rec_repo.list_recommendations(category="right_sizing")
    assert total == 1
    assert "t3.medium" in recs[0].title  # Downsized from t3.large
    assert "modify-instance-attribute" in recs[0].remediation_commands


@pytest.mark.asyncio
async def test_generate_idle_shutdown_recommendation(finding_repo, rec_service, rec_repo):
    """Idle finding with unknown instance type falls back to idle_shutdown."""
    await _create_idle_finding(
        finding_repo,
        resource_id="i-shutdown01",
        instance_type="custom.large",  # Not in DOWNSIZE_MAP
        detection_source="idle_detection_custom",
    )

    count = await rec_service.generate_recommendations()
    assert count == 1

    recs, total = await rec_repo.list_recommendations(category="idle_shutdown")
    assert total == 1
    assert recs[0].resource_id == "i-shutdown01"


@pytest.mark.asyncio
async def test_no_duplicate_recommendations(finding_repo, rec_service):
    await _create_zombie_finding(finding_repo, resource_id="vol-nodup")

    count1 = await rec_service.generate_recommendations()
    assert count1 == 1

    count2 = await rec_service.generate_recommendations()
    assert count2 == 0  # No new recommendations


@pytest.mark.asyncio
async def test_resolved_findings_not_recommended(finding_repo, rec_service):
    finding = await _create_zombie_finding(
        finding_repo, resource_id="vol-resolved", detection_source="zombie_resolved"
    )
    await finding_repo.resolve(finding.id)

    count = await rec_service.generate_recommendations()
    assert count == 0


@pytest.mark.asyncio
async def test_three_recommendation_types_from_mixed_findings(finding_repo, rec_service, rec_repo):
    """AC1: At least 3 recommendation types generated from test data."""
    await _create_zombie_finding(finding_repo, resource_id="vol-mix01", detection_source="zd1")
    await _create_idle_finding(
        finding_repo, resource_id="i-mix01", instance_type="t3.large", detection_source="id1"
    )
    await _create_idle_finding(
        finding_repo, resource_id="i-mix02", instance_type="custom.xlarge", detection_source="id2"
    )

    count = await rec_service.generate_recommendations()
    assert count == 3

    z_recs, _ = await rec_repo.list_recommendations(category="zombie_cleanup")
    r_recs, _ = await rec_repo.list_recommendations(category="right_sizing")
    i_recs, _ = await rec_repo.list_recommendations(category="idle_shutdown")
    assert len(z_recs) >= 1
    assert len(r_recs) >= 1
    assert len(i_recs) >= 1


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client(db_session):
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


async def _create_finding_via_api(client, **overrides):
    defaults = {
        "type": "zombie",
        "severity": "medium",
        "title": "Test zombie",
        "resource_id": f"vol-api-{uuid.uuid4().hex[:6]}",
        "detection_source": "zombie_detection",
        "estimated_cost_impact": "5.00",
        "suggested_action": "aws ec2 delete-volume --volume-id vol-test --region us-east-1",
    }
    defaults.update(overrides)
    resp = await client.post("/api/v1/findings", json=defaults)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_api_generate_and_list(api_client):
    async with api_client as c:
        await _create_finding_via_api(c)

        # Generate
        resp = await c.post("/api/v1/recommendations/generate")
        assert resp.status_code == 200
        assert resp.json()["generated"] >= 1

        # List
        resp = await c.get("/api/v1/recommendations")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] >= 1
        assert len(body["recommendations"]) >= 1


@pytest.mark.asyncio
async def test_api_get_detail(api_client):
    async with api_client as c:
        await _create_finding_via_api(c)
        await c.post("/api/v1/recommendations/generate")

        list_resp = await c.get("/api/v1/recommendations")
        rec_id = list_resp.json()["recommendations"][0]["id"]

        resp = await c.get(f"/api/v1/recommendations/{rec_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == rec_id


@pytest.mark.asyncio
async def test_api_lifecycle_accept_implement(api_client):
    async with api_client as c:
        await _create_finding_via_api(c)
        await c.post("/api/v1/recommendations/generate")

        list_resp = await c.get("/api/v1/recommendations")
        rec_id = list_resp.json()["recommendations"][0]["id"]

        # Accept
        resp = await c.post(f"/api/v1/recommendations/{rec_id}/accept", json={})
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        # Implement
        resp = await c.post(f"/api/v1/recommendations/{rec_id}/implement", json={})
        assert resp.status_code == 200
        assert resp.json()["status"] == "implemented"
        assert resp.json()["implemented_at"] is not None


@pytest.mark.asyncio
async def test_api_dismiss(api_client):
    async with api_client as c:
        await _create_finding_via_api(c)
        await c.post("/api/v1/recommendations/generate")

        list_resp = await c.get("/api/v1/recommendations")
        rec_id = list_resp.json()["recommendations"][0]["id"]

        resp = await c.post(f"/api/v1/recommendations/{rec_id}/dismiss", json={})
        assert resp.status_code == 200
        assert resp.json()["status"] == "dismissed"


@pytest.mark.asyncio
async def test_api_filter_by_category(api_client):
    async with api_client as c:
        await _create_finding_via_api(c, resource_id="vol-fc1", detection_source="z1")
        await _create_finding_via_api(
            c,
            type="idle",
            resource_id="i-fc1",
            detection_source="idle1",
            title="Idle test",
            severity="info",
            suggested_action="aws ec2 stop-instances --instance-ids i-fc1 --region us-east-1",
            description="Instance i-fc1 (custom.big) idle in us-east-1",
        )
        await c.post("/api/v1/recommendations/generate")

        resp = await c.get("/api/v1/recommendations", params={"category": "zombie_cleanup"})
        assert resp.status_code == 200
        body = resp.json()
        assert all(r["category"] == "zombie_cleanup" for r in body["recommendations"])


@pytest.mark.asyncio
async def test_api_sort_by_savings(api_client):
    async with api_client as c:
        await _create_finding_via_api(
            c, resource_id="vol-s1", detection_source="z1", estimated_cost_impact="5.00"
        )
        await _create_finding_via_api(
            c, resource_id="vol-s2", detection_source="z2", estimated_cost_impact="50.00"
        )
        await c.post("/api/v1/recommendations/generate")

        resp = await c.get("/api/v1/recommendations", params={"sort_by_savings": True})
        assert resp.status_code == 200
        recs = resp.json()["recommendations"]
        if len(recs) >= 2:
            savings = [
                Decimal(str(r["estimated_monthly_savings"]))
                for r in recs
                if r["estimated_monthly_savings"] is not None
            ]
            # Should be descending
            assert savings == sorted(savings, reverse=True)


@pytest.mark.asyncio
async def test_api_savings_summary(api_client):
    async with api_client as c:
        await _create_finding_via_api(c, resource_id="vol-ss1", detection_source="z-ss")
        await c.post("/api/v1/recommendations/generate")

        list_resp = await c.get("/api/v1/recommendations")
        rec_id = list_resp.json()["recommendations"][0]["id"]
        await c.post(f"/api/v1/recommendations/{rec_id}/implement", json={})

        resp = await c.get("/api/v1/recommendations/savings/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_implemented"] >= 1


@pytest.mark.asyncio
async def test_api_savings_timeline(api_client):
    async with api_client as c:
        await _create_finding_via_api(c, resource_id="vol-st1", detection_source="z-st")
        await c.post("/api/v1/recommendations/generate")

        list_resp = await c.get("/api/v1/recommendations")
        rec_id = list_resp.json()["recommendations"][0]["id"]
        await c.post(f"/api/v1/recommendations/{rec_id}/implement", json={})

        resp = await c.get("/api/v1/recommendations/savings/timeline")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["entries"]) >= 1
        assert "date" in body["entries"][0]
        assert "cumulative_savings" in body["entries"][0]


@pytest.mark.asyncio
async def test_api_404_for_missing_recommendation(api_client):
    async with api_client as c:
        fake_id = str(uuid.uuid4())
        resp = await c.get(f"/api/v1/recommendations/{fake_id}")
        assert resp.status_code == 404
