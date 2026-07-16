"""Tests for anomaly detection — spike, drift, thresholds, and findings creation."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.anomaly_detection_service import (
    AnomalyDetectionService,
    detect_drift,
    detect_spike,
)
from numio.db.finding_repository import FindingRepository
from numio.models.anomaly_threshold import AnomalyThreshold
from numio.models.cost_record import CostRecord

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _insert_daily_costs(
    db_session,
    service: str,
    daily_amounts: list[Decimal],
    start_date: date | None = None,
    account_id: str = "111111111111",
):
    """Insert synthetic daily cost records for a service."""
    if start_date is None:
        start_date = date.today() - timedelta(days=len(daily_amounts) - 1)

    for i, amount in enumerate(daily_amounts):
        day = start_date + timedelta(days=i)
        record = CostRecord(
            id=uuid.uuid4(),
            workspace_id=WORKSPACE_ID,
            provider="aws",
            data_source="test",
            line_item_id=f"test-{service}-{day}-{uuid.uuid4().hex[:8]}",
            billing_period=day.replace(day=1),
            usage_account_id=account_id,
            usage_start=datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
            usage_end=datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=timezone.utc),
            service=service,
            line_item_type="Usage",
            unblended_cost=amount,
            currency="USD",
        )
        db_session.add(record)


# ---------------------------------------------------------------------------
# Pure function tests — detect_spike
# ---------------------------------------------------------------------------


class TestDetectSpike:
    def test_no_spike_below_threshold(self):
        # 13 days at $100, today at $110 — well within 3σ
        values = [100.0] * 13 + [110.0]
        assert detect_spike(values, sigma_threshold=3.0) is None

    def test_constant_baseline_skipped(self):
        # Constant baseline (σ=0) — spike detection skipped conservatively
        values = [100.0] * 13 + [200.0]
        assert detect_spike(values, sigma_threshold=3.0) is None

    def test_spike_detected_2x(self):
        # Variable baseline around $100, today at $200 (2x spike)
        baseline = [
            100.0,
            102.0,
            98.0,
            101.0,
            99.0,
            103.0,
            97.0,
            100.0,
            104.0,
            96.0,
            101.0,
            99.0,
            102.0,
        ]
        values = baseline + [200.0]
        result = detect_spike(values, sigma_threshold=3.0)
        assert result is not None
        assert result["current"] == 200.0
        assert result["magnitude_pct"] > 90

    def test_spike_with_variable_baseline(self):
        # Variable baseline with a clear spike at the end
        baseline = [
            100.0,
            105.0,
            98.0,
            102.0,
            97.0,
            103.0,
            99.0,
            101.0,
            100.0,
            104.0,
            96.0,
            102.0,
            98.0,
        ]
        current = 300.0  # Way above any reasonable threshold
        values = baseline + [current]
        result = detect_spike(values, sigma_threshold=3.0)
        assert result is not None
        assert result["current"] == 300.0
        assert result["magnitude_pct"] > 100

    def test_no_spike_within_normal_range(self):
        # Noisy baseline, current within normal range
        baseline = [
            100.0,
            120.0,
            80.0,
            110.0,
            90.0,
            115.0,
            85.0,
            105.0,
            95.0,
            108.0,
            92.0,
            112.0,
            88.0,
        ]
        current = 125.0  # Still within normal noise
        values = baseline + [current]
        result = detect_spike(values, sigma_threshold=3.0)
        assert result is None

    def test_insufficient_data(self):
        assert detect_spike([100.0], sigma_threshold=3.0) is None
        assert detect_spike([], sigma_threshold=3.0) is None

    def test_zero_baseline(self):
        values = [0.0] * 13 + [100.0]
        assert detect_spike(values, sigma_threshold=3.0) is None


# ---------------------------------------------------------------------------
# Pure function tests — detect_drift
# ---------------------------------------------------------------------------


class TestDetectDrift:
    def test_drift_detected_upward(self):
        # Steadily increasing costs: $100, $110, $120, ...
        values = [100.0 + i * 10.0 for i in range(14)]
        result = detect_drift(values, drift_threshold_pct=10.0, window_days=14)
        assert result is not None
        assert result["slope"] > 0
        assert result["projected_pct"] > 10.0

    def test_no_drift_flat(self):
        # Flat costs
        values = [100.0] * 14
        result = detect_drift(values, drift_threshold_pct=10.0, window_days=14)
        assert result is None

    def test_no_drift_downward(self):
        # Decreasing costs
        values = [200.0 - i * 5.0 for i in range(14)]
        result = detect_drift(values, drift_threshold_pct=10.0, window_days=14)
        assert result is None

    def test_drift_small_increase_below_threshold(self):
        # Very slight upward trend — should not trigger at 10%
        values = [100.0 + i * 0.1 for i in range(14)]
        result = detect_drift(values, drift_threshold_pct=10.0, window_days=14)
        assert result is None

    def test_insufficient_data(self):
        assert detect_drift([100.0], drift_threshold_pct=10.0, window_days=14) is None


# ---------------------------------------------------------------------------
# Service integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_spike_creates_finding(db_session):
    """A 2x spike in test data creates a finding with type=anomaly."""
    # Variable baseline around $100, today at $300 (clear spike)
    baseline = [
        Decimal("100"),
        Decimal("102"),
        Decimal("98"),
        Decimal("101"),
        Decimal("99"),
        Decimal("103"),
        Decimal("97"),
        Decimal("100"),
        Decimal("104"),
        Decimal("96"),
        Decimal("101"),
        Decimal("99"),
        Decimal("102"),
        Decimal("98"),
    ]
    spike_day = [Decimal("300")]
    _insert_daily_costs(db_session, "AmazonEC2", baseline + spike_day)
    await db_session.flush()

    service = AnomalyDetectionService(db_session, WORKSPACE_ID)
    count = await service.run_detection(detection_date=date.today())

    assert count >= 1

    # Verify finding was created
    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, total = await repo.list_findings(
        finding_type="anomaly", detection_source="anomaly_spike"
    )
    assert total >= 1
    ec2_finding = next((f for f in findings if "AmazonEC2" in f.resource_id), None)
    assert ec2_finding is not None
    assert ec2_finding.estimated_cost_impact is not None
    assert ec2_finding.estimated_cost_impact > 0


@pytest.mark.asyncio
async def test_drift_creates_finding(db_session):
    """Gradual cost increase triggers drift finding."""
    # Steadily increasing: $100, $115, $130, ... over 15 days
    amounts = [Decimal("100") + Decimal("15") * i for i in range(15)]
    _insert_daily_costs(db_session, "AmazonRDS", amounts)
    await db_session.flush()

    service = AnomalyDetectionService(db_session, WORKSPACE_ID)
    count = await service.run_detection(detection_date=date.today())

    assert count >= 1

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="anomaly", detection_source="anomaly_drift")
    rds_finding = next((f for f in findings if "AmazonRDS" in f.resource_id), None)
    assert rds_finding is not None
    assert rds_finding.estimated_cost_impact is not None


@pytest.mark.asyncio
async def test_skip_insufficient_history(db_session):
    """Dimensions with < 14 days of data are skipped without error."""
    # Only 5 days of data
    _insert_daily_costs(
        db_session,
        "AmazonS3",
        [Decimal("100")] * 4 + [Decimal("500")],
        start_date=date.today() - timedelta(days=4),
    )
    await db_session.flush()

    service = AnomalyDetectionService(db_session, WORKSPACE_ID)
    await service.run_detection(detection_date=date.today())

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="anomaly", resource_id="service:AmazonS3")
    assert len(findings) == 0


@pytest.mark.asyncio
async def test_threshold_override_precedence(db_session):
    """Per-dimension override takes precedence over global defaults."""
    # Variable baseline around $100, today at $150 (would trigger with default 3σ)
    baseline = [
        Decimal("100"),
        Decimal("102"),
        Decimal("98"),
        Decimal("101"),
        Decimal("99"),
        Decimal("103"),
        Decimal("97"),
        Decimal("100"),
        Decimal("104"),
        Decimal("96"),
        Decimal("101"),
        Decimal("99"),
        Decimal("102"),
        Decimal("98"),
    ]
    spike_day = [Decimal("150")]
    _insert_daily_costs(db_session, "AmazonLambda", baseline + spike_day)

    # Set a per-dimension override with very high threshold to suppress detection.
    override = AnomalyThreshold(
        workspace_id=WORKSPACE_ID,
        dimension_type="service",
        dimension_value="AmazonLambda",
        window_days=14,
        sigma_threshold=Decimal("100.0"),  # Impossibly high
        drift_threshold_pct=Decimal("99.0"),
    )
    db_session.add(override)
    await db_session.flush()

    service = AnomalyDetectionService(db_session, WORKSPACE_ID)
    await service.run_detection(detection_date=date.today())

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(
        finding_type="anomaly", resource_id="service:AmazonLambda"
    )
    # Should not create a finding because threshold is impossibly high
    assert len(findings) == 0


@pytest.mark.asyncio
async def test_finding_includes_required_fields(db_session):
    """AC2: finding includes magnitude, dimension, cause, detection time."""
    baseline = [
        Decimal("100"),
        Decimal("102"),
        Decimal("98"),
        Decimal("101"),
        Decimal("99"),
        Decimal("103"),
        Decimal("97"),
        Decimal("100"),
        Decimal("104"),
        Decimal("96"),
        Decimal("101"),
        Decimal("99"),
        Decimal("102"),
        Decimal("98"),
    ]
    spike_day = [Decimal("400")]
    _insert_daily_costs(db_session, "AmazonECS", baseline + spike_day)
    await db_session.flush()

    service = AnomalyDetectionService(db_session, WORKSPACE_ID)
    await service.run_detection(detection_date=date.today())

    repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await repo.list_findings(finding_type="anomaly", resource_id="service:AmazonECS")
    assert len(findings) >= 1

    finding = findings[0]
    assert finding.type == "anomaly"
    assert finding.estimated_cost_impact is not None  # magnitude $
    assert "%" in finding.description  # magnitude %
    assert "AmazonECS" in finding.resource_id  # affected dimension
    assert finding.detected_at is not None  # detection time


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
        resp = await client.get("/api/v1/anomaly-thresholds")
        assert resp.status_code == 200
        data = resp.json()
        assert "defaults" in data
        assert "overrides" in data
        assert "service" in data["defaults"]
        assert "account" in data["defaults"]


@pytest.mark.asyncio
async def test_api_set_and_get_threshold(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/v1/anomaly-thresholds/service/AmazonEC2",
            json={
                "window_days": 21,
                "sigma_threshold": "2.5",
                "drift_threshold_pct": "15.0",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["dimension_type"] == "service"
        assert data["dimension_value"] == "AmazonEC2"
        assert data["window_days"] == 21

        # Verify it appears in list as an override
        resp = await client.get("/api/v1/anomaly-thresholds")
        assert resp.status_code == 200
        overrides = resp.json()["overrides"]
        assert any(o["dimension_value"] == "AmazonEC2" for o in overrides)


@pytest.mark.asyncio
async def test_api_delete_threshold(_patch_session):
    from numio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a threshold first
        await client.put(
            "/api/v1/anomaly-thresholds/service/AmazonS3",
            json={
                "window_days": 7,
                "sigma_threshold": "2.0",
                "drift_threshold_pct": "5.0",
            },
        )

        # Delete it
        resp = await client.delete("/api/v1/anomaly-thresholds/service/AmazonS3")
        assert resp.status_code == 204

        # Deleting again should 404
        resp = await client.delete("/api/v1/anomaly-thresholds/service/AmazonS3")
        assert resp.status_code == 404
