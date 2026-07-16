"""Tests for cost attribution rules and cost views API."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.cost_attribution_service import CostAttributionService
from numio.db.attribution_rule_repository import AttributionRuleRepository
from numio.models.cost_record import CostRecord
from numio.schemas.attribution import (
    AttributionRuleCreate,
    AttributionRuleUpdate,
    Granularity,
    SourceType,
    TrendPeriod,
)

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def rule_repo(db_session, default_workspace_id):
    return AttributionRuleRepository(db_session, default_workspace_id)


@pytest.fixture
def cost_service(db_session, default_workspace_id):
    return CostAttributionService(db_session, default_workspace_id)


@pytest.fixture
async def sample_cost_records(db_session, default_workspace_id):
    """Create cost records across teams, accounts, and dates for testing."""
    records = []
    configs = [
        {  # Team platform, account 111, March 1-5
            "tags": {"Team": "platform", "Project": "search"},
            "account": "111111111111",
            "service": "AmazonEC2",
            "days": range(1, 6),
            "daily_cost": Decimal("100.00"),
        },
        {  # Team data, account 222, March 1-5
            "tags": {"Team": "data", "Project": "analytics"},
            "account": "222222222222",
            "service": "AmazonRDS",
            "days": range(1, 6),
            "daily_cost": Decimal("200.00"),
        },
        {  # No team tag (unallocated), account 333, March 1-5
            "tags": {},
            "account": "333333333333",
            "service": "AmazonS3",
            "days": range(1, 6),
            "daily_cost": Decimal("50.00"),
        },
        {  # Team platform, account 111, March 6-10
            "tags": {"Team": "platform", "Project": "search"},
            "account": "111111111111",
            "service": "AmazonEC2",
            "days": range(6, 11),
            "daily_cost": Decimal("150.00"),
        },
        {  # Team data, account 222, March 6-10
            "tags": {"Team": "data", "Project": "analytics"},
            "account": "222222222222",
            "service": "AmazonRDS",
            "days": range(6, 11),
            "daily_cost": Decimal("180.00"),
        },
    ]
    for cfg in configs:
        for day in cfg["days"]:
            r = CostRecord(
                id=uuid.uuid4(),
                workspace_id=default_workspace_id,
                provider="aws",
                data_source="cur",
                line_item_id=f"line-{cfg['account']}-{cfg['service']}-{day}",
                billing_period=date(2026, 3, 1),
                usage_account_id=cfg["account"],
                usage_start=datetime(2026, 3, day, tzinfo=timezone.utc),
                usage_end=datetime(2026, 3, day, 23, 59, 59, tzinfo=timezone.utc),
                service=cfg["service"],
                region="us-east-1",
                line_item_type="Usage",
                unblended_cost=cfg["daily_cost"],
                currency="USD",
                tags=cfg["tags"] if cfg["tags"] else None,
            )
            db_session.add(r)
            records.append(r)
    await db_session.flush()
    return records


@pytest.fixture
async def tag_team_rule(rule_repo):
    """Create a tag-based rule mapping Team tag -> team dimension."""
    data = AttributionRuleCreate(
        name="Team from tag",
        dimension="team",
        source_type=SourceType.tag,
        priority=0,
        mapping_config={"tag_key": "Team"},
    )
    return await rule_repo.create(data)


@pytest.fixture
async def account_env_rule(rule_repo):
    """Create account-based rule mapping accounts -> environment dimension."""
    data = AttributionRuleCreate(
        name="Prod accounts",
        dimension="environment",
        source_type=SourceType.account,
        priority=0,
        mapping_config={
            "account_ids": ["111111111111", "222222222222"],
            "dimension_value": "production",
        },
    )
    return await rule_repo.create(data)


@pytest.fixture
async def client(db_session):
    """Async HTTP client for testing API endpoints."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


class TestAttributionRuleRepository:
    async def test_create_rule(self, rule_repo):
        data = AttributionRuleCreate(
            name="Team from tag",
            dimension="team",
            source_type=SourceType.tag,
            priority=0,
            mapping_config={"tag_key": "Team"},
        )
        rule = await rule_repo.create(data)
        assert rule.id is not None
        assert rule.dimension == "team"
        assert rule.source_type == "tag"
        assert rule.mapping_config["tag_key"] == "Team"

    async def test_list_all(self, rule_repo):
        for i in range(3):
            await rule_repo.create(
                AttributionRuleCreate(
                    name=f"Rule {i}",
                    dimension="team" if i < 2 else "project",
                    source_type=SourceType.tag,
                    priority=i,
                    mapping_config={"tag_key": f"Tag{i}"},
                )
            )
        rules = await rule_repo.list_all()
        assert len(rules) == 3

    async def test_list_by_dimension(self, rule_repo):
        await rule_repo.create(
            AttributionRuleCreate(
                name="Team rule",
                dimension="team",
                source_type=SourceType.tag,
                priority=0,
                mapping_config={"tag_key": "Team"},
            )
        )
        await rule_repo.create(
            AttributionRuleCreate(
                name="Project rule",
                dimension="project",
                source_type=SourceType.tag,
                priority=0,
                mapping_config={"tag_key": "Project"},
            )
        )
        team_rules = await rule_repo.list_by_dimension("team")
        assert len(team_rules) == 1
        assert team_rules[0].dimension == "team"

    async def test_update_rule(self, rule_repo):
        rule = await rule_repo.create(
            AttributionRuleCreate(
                name="Old name",
                dimension="team",
                source_type=SourceType.tag,
                priority=0,
                mapping_config={"tag_key": "Team"},
            )
        )
        updated = await rule_repo.update(
            rule.id, AttributionRuleUpdate(name="New name", priority=5)
        )
        assert updated.name == "New name"
        assert updated.priority == 5

    async def test_delete_rule(self, rule_repo):
        rule = await rule_repo.create(
            AttributionRuleCreate(
                name="To delete",
                dimension="team",
                source_type=SourceType.tag,
                priority=0,
                mapping_config={"tag_key": "Team"},
            )
        )
        assert await rule_repo.delete(rule.id) is True
        assert await rule_repo.get_by_id(rule.id) is None

    async def test_delete_nonexistent(self, rule_repo):
        assert await rule_repo.delete(uuid.uuid4()) is False


# ---------------------------------------------------------------------------
# Service tests — cost views with attribution
# ---------------------------------------------------------------------------


class TestCostAttributionService:
    async def test_total_cost(self, cost_service, sample_cost_records):
        result = await cost_service.get_total_cost(
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 11),
        )
        # platform: 5*100 + 5*150 = 1250, data: 5*200 + 5*180 = 1900, s3: 5*50 = 250
        expected_total = Decimal("3400.00")
        assert result.total == expected_total
        assert len(result.data) > 0

    async def test_total_cost_empty_range(self, cost_service, sample_cost_records):
        result = await cost_service.get_total_cost(
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        assert result.total == Decimal(0)
        assert len(result.data) > 0  # Zero-value buckets should still be returned

    async def test_cost_by_dimension_tag(self, cost_service, sample_cost_records, tag_team_rule):
        result = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 11),
        )
        dim_map = {item.dimension_value: item.amount for item in result.data}
        assert dim_map["platform"] == Decimal("1250.00")
        assert dim_map["data"] == Decimal("1900.00")
        # S3 records have no Team tag -> unallocated
        assert dim_map["unallocated"] == Decimal("250.00")

    async def test_cost_by_dimension_account(
        self, cost_service, sample_cost_records, account_env_rule
    ):
        result = await cost_service.get_cost_by_dimension(
            dimension="environment",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 11),
        )
        dim_map = {item.dimension_value: item.amount for item in result.data}
        # Accounts 111 and 222 -> production: 1250 + 1900 = 3150
        assert dim_map["production"] == Decimal("3150.00")
        # Account 333 -> unallocated
        assert dim_map["unallocated"] == Decimal("250.00")

    async def test_cost_by_dimension_per_account(
        self, cost_service, sample_cost_records, tag_team_rule
    ):
        result = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 11),
            account="111111111111",
        )
        dim_map = {item.dimension_value: item.amount for item in result.data}
        assert dim_map["platform"] == Decimal("1250.00")
        assert "data" not in dim_map

    async def test_multi_dimension_attribution(
        self, cost_service, sample_cost_records, tag_team_rule, account_env_rule
    ):
        """A cost record can be attributed to multiple dimensions simultaneously."""
        team_result = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        env_result = await cost_service.get_cost_by_dimension(
            dimension="environment",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        team_map = {item.dimension_value: item.amount for item in team_result.data}
        env_map = {item.dimension_value: item.amount for item in env_result.data}
        # Same records appear in both groupings
        assert team_map["platform"] == Decimal("500.00")
        assert env_map["production"] == Decimal("1500.00")

    async def test_cost_by_dimension_no_rules(self, cost_service, sample_cost_records):
        """With no rules, everything is unallocated."""
        result = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        assert len(result.data) == 1
        assert result.data[0].dimension_value == "unallocated"

    async def test_time_series(self, cost_service, sample_cost_records):
        result = await cost_service.get_cost_time_series(
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
            granularity=Granularity.daily,
        )
        assert len(result.data) == 5
        # Day 1: 100 + 200 + 50 = 350
        assert result.data[0].amount == Decimal("350.00")

    async def test_time_series_with_dimension(
        self, cost_service, sample_cost_records, tag_team_rule
    ):
        result = await cost_service.get_cost_time_series(
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
            granularity=Granularity.daily,
            dimension="team",
        )
        assert result.by_dimension is not None
        dim_names = {d.dimension_value for d in result.by_dimension}
        assert "platform" in dim_names
        assert "data" in dim_names

    async def test_retroactive_attribution(
        self, db_session, cost_service, sample_cost_records, rule_repo
    ):
        """Changing rules immediately affects historical queries (AC #3)."""
        # Initially no rules - all unallocated
        result1 = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        assert result1.data[0].dimension_value == "unallocated"

        # Add a rule
        await rule_repo.create(
            AttributionRuleCreate(
                name="Team tag",
                dimension="team",
                source_type=SourceType.tag,
                priority=0,
                mapping_config={"tag_key": "Team"},
            )
        )
        await db_session.flush()

        # Same query now returns attributed data
        result2 = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        dim_map = {item.dimension_value: item.amount for item in result2.data}
        assert "platform" in dim_map

    async def test_percentage_in_dimension_response(
        self, cost_service, sample_cost_records, tag_team_rule
    ):
        result = await cost_service.get_cost_by_dimension(
            dimension="team",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 6),
        )
        total_pct = sum(item.percentage for item in result.data)
        assert abs(total_pct - Decimal("100")) < Decimal("1")


# ---------------------------------------------------------------------------
# Trend analysis tests
# ---------------------------------------------------------------------------


class TestTrendAnalysis:
    async def test_trends_week_over_week(self, cost_service, sample_cost_records, tag_team_rule):
        # End date March 10 (Tuesday) — current week starts March 9 (Monday)
        result = await cost_service.get_trends(
            dimension="team",
            period=TrendPeriod.week,
            end_date=date(2026, 3, 10),
        )
        assert result.period == "week"
        assert len(result.data) > 0

    async def test_significant_changes(self, cost_service, sample_cost_records, tag_team_rule):
        result = await cost_service.get_significant_changes(
            dimension="team",
            period=TrendPeriod.week,
            end_date=date(2026, 3, 10),
            percentage_threshold=Decimal("10"),
            absolute_threshold=Decimal("10"),
        )
        assert isinstance(result.data, list)

    async def test_significant_changes_filters_small_amounts(
        self, cost_service, sample_cost_records, tag_team_rule
    ):
        """High absolute_threshold should filter out small changes."""
        result = await cost_service.get_significant_changes(
            dimension="team",
            period=TrendPeriod.week,
            end_date=date(2026, 3, 10),
            percentage_threshold=Decimal("1"),
            absolute_threshold=Decimal("999999"),
        )
        assert len(result.data) == 0


# ---------------------------------------------------------------------------
# API tests — Attribution Rules
# ---------------------------------------------------------------------------


class TestAttributionRulesAPI:
    async def test_create_tag_rule(self, client):
        resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Team from tag",
                "dimension": "team",
                "source_type": "tag",
                "priority": 0,
                "mapping_config": {"tag_key": "Team"},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["dimension"] == "team"
        assert data["source_type"] == "tag"

    async def test_create_account_rule(self, client):
        resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Prod env",
                "dimension": "environment",
                "source_type": "account",
                "priority": 0,
                "mapping_config": {
                    "account_ids": ["111111111111"],
                    "dimension_value": "production",
                },
            },
        )
        assert resp.status_code == 201
        assert resp.json()["source_type"] == "account"

    async def test_create_tag_rule_invalid_config(self, client):
        resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Bad rule",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"wrong_key": "value"},
            },
        )
        assert resp.status_code == 422

    async def test_create_account_rule_missing_dimension_value(self, client):
        resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Bad account rule",
                "dimension": "env",
                "source_type": "account",
                "mapping_config": {"account_ids": ["111"]},
            },
        )
        assert resp.status_code == 422

    async def test_list_rules(self, client):
        await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Rule 1",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Team"},
            },
        )
        resp = await client.get("/api/v1/attribution-rules")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1

    async def test_list_rules_by_dimension(self, client):
        await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Team rule",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Team"},
            },
        )
        await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Env rule",
                "dimension": "environment",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Environment"},
            },
        )
        resp = await client.get("/api/v1/attribution-rules?dimension=team")
        assert resp.status_code == 200
        for rule in resp.json()["rules"]:
            assert rule["dimension"] == "team"

    async def test_get_rule(self, client):
        create_resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Get me",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Team"},
            },
        )
        rule_id = create_resp.json()["id"]
        resp = await client.get(f"/api/v1/attribution-rules/{rule_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Get me"

    async def test_get_rule_not_found(self, client):
        resp = await client.get(f"/api/v1/attribution-rules/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_update_rule(self, client):
        create_resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Original",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Team"},
            },
        )
        rule_id = create_resp.json()["id"]
        resp = await client.put(
            f"/api/v1/attribution-rules/{rule_id}",
            json={"name": "Updated"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    async def test_delete_rule(self, client):
        create_resp = await client.post(
            "/api/v1/attribution-rules",
            json={
                "name": "Delete me",
                "dimension": "team",
                "source_type": "tag",
                "mapping_config": {"tag_key": "Team"},
            },
        )
        rule_id = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/attribution-rules/{rule_id}")
        assert resp.status_code == 204
        # Verify gone
        resp = await client.get(f"/api/v1/attribution-rules/{rule_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# API tests — Cost Views
# ---------------------------------------------------------------------------


class TestCostViewsAPI:
    async def test_total_cost(self, client, sample_cost_records):
        resp = await client.get(
            "/api/v1/cost-views/total",
            params={"start_date": "2026-03-01", "end_date": "2026-03-11"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert Decimal(data["total"]) == Decimal("3400.00")
        assert len(data["data"]) > 0

    async def test_total_cost_empty_range(self, client):
        resp = await client.get(
            "/api/v1/cost-views/total",
            params={"start_date": "2025-01-01", "end_date": "2025-01-31"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert Decimal(data["total"]) == Decimal("0")
        assert len(data["data"]) > 0

    async def test_by_dimension(self, client, sample_cost_records, tag_team_rule):
        resp = await client.get(
            "/api/v1/cost-views/by-dimension",
            params={
                "dimension": "team",
                "start_date": "2026-03-01",
                "end_date": "2026-03-11",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        dim_map = {d["dimension_value"]: Decimal(d["amount"]) for d in data["data"]}
        assert dim_map["platform"] == Decimal("1250.00")

    async def test_time_series(self, client, sample_cost_records):
        resp = await client.get(
            "/api/v1/cost-views/time-series",
            params={
                "start_date": "2026-03-01",
                "end_date": "2026-03-06",
                "granularity": "daily",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["granularity"] == "daily"
        assert len(data["data"]) == 5

    async def test_trends(self, client, sample_cost_records, tag_team_rule):
        resp = await client.get(
            "/api/v1/cost-views/trends",
            params={
                "dimension": "team",
                "period": "week",
                "end_date": "2026-03-10",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["period"] == "week"

    async def test_significant_changes(self, client, sample_cost_records, tag_team_rule):
        resp = await client.get(
            "/api/v1/cost-views/significant-changes",
            params={
                "dimension": "team",
                "period": "week",
                "end_date": "2026-03-10",
                "percentage_threshold": "10",
                "absolute_threshold": "10",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data

    async def test_per_account_filter(self, client, sample_cost_records):
        resp = await client.get(
            "/api/v1/cost-views/total",
            params={
                "start_date": "2026-03-01",
                "end_date": "2026-03-06",
                "account": "111111111111",
            },
        )
        assert resp.status_code == 200
        # Only account 111 costs: 5 * 100 = 500
        assert Decimal(resp.json()["total"]) == Decimal("500.00")
