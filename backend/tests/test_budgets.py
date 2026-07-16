"""Tests for budget management — repository, evaluation service, and API."""

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.budget_evaluation_service import BudgetEvaluationService
from numio.db.budget_repository import BudgetRepository
from numio.schemas.budget import CreateBudgetRequest, UpdateBudgetRequest

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo(db_session):
    return BudgetRepository(db_session, WORKSPACE_ID)


def _make_budget_request(**overrides) -> CreateBudgetRequest:
    defaults = {
        "name": "Team Infra Monthly",
        "amount": Decimal("10000.00"),
        "currency": "USD",
        "period": "monthly",
        "dimension": "team",
        "dimension_value": "infrastructure",
        "alert_thresholds": [50, 80, 100],
    }
    defaults.update(overrides)
    return CreateBudgetRequest(**defaults)


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_budget(repo):
    budget = await repo.create(_make_budget_request())
    assert budget.name == "Team Infra Monthly"
    assert budget.amount == Decimal("10000.00")
    assert budget.period == "monthly"
    assert budget.dimension == "team"
    assert budget.dimension_value == "infrastructure"
    assert budget.alert_thresholds == [50, 80, 100]


@pytest.mark.asyncio
async def test_list_budgets(repo):
    await repo.create(_make_budget_request(name="Budget A"))
    await repo.create(_make_budget_request(name="Budget B"))

    budgets, total = await repo.list_all()
    assert total == 2
    assert len(budgets) == 2


@pytest.mark.asyncio
async def test_get_budget_by_id(repo):
    budget = await repo.create(_make_budget_request())
    fetched = await repo.get_by_id(budget.id)
    assert fetched is not None
    assert fetched.id == budget.id
    assert fetched.name == budget.name


@pytest.mark.asyncio
async def test_get_nonexistent_budget(repo):
    result = await repo.get_by_id(uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_update_budget(repo):
    budget = await repo.create(_make_budget_request())
    updated = await repo.update(
        budget.id,
        UpdateBudgetRequest(amount=Decimal("15000.00"), alert_thresholds=[60, 90]),
    )
    assert updated is not None
    assert updated.amount == Decimal("15000.00")
    assert updated.alert_thresholds == [60, 90]
    assert updated.name == "Team Infra Monthly"  # unchanged


@pytest.mark.asyncio
async def test_update_nonexistent_budget(repo):
    result = await repo.update(uuid.uuid4(), UpdateBudgetRequest(amount=Decimal("5000")))
    assert result is None


@pytest.mark.asyncio
async def test_delete_budget(repo):
    budget = await repo.create(_make_budget_request())
    deleted = await repo.delete(budget.id)
    assert deleted is True

    fetched = await repo.get_by_id(budget.id)
    assert fetched is None


@pytest.mark.asyncio
async def test_delete_nonexistent_budget(repo):
    result = await repo.delete(uuid.uuid4())
    assert result is False


# ---------------------------------------------------------------------------
# Evaluation service — period boundaries
# ---------------------------------------------------------------------------


def test_monthly_period_boundaries():
    start, end = BudgetEvaluationService._period_boundaries("monthly", date(2026, 3, 15))
    assert start == date(2026, 3, 1)
    assert end == date(2026, 4, 1)


def test_quarterly_period_boundaries():
    start, end = BudgetEvaluationService._period_boundaries("quarterly", date(2026, 5, 20))
    assert start == date(2026, 4, 1)
    assert end == date(2026, 7, 1)


def test_quarterly_period_boundaries_q1():
    start, end = BudgetEvaluationService._period_boundaries("quarterly", date(2026, 2, 10))
    assert start == date(2026, 1, 1)
    assert end == date(2026, 4, 1)


def test_quarterly_period_boundaries_q4():
    start, end = BudgetEvaluationService._period_boundaries("quarterly", date(2026, 11, 5))
    assert start == date(2026, 10, 1)
    assert end == date(2027, 1, 1)


# ---------------------------------------------------------------------------
# Evaluation service — budget evaluation with mocked cost data
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_budget_on_track(db_session):
    """Budget at 30% consumed mid-month, projecting ~60% — should be on_track."""
    repo = BudgetRepository(db_session, WORKSPACE_ID)
    budget = await repo.create(_make_budget_request(amount=Decimal("10000.00")))

    service = BudgetEvaluationService(db_session, WORKSPACE_ID)

    # Mock cost data: $3000 spent for dimension_value "infrastructure"
    mock_cost_response = AsyncMock()
    mock_cost_response.return_value = _mock_cost_by_dimension("infrastructure", Decimal("3000"))

    mock_drivers_response = AsyncMock()
    mock_drivers_response.return_value = _mock_cost_by_dimension("ec2", Decimal("2000"))

    with (
        patch.object(
            service._cost_service,
            "get_cost_by_dimension",
            side_effect=[
                mock_cost_response.return_value,
                mock_drivers_response.return_value,
            ],
        ),
        patch("numio.core.budget_evaluation_service.date") as mock_date,
    ):
        mock_date.today.return_value = date(2026, 3, 15)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        detail = await service.evaluate_budget(budget)

    assert detail.current_spend == Decimal("3000")
    assert detail.status.value == "on_track"
    assert detail.percentage_consumed == Decimal("30.00")


@pytest.mark.asyncio
async def test_evaluate_budget_exceeded(db_session):
    """Budget 120% consumed — should be exceeded."""
    repo = BudgetRepository(db_session, WORKSPACE_ID)
    budget = await repo.create(_make_budget_request(amount=Decimal("5000.00")))

    service = BudgetEvaluationService(db_session, WORKSPACE_ID)

    mock_cost_response = AsyncMock()
    mock_cost_response.return_value = _mock_cost_by_dimension("infrastructure", Decimal("6000"))

    mock_drivers_response = AsyncMock()
    mock_drivers_response.return_value = _mock_cost_by_dimension("ec2", Decimal("4000"))

    with (
        patch.object(
            service._cost_service,
            "get_cost_by_dimension",
            side_effect=[
                mock_cost_response.return_value,
                mock_drivers_response.return_value,
            ],
        ),
        patch("numio.core.budget_evaluation_service.date") as mock_date,
    ):
        mock_date.today.return_value = date(2026, 3, 20)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        detail = await service.evaluate_budget(budget)

    assert detail.current_spend == Decimal("6000")
    assert detail.status.value == "exceeded"
    assert detail.percentage_consumed == Decimal("120.00")


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
async def test_api_create_budget(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/budgets",
            json={
                "name": "API Test Budget",
                "amount": "8000.00",
                "period": "monthly",
                "dimension": "team",
                "dimension_value": "platform",
                "alert_thresholds": [50, 80, 100],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "API Test Budget"
        assert data["amount"] == "8000.00"
        assert data["dimension"] == "team"


@pytest.mark.asyncio
async def test_api_update_budget(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/budgets",
            json={
                "name": "Update Test",
                "amount": "5000",
                "period": "monthly",
                "dimension": "project",
                "dimension_value": "alpha",
            },
        )
        budget_id = resp.json()["id"]

        resp = await c.put(
            f"/api/v1/budgets/{budget_id}",
            json={
                "amount": "7500",
                "alert_thresholds": [60, 90],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["amount"] == "7500.00"
        assert resp.json()["alert_thresholds"] == [60, 90]


@pytest.mark.asyncio
async def test_api_delete_budget(api_client):
    async with api_client as c:
        resp = await c.post(
            "/api/v1/budgets",
            json={
                "name": "Delete Test",
                "amount": "3000",
                "period": "quarterly",
                "dimension": "service",
                "dimension_value": "ec2",
            },
        )
        budget_id = resp.json()["id"]

        resp = await c.delete(f"/api/v1/budgets/{budget_id}")
        assert resp.status_code == 204

        resp = await c.get(f"/api/v1/budgets/{budget_id}")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_api_404_for_missing_budget(api_client):
    async with api_client as c:
        fake_id = str(uuid.uuid4())
        resp = await c.get(f"/api/v1/budgets/{fake_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_cost_by_dimension(dimension_value: str, amount: Decimal):
    """Create a mock CostByDimensionResponse-like object."""
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
