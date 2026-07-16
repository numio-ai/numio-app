"""Tests for zombie hunter and idle resource detection."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.zombie_detection_service import (
    THRESHOLD_DEFAULTS,
    ZombieDetectionService,
    estimate_ebs_monthly_cost,
    estimate_ec2_monthly_cost,
    parse_stop_time,
)
from numio.db.finding_repository import FindingRepository
from numio.models.cloud_resource import CloudResource
from numio.models.zombie_threshold import ZombieThreshold

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _insert_cloud_resource(
    db_session,
    account_id: str,
    service: str,
    resource_type: str,
    resource_id: str,
    region: str = "us-east-1",
    state: str | None = None,
    metadata: dict | None = None,
    first_seen_at: datetime | None = None,
) -> CloudResource:
    """Insert a CloudResource record for testing."""
    now = datetime.now(timezone.utc)
    resource = CloudResource(
        id=uuid.uuid4(),
        workspace_id=WORKSPACE_ID,
        account_id=account_id,
        region=region,
        service=service,
        resource_type=resource_type,
        resource_id=resource_id,
        state=state,
        resource_metadata=metadata,
        first_seen_at=first_seen_at or now,
        last_seen_at=now,
    )
    db_session.add(resource)
    return resource


# ---------------------------------------------------------------------------
# Pure function tests — parse_stop_time
# ---------------------------------------------------------------------------


class TestParseStopTime:
    def test_user_initiated(self):
        reason = "User initiated (2026-03-20 10:30:00 GMT)"
        result = parse_stop_time(reason)
        assert result is not None
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 20
        assert result.tzinfo == timezone.utc

    def test_no_timestamp(self):
        reason = "Client.UserInitiatedShutdown: User initiated shutdown"
        assert parse_stop_time(reason) is None

    def test_none_input(self):
        assert parse_stop_time(None) is None

    def test_empty_string(self):
        assert parse_stop_time("") is None


# ---------------------------------------------------------------------------
# Pure function tests — cost estimation
# ---------------------------------------------------------------------------


class TestCostEstimation:
    def test_ec2_known_type(self):
        cost = estimate_ec2_monthly_cost("t3.medium")
        assert cost is not None
        assert cost > Decimal("0")

    def test_ec2_unknown_type(self):
        assert estimate_ec2_monthly_cost("x99.superlarge") is None

    def test_ec2_none_type(self):
        assert estimate_ec2_monthly_cost(None) is None

    def test_ebs_gp3(self):
        cost = estimate_ebs_monthly_cost(100, "gp3")
        assert cost == Decimal("8.00")

    def test_ebs_io1(self):
        cost = estimate_ebs_monthly_cost(50, "io1")
        assert cost == Decimal("6.25")

    def test_ebs_none_size(self):
        assert estimate_ebs_monthly_cost(None, "gp3") is None

    def test_ebs_unknown_type_uses_gp3(self):
        cost = estimate_ebs_monthly_cost(100, "unknown_type")
        expected = estimate_ebs_monthly_cost(100, "gp3")
        assert cost == expected


# ---------------------------------------------------------------------------
# Inventory-based detection tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_detect_unattached_ebs(db_session):
    """Unattached EBS volumes create zombie findings."""
    account_id = "111111111111"
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ebs",
        resource_type="volume",
        resource_id="vol-unattached001",
        state="available",
        metadata={"size_gb": 100, "volume_type": "gp3"},
    )
    # Attached volume should NOT be detected
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ebs",
        resource_type="volume",
        resource_id="vol-attached001",
        state="in-use",
        metadata={"size_gb": 50, "volume_type": "gp2", "attached_to": "i-123"},
    )
    await db_session.flush()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    count = await service._detect_unattached_ebs(account_id, dict(THRESHOLD_DEFAULTS))

    assert count == 1

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, total = await repo.list_findings(
        finding_type="zombie", resource_id="vol-unattached001"
    )
    assert total == 1
    finding = findings[0]
    assert finding.type == "zombie"
    assert finding.severity == "medium"
    assert finding.estimated_cost_impact == Decimal("8.00")
    assert "delete-volume" in finding.suggested_action


@pytest.mark.asyncio
async def test_detect_unused_eips(db_session):
    """Unused Elastic IPs create zombie findings."""
    account_id = "111111111111"
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="eip",
        resource_type="elastic-ip",
        resource_id="eipalloc-unused001",
        state="unassociated",
        metadata={"public_ip": "1.2.3.4"},
    )
    # Associated EIP should NOT be detected
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="eip",
        resource_type="elastic-ip",
        resource_id="eipalloc-used001",
        state="associated",
        metadata={"public_ip": "5.6.7.8", "instance_id": "i-123"},
    )
    await db_session.flush()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    count = await service._detect_unused_eips(account_id, dict(THRESHOLD_DEFAULTS))

    assert count == 1

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="zombie", resource_id="eipalloc-unused001")
    assert len(findings) == 1
    assert findings[0].estimated_cost_impact == Decimal("3.60")
    assert "release-address" in findings[0].suggested_action


@pytest.mark.asyncio
async def test_detect_stopped_instances_no_api(db_session):
    """Stopped instances older than threshold create findings (fallback to first_seen_at)."""
    account_id = "111111111111"
    old_date = datetime.now(timezone.utc) - timedelta(days=30)

    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ec2",
        resource_type="instance",
        resource_id="i-stopped001",
        state="stopped",
        metadata={"instance_type": "t3.medium"},
        first_seen_at=old_date,
    )
    # Running instance should NOT be detected
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ec2",
        resource_type="instance",
        resource_id="i-running001",
        state="running",
        metadata={"instance_type": "t3.large"},
    )
    await db_session.flush()

    # Mock boto session that returns empty stop times
    class _MockEc2Client:
        def describe_instances(self, InstanceIds=None):
            return {"Reservations": []}

    class _MockBotoSession:
        def client(self, service_name, region_name=None):
            return _MockEc2Client()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    thresholds = dict(THRESHOLD_DEFAULTS)
    count = await service._detect_stopped_instances(account_id, _MockBotoSession(), thresholds)

    assert count == 1

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="zombie", resource_id="i-stopped001")
    assert len(findings) == 1
    assert findings[0].severity == "high"
    assert "terminate-instances" in findings[0].suggested_action


@pytest.mark.asyncio
async def test_recently_stopped_instance_not_flagged(db_session):
    """Instance stopped less than threshold days ago is not flagged."""
    account_id = "222222222222"
    recent_date = datetime.now(timezone.utc) - timedelta(days=2)

    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ec2",
        resource_type="instance",
        resource_id="i-recent001",
        state="stopped",
        metadata={"instance_type": "t3.small"},
        first_seen_at=recent_date,
    )
    await db_session.flush()

    class _MockEc2Client:
        def describe_instances(self, InstanceIds=None):
            return {"Reservations": []}

    class _MockBotoSession:
        def client(self, service_name, region_name=None):
            return _MockEc2Client()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    count = await service._detect_stopped_instances(
        account_id, _MockBotoSession(), dict(THRESHOLD_DEFAULTS)
    )
    assert count == 0


@pytest.mark.asyncio
async def test_threshold_override_changes_detection(db_session):
    """Custom threshold overrides affect detection behavior."""
    account_id = "333333333333"
    # Instance stopped 5 days ago — default threshold is 7 days, should NOT be flagged
    five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)

    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ec2",
        resource_type="instance",
        resource_id="i-threshold001",
        state="stopped",
        metadata={"instance_type": "t3.medium"},
        first_seen_at=five_days_ago,
    )
    # Override threshold to 3 days — NOW it should be flagged
    override = ZombieThreshold(
        workspace_id=WORKSPACE_ID,
        threshold_key="stopped_instance_days",
        threshold_value=Decimal("3"),
    )
    db_session.add(override)
    await db_session.flush()

    class _MockEc2Client:
        def describe_instances(self, InstanceIds=None):
            return {"Reservations": []}

    class _MockBotoSession:
        def client(self, service_name, region_name=None):
            return _MockEc2Client()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    thresholds = await service._load_thresholds()
    assert thresholds["stopped_instance_days"] == Decimal("3")

    count = await service._detect_stopped_instances(account_id, _MockBotoSession(), thresholds)
    assert count == 1


@pytest.mark.asyncio
async def test_deduplication(db_session):
    """Running detection twice does not create duplicate findings."""
    account_id = "444444444444"
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ebs",
        resource_type="volume",
        resource_id="vol-dedup001",
        state="available",
        metadata={"size_gb": 50, "volume_type": "gp2"},
    )
    await db_session.flush()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    thresholds = dict(THRESHOLD_DEFAULTS)

    count1 = await service._detect_unattached_ebs(account_id, thresholds)
    count2 = await service._detect_unattached_ebs(account_id, thresholds)

    assert count1 == 1
    assert count2 == 0  # Deduped by FindingRepository

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, total = await repo.list_findings(finding_type="zombie", resource_id="vol-dedup001")
    assert total == 1


@pytest.mark.asyncio
async def test_finding_includes_cli_command(db_session):
    """Each finding includes a suggested AWS CLI command."""
    account_id = "555555555555"
    _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="eip",
        resource_type="elastic-ip",
        resource_id="eipalloc-cli001",
        region="eu-west-1",
        state="unassociated",
        metadata={"public_ip": "10.0.0.1"},
    )
    await db_session.flush()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    await service._detect_unused_eips(account_id, dict(THRESHOLD_DEFAULTS))

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="zombie", resource_id="eipalloc-cli001")
    assert len(findings) == 1
    action = findings[0].suggested_action
    assert "aws ec2 release-address" in action
    assert "--allocation-id eipalloc-cli001" in action
    assert "--region eu-west-1" in action


@pytest.mark.asyncio
async def test_terminated_resources_not_detected(db_session):
    """Resources marked as terminated in inventory are not detected."""
    account_id = "666666666666"
    resource = _insert_cloud_resource(
        db_session,
        account_id=account_id,
        service="ebs",
        resource_type="volume",
        resource_id="vol-terminated001",
        state="available",
        metadata={"size_gb": 100, "volume_type": "gp3"},
    )
    resource.terminated_at = datetime.now(timezone.utc)
    await db_session.flush()

    service = ZombieDetectionService(db_session, WORKSPACE_ID)
    count = await service._detect_unattached_ebs(account_id, dict(THRESHOLD_DEFAULTS))
    assert count == 0


# ---------------------------------------------------------------------------
# API tests — threshold endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def _patch_session(db_session):
    """Override FastAPI dependency to use the test db_session."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override():
        yield db_session

    app.dependency_overrides[get_session] = _override
    yield
    app.dependency_overrides.pop(get_session, None)


@pytest.mark.asyncio
async def test_api_list_thresholds(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/zombie-thresholds")
        assert resp.status_code == 200
        data = resp.json()
        assert "thresholds" in data
        keys = {t["key"] for t in data["thresholds"]}
        assert "stopped_instance_days" in keys
        assert "snapshot_age_days" in keys
        assert "idle_cpu_percent" in keys
        assert "idle_network_mb_day" in keys
        assert "idle_window_days" in keys
        # All should be defaults initially
        for t in data["thresholds"]:
            assert t["is_override"] is False


@pytest.mark.asyncio
async def test_api_set_and_get_threshold(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/v1/zombie-thresholds/stopped_instance_days",
            json={"value": "14"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["threshold_key"] == "stopped_instance_days"
        assert Decimal(data["threshold_value"]) == Decimal("14")

        # Verify it shows as override in list
        resp = await client.get("/api/v1/zombie-thresholds")
        thresholds = resp.json()["thresholds"]
        stopped = next(t for t in thresholds if t["key"] == "stopped_instance_days")
        assert stopped["is_override"] is True
        assert Decimal(stopped["value"]) == Decimal("14")


@pytest.mark.asyncio
async def test_api_invalid_threshold_key(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/v1/zombie-thresholds/nonexistent_key",
            json={"value": "10"},
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_api_delete_threshold(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create override
        await client.put(
            "/api/v1/zombie-thresholds/snapshot_age_days",
            json={"value": "30"},
        )

        # Delete it
        resp = await client.delete("/api/v1/zombie-thresholds/snapshot_age_days")
        assert resp.status_code == 204

        # Verify reverted to default
        resp = await client.get("/api/v1/zombie-thresholds")
        thresholds = resp.json()["thresholds"]
        snap = next(t for t in thresholds if t["key"] == "snapshot_age_days")
        assert snap["is_override"] is False
        assert Decimal(snap["value"]) == Decimal("90")

        # Delete again should 404
        resp = await client.delete("/api/v1/zombie-thresholds/snapshot_age_days")
        assert resp.status_code == 404
