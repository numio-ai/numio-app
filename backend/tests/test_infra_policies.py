"""Tests for infrastructure policy engine — repository, evaluation service, and API."""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.infra_policy_service import InfraPolicyEvaluationService
from numio.db.finding_repository import FindingRepository
from numio.db.infra_policy_repository import InfraPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.schemas.infra_policy import CreateInfraPolicyRequest, UpdateInfraPolicyRequest

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo(db_session):
    return InfraPolicyRepository(db_session, WORKSPACE_ID)


@pytest.fixture
def finding_repo(db_session):
    return FindingRepository(db_session, WORKSPACE_ID)


def _make_policy_request(**overrides) -> CreateInfraPolicyRequest:
    defaults = {
        "name": "No GPU in staging",
        "description": "Deny GPU instance types in staging",
        "type": "instance_restriction",
        "severity": "high",
        "rule": {"denied_instance_types": ["p3.2xlarge", "p4d.24xlarge"]},
        "applicability": {"services": ["ec2"]},
        "is_guardrail": False,
        "is_active": True,
    }
    defaults.update(overrides)
    return CreateInfraPolicyRequest(**defaults)


async def _create_cloud_resource(
    db_session,
    *,
    resource_id: str = "i-abc123",
    service: str = "ec2",
    resource_type: str = "instance",
    region: str = "us-east-1",
    account_id: str = "123456789012",
    instance_type: str | None = "t3.medium",
) -> CloudResource:
    """Helper to insert a cloud resource for testing."""
    metadata = {}
    if instance_type:
        if service == "rds":
            metadata["instance_class"] = instance_type
        else:
            metadata["instance_type"] = instance_type

    resource = CloudResource(
        workspace_id=WORKSPACE_ID,
        account_id=account_id,
        region=region,
        service=service,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_metadata=metadata or None,
    )
    db_session.add(resource)
    await db_session.flush()
    await db_session.refresh(resource)
    return resource


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_policy(repo):
    policy = await repo.create(_make_policy_request())
    assert policy.name == "No GPU in staging"
    assert policy.type == "instance_restriction"
    assert policy.severity == "high"
    assert policy.rule == {"denied_instance_types": ["p3.2xlarge", "p4d.24xlarge"]}
    assert policy.is_guardrail is False
    assert policy.is_active is True
    assert policy.compliance_percentage is None


@pytest.mark.asyncio
async def test_list_policies(repo):
    await repo.create(_make_policy_request(name="Policy A"))
    await repo.create(_make_policy_request(name="Policy B"))

    policies, total = await repo.list_all()
    assert total == 2
    assert len(policies) == 2


@pytest.mark.asyncio
async def test_list_policies_with_filters(repo):
    await repo.create(_make_policy_request(name="Active", is_active=True))
    await repo.create(_make_policy_request(name="Inactive", is_active=False))
    await repo.create(
        _make_policy_request(
            name="Guardrail",
            is_guardrail=True,
            type="environment_constraint",
            rule={"allowed_regions": ["us-east-1"]},
        )
    )

    active, total_active = await repo.list_all(is_active=True)
    assert total_active == 2  # Active + Guardrail

    guardrails, total_guardrails = await repo.list_all(is_guardrail=True)
    assert total_guardrails == 1
    assert guardrails[0].name == "Guardrail"


@pytest.mark.asyncio
async def test_get_policy_by_id(repo):
    policy = await repo.create(_make_policy_request())
    fetched = await repo.get_by_id(policy.id)
    assert fetched is not None
    assert fetched.id == policy.id


@pytest.mark.asyncio
async def test_get_nonexistent_policy(repo):
    result = await repo.get_by_id(uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_update_policy(repo):
    policy = await repo.create(_make_policy_request())
    updated = await repo.update(
        policy.id,
        UpdateInfraPolicyRequest(severity="critical", is_guardrail=True),
    )
    assert updated is not None
    assert updated.severity == "critical"
    assert updated.is_guardrail is True
    assert updated.name == "No GPU in staging"  # unchanged


@pytest.mark.asyncio
async def test_update_nonexistent_policy(repo):
    result = await repo.update(uuid.uuid4(), UpdateInfraPolicyRequest(severity="low"))
    assert result is None


@pytest.mark.asyncio
async def test_delete_policy(repo):
    policy = await repo.create(_make_policy_request())
    deleted = await repo.delete(policy.id)
    assert deleted is True
    assert await repo.get_by_id(policy.id) is None


@pytest.mark.asyncio
async def test_delete_nonexistent_policy(repo):
    result = await repo.delete(uuid.uuid4())
    assert result is False


@pytest.mark.asyncio
async def test_get_active_policies(repo):
    await repo.create(_make_policy_request(name="Active", is_active=True))
    await repo.create(_make_policy_request(name="Inactive", is_active=False))

    active = await repo.get_active_policies()
    assert len(active) == 1
    assert active[0].name == "Active"


@pytest.mark.asyncio
async def test_get_guardrail_policies(repo):
    await repo.create(_make_policy_request(name="Normal"))
    await repo.create(_make_policy_request(name="Guard", is_guardrail=True))

    guardrails = await repo.get_guardrail_policies()
    assert len(guardrails) == 1
    assert guardrails[0].name == "Guard"


# ---------------------------------------------------------------------------
# Evaluation service — instance restriction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_instance_restriction_violation(db_session):
    """Resource using a denied instance type should produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            rule={"denied_instance_types": ["p3.2xlarge"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(db_session, resource_id="i-gpu1", instance_type="p3.2xlarge")

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 1

    # Verify finding was created
    finding_repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, count = await finding_repo.list_findings(
        finding_type="policy_violation",
        detection_source="infra_policy_engine",
    )
    assert count >= 1
    assert any("p3.2xlarge" in f.title for f in findings)


@pytest.mark.asyncio
async def test_evaluate_instance_restriction_compliant(db_session):
    """Resource using an allowed instance type should not produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Allow only t3",
            rule={"denied_instance_types": ["p3.2xlarge"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(db_session, resource_id="i-ok1", instance_type="t3.medium")

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 0


@pytest.mark.asyncio
async def test_evaluate_instance_restriction_allowed_list(db_session):
    """When allowed_instance_types is set, only those types are permitted."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Only t3.micro",
            rule={"allowed_instance_types": ["t3.micro"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(db_session, resource_id="i-big", instance_type="m5.xlarge")

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 1


# ---------------------------------------------------------------------------
# Evaluation service — resource count limit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_resource_count_limit_violation(db_session):
    """Exceeding max resource count should produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Max 2 RDS instances",
            type="resource_count_limit",
            rule={"service": "rds", "resource_type": "db-instance", "max_count": 2},
            applicability={},
        )
    )

    for i in range(3):
        await _create_cloud_resource(
            db_session,
            resource_id=f"db-{i}",
            service="rds",
            resource_type="db-instance",
            instance_type=None,
        )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 1


@pytest.mark.asyncio
async def test_evaluate_resource_count_limit_compliant(db_session):
    """Under the limit should not produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Max 5 RDS instances",
            type="resource_count_limit",
            rule={"service": "rds", "resource_type": "db-instance", "max_count": 5},
            applicability={},
        )
    )

    for i in range(3):
        await _create_cloud_resource(
            db_session,
            resource_id=f"db-ok-{i}",
            service="rds",
            resource_type="db-instance",
            instance_type=None,
        )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 0


# ---------------------------------------------------------------------------
# Evaluation service — environment constraint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_environment_constraint_violation(db_session):
    """Resource in a disallowed region should produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="US regions only",
            type="environment_constraint",
            rule={"allowed_regions": ["us-east-1", "us-west-2"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(
        db_session,
        resource_id="i-eu1",
        region="eu-west-1",
        instance_type=None,
    )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 1


@pytest.mark.asyncio
async def test_evaluate_environment_constraint_compliant(db_session):
    """Resource in an allowed region should not produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="US regions only compliant",
            type="environment_constraint",
            rule={"allowed_regions": ["us-east-1", "us-west-2"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(
        db_session,
        resource_id="i-us1",
        region="us-east-1",
        instance_type=None,
    )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    new_violations = await service.evaluate_policy(policy)

    assert new_violations == 0


# ---------------------------------------------------------------------------
# Evaluation service — spending limit (mocked cost data)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_spending_limit_violation(db_session):
    """Spending over the limit should produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Team X max $10k",
            type="spending_limit",
            rule={
                "dimension": "team",
                "dimension_value": "frontend",
                "limit_amount": 10000,
                "period": "monthly",
            },
            applicability={},
        )
    )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)

    # Mock cost data: $12000 spent
    mock_cost = AsyncMock()
    mock_cost.return_value = _mock_cost_by_dimension("frontend", Decimal("12000"))

    with patch.object(service._cost_service, "get_cost_by_dimension", mock_cost):
        new_violations = await service.evaluate_policy(policy)

    assert new_violations == 1


@pytest.mark.asyncio
async def test_evaluate_spending_limit_compliant(db_session):
    """Spending under the limit should not produce a finding."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Team Y max $10k",
            type="spending_limit",
            rule={
                "dimension": "team",
                "dimension_value": "backend",
                "limit_amount": 10000,
                "period": "monthly",
            },
            applicability={},
        )
    )

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)

    mock_cost = AsyncMock()
    mock_cost.return_value = _mock_cost_by_dimension("backend", Decimal("5000"))

    with patch.object(service._cost_service, "get_cost_by_dimension", mock_cost):
        new_violations = await service.evaluate_policy(policy)

    assert new_violations == 0


# ---------------------------------------------------------------------------
# Evaluation service — compliance percentage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_compliance_percentage_updated(db_session):
    """Compliance percentage should be calculated after evaluation."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Compliance test",
            rule={"denied_instance_types": ["p3.2xlarge"]},
            applicability={"services": ["ec2"]},
        )
    )

    # Create 2 compliant and 1 violating resource
    await _create_cloud_resource(db_session, resource_id="i-ok1", instance_type="t3.medium")
    await _create_cloud_resource(db_session, resource_id="i-ok2", instance_type="t3.small")
    await _create_cloud_resource(db_session, resource_id="i-bad", instance_type="p3.2xlarge")

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    await service.evaluate_policy(policy)

    updated = await repo.get_by_id(policy.id)
    assert updated.compliance_percentage is not None
    # 2 out of 3 compliant = 66.67%
    assert float(updated.compliance_percentage) == pytest.approx(66.67, abs=0.01)
    assert updated.last_evaluated_at is not None


# ---------------------------------------------------------------------------
# Evaluation service — delete policy resolves findings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_policy_findings_on_delete(db_session):
    """Deleting a policy should resolve its active findings."""
    repo = InfraPolicyRepository(db_session, WORKSPACE_ID)
    policy = await repo.create(
        _make_policy_request(
            name="Delete test",
            rule={"denied_instance_types": ["p3.2xlarge"]},
            applicability={"services": ["ec2"]},
        )
    )

    await _create_cloud_resource(db_session, resource_id="i-del", instance_type="p3.2xlarge")

    service = InfraPolicyEvaluationService(db_session, WORKSPACE_ID)
    await service.evaluate_policy(policy)

    # Verify finding exists
    finding_repo = FindingRepository(db_session, WORKSPACE_ID)
    findings, _ = await finding_repo.list_findings(
        finding_type="policy_violation",
        detection_source="infra_policy_engine",
        status="open",
    )
    policy_findings = [f for f in findings if f.resource_id.startswith(f"policy:{policy.id}:")]
    assert len(policy_findings) >= 1

    # Resolve findings
    resolved = await service.resolve_policy_findings(str(policy.id))
    assert resolved >= 1

    # Verify findings are resolved
    open_findings, _ = await finding_repo.list_findings(
        finding_type="policy_violation",
        detection_source="infra_policy_engine",
        status="open",
    )
    remaining = [f for f in open_findings if f.resource_id.startswith(f"policy:{policy.id}:")]
    assert len(remaining) == 0


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
async def test_api_create_policy(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "API Test Policy",
                "type": "instance_restriction",
                "severity": "high",
                "rule": {"denied_instance_types": ["p3.2xlarge"]},
                "applicability": {"services": ["ec2"]},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "API Test Policy"
        assert data["type"] == "instance_restriction"
        assert data["severity"] == "high"
        assert data["is_guardrail"] is False
        assert data["is_active"] is True


@pytest.mark.asyncio
async def test_api_list_policies(api_client):
    async with api_client as c:
        await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "List Test A",
                "type": "instance_restriction",
                "severity": "medium",
                "rule": {"denied_instance_types": ["g4dn.xlarge"]},
            },
        )
        await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "List Test B",
                "type": "environment_constraint",
                "severity": "high",
                "rule": {"allowed_regions": ["us-east-1"]},
            },
        )

        resp = await c.get("/api/v1/infra-policies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 2


@pytest.mark.asyncio
async def test_api_get_policy_detail(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "Detail Test",
                "type": "instance_restriction",
                "severity": "low",
                "rule": {"denied_instance_types": ["x1e.32xlarge"]},
            },
        )
        policy_id = resp.json()["id"]

        resp = await c.get(f"/api/v1/infra-policies/{policy_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Detail Test"
        assert "violations" in data


@pytest.mark.asyncio
async def test_api_update_policy(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "Update Test",
                "type": "instance_restriction",
                "severity": "medium",
                "rule": {"denied_instance_types": ["p3.2xlarge"]},
            },
        )
        policy_id = resp.json()["id"]

        resp = await c.put(
            f"/api/v1/infra-policies/{policy_id}",
            json={
                "severity": "critical",
                "is_guardrail": True,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["severity"] == "critical"
        assert resp.json()["is_guardrail"] is True


@pytest.mark.asyncio
async def test_api_delete_policy(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/infra-policies",
            json={
                "name": "Delete Test API",
                "type": "environment_constraint",
                "severity": "high",
                "rule": {"allowed_regions": ["us-east-1"]},
            },
        )
        policy_id = resp.json()["id"]

        resp = await c.delete(f"/api/v1/infra-policies/{policy_id}")
        assert resp.status_code == 204

        resp = await c.get(f"/api/v1/infra-policies/{policy_id}")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_api_404_for_missing_policy(api_client):
    async with api_client as c:
        fake_id = str(uuid.uuid4())
        resp = await c.get(f"/api/v1/infra-policies/{fake_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_cost_by_dimension(dimension_value: str, amount: Decimal):
    """Create a mock CostByDimensionResponse-like object."""
    from datetime import date

    from numio.schemas.attribution import (
        CostByDimensionResponse,
        CostViewMetadata,
        DimensionCostItem,
    )

    return CostByDimensionResponse(
        metadata=CostViewMetadata(
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
        ),
        total=amount,
        data=[
            DimensionCostItem(
                dimension_value=dimension_value,
                amount=amount,
                percentage=Decimal("100.00"),
            )
        ],
    )
