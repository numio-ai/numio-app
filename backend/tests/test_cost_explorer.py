"""Tests for Cost Explorer pass-through API, caching, and rate limiting."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core import cache
from numio.core.cost_explorer_service import (
    CostExplorerError,
    _call_with_retry,
    _normalize_results_by_time,
)
from numio.models.aws_account import AwsAccount

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_CE_RESPONSE = {
    "ResultsByTime": [
        {
            "TimePeriod": {"Start": "2025-11-01", "End": "2025-11-02"},
            "Groups": [
                {
                    "Keys": ["AmazonEC2"],
                    "Metrics": {"UnblendedCost": {"Amount": "120.50", "Unit": "USD"}},
                },
                {
                    "Keys": ["AmazonS3"],
                    "Metrics": {"UnblendedCost": {"Amount": "5.25", "Unit": "USD"}},
                },
            ],
        }
    ]
}

SAMPLE_TOTAL_RESPONSE = {
    "ResultsByTime": [
        {
            "TimePeriod": {"Start": "2025-11-01", "End": "2025-11-02"},
            "Total": {"UnblendedCost": {"Amount": "125.75", "Unit": "USD"}},
        }
    ]
}

SAMPLE_TAGS_RESPONSE = {
    "Tags": ["Environment", "Team", "Project"],
}


@pytest.fixture
async def account_in_db(db_session, default_workspace_id):
    """Create a test AWS account in the database."""
    account = AwsAccount(
        id=uuid.uuid4(),
        workspace_id=default_workspace_id,
        aws_account_id="111111111111",
        alias="test-dev",
        role_arn="arn:aws:iam::111111111111:role/NumioAccess",
        status="active",
        environment_label="dev",
    )
    db_session.add(account)
    await db_session.flush()
    return account


@pytest.fixture
async def client(self=None, *, db_session=None, account_in_db=None):
    """This is redefined per test class below."""
    pass


# ---------------------------------------------------------------------------
# Response normalization tests
# ---------------------------------------------------------------------------


class TestNormalization:
    def test_normalize_grouped_results(self):
        result = _normalize_results_by_time(SAMPLE_CE_RESPONSE["ResultsByTime"], "service")
        assert len(result) == 2
        assert result[0]["service"] == "AmazonEC2"
        assert result[0]["amount"] == "120.50"
        assert result[0]["currency"] == "USD"
        assert result[0]["start"] == "2025-11-01"
        assert result[1]["service"] == "AmazonS3"

    def test_normalize_total_results(self):
        result = _normalize_results_by_time(SAMPLE_TOTAL_RESPONSE["ResultsByTime"], "total")
        assert len(result) == 1
        assert result[0]["amount"] == "125.75"
        assert result[0]["currency"] == "USD"

    def test_normalize_empty_results(self):
        result = _normalize_results_by_time([], "service")
        assert result == []

    def test_normalize_empty_groups(self):
        data = [
            {
                "TimePeriod": {"Start": "2025-11-01", "End": "2025-11-02"},
                "Groups": [],
            }
        ]
        result = _normalize_results_by_time(data, "service")
        assert result == []


# ---------------------------------------------------------------------------
# Rate limiting / retry tests
# ---------------------------------------------------------------------------


class TestRateLimiting:
    async def test_successful_call_no_retry(self):
        mock_func = MagicMock(return_value={"data": "ok"})
        result = await _call_with_retry(mock_func)
        assert result == {"data": "ok"}
        assert mock_func.call_count == 1

    async def test_retry_on_throttling(self):
        from botocore.exceptions import ClientError

        throttle_error = ClientError(
            {
                "Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"},
                "ResponseMetadata": {"HTTPStatusCode": 429},
            },
            "GetCostAndUsage",
        )
        mock_func = MagicMock(side_effect=[throttle_error, {"data": "ok"}])

        with patch("numio.core.cost_explorer_service.BASE_DELAY", 0.01):
            with patch("numio.core.cost_explorer_service.PACING_DELAY", 0):
                result = await _call_with_retry(mock_func)

        assert result == {"data": "ok"}
        assert mock_func.call_count == 2

    async def test_max_retries_exceeded_raises(self):
        from botocore.exceptions import ClientError

        throttle_error = ClientError(
            {
                "Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"},
                "ResponseMetadata": {"HTTPStatusCode": 429},
            },
            "GetCostAndUsage",
        )
        mock_func = MagicMock(side_effect=throttle_error)

        with patch("numio.core.cost_explorer_service.BASE_DELAY", 0.01):
            with patch("numio.core.cost_explorer_service.MAX_RETRIES", 2):
                with patch("numio.core.cost_explorer_service.PACING_DELAY", 0):
                    with pytest.raises(CostExplorerError) as exc_info:
                        await _call_with_retry(mock_func)

        assert exc_info.value.status_code == 429
        assert mock_func.call_count == 3  # initial + 2 retries

    async def test_access_denied_no_retry(self):
        from botocore.exceptions import ClientError

        access_error = ClientError(
            {
                "Error": {"Code": "AccessDeniedException", "Message": "Denied"},
                "ResponseMetadata": {"HTTPStatusCode": 403},
            },
            "GetCostAndUsage",
        )
        mock_func = MagicMock(side_effect=access_error)

        with pytest.raises(CostExplorerError) as exc_info:
            await _call_with_retry(mock_func)

        assert exc_info.value.status_code == 403
        assert mock_func.call_count == 1  # no retry for access denied


# ---------------------------------------------------------------------------
# Cache tests
# ---------------------------------------------------------------------------


class TestCache:
    def setup_method(self):
        cache.reset()

    def test_make_cache_key_deterministic(self):
        key1 = cache.make_cache_key("ws1", "acct1", "cost-by-service", {"a": "1", "b": "2"})
        key2 = cache.make_cache_key("ws1", "acct1", "cost-by-service", {"b": "2", "a": "1"})
        assert key1 == key2  # order-independent

    def test_make_cache_key_different_params(self):
        key1 = cache.make_cache_key("ws1", "acct1", "cost-by-service", {"a": "1"})
        key2 = cache.make_cache_key("ws1", "acct1", "cost-by-service", {"a": "2"})
        assert key1 != key2

    def test_cache_get_returns_none_when_disabled(self):
        # With empty valkey_url (default), cache should return None
        result = cache.cache_get("some_key")
        assert result is None

    def test_cache_set_noop_when_disabled(self):
        # Should not raise even though ValKey is not running
        cache.cache_set("some_key", {"data": "test"})


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


class TestCostExplorerAPI:
    @pytest.fixture
    async def client(self, db_session, account_in_db):
        """Create a test client with DB session override."""
        from numio.db.session import get_session
        from numio.main import app

        async def _override_session():
            yield db_session

        app.dependency_overrides[get_session] = _override_session
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    async def test_cost_by_service_endpoint(self, mock_ce, client):
        mock_ce.return_value = [
            {
                "start": "2025-11-01",
                "end": "2025-11-02",
                "service": "AmazonEC2",
                "amount": "120.50",
                "currency": "USD",
            },
        ]
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["account_id"] == "111111111111"
        assert len(data["data"]) == 1
        assert data["data"][0]["service"] == "AmazonEC2"
        assert data["data"][0]["amount"] == "120.50"
        mock_ce.assert_called_once()

    @patch("numio.api.cost_explorer.get_cost_by_region")
    async def test_cost_by_region_endpoint(self, mock_ce, client):
        mock_ce.return_value = [
            {
                "start": "2025-11-01",
                "end": "2025-11-02",
                "region": "us-east-1",
                "amount": "80.00",
                "currency": "USD",
            },
        ]
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-region",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"][0]["region"] == "us-east-1"

    @patch("numio.api.cost_explorer.ce_get_cost_by_tag")
    async def test_cost_by_tag_endpoint(self, mock_ce, client):
        mock_ce.return_value = [
            {
                "start": "2025-11-01",
                "end": "2025-11-02",
                "tag_value": "production",
                "amount": "90.00",
                "currency": "USD",
            },
        ]
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-tag",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
                "tag_key": "Environment",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tag_key"] == "Environment"
        assert data["data"][0]["tag_value"] == "production"

    @patch("numio.api.cost_explorer.ce_get_tags")
    async def test_tags_endpoint(self, mock_ce, client):
        mock_ce.return_value = ["Environment", "Team", "Project"]
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/tags",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tags"] == ["Environment", "Team", "Project"]

    @patch("numio.api.cost_explorer.ce_get_total_cost")
    async def test_total_cost_endpoint(self, mock_ce, client):
        mock_ce.return_value = [
            {"start": "2025-11-01", "end": "2025-11-02", "amount": "125.75", "currency": "USD"},
        ]
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/total",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"][0]["amount"] == "125.75"

    async def test_unknown_account_returns_404(self, client):
        cache.reset()
        resp = await client.get(
            "/api/v1/cost-explorer/total",
            params={
                "account_id": "999999999999",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 404

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    async def test_assume_role_failure_returns_502(self, mock_ce, client):
        mock_ce.side_effect = CostExplorerError("AssumeRole failed", status_code=502)
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 502

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    async def test_access_denied_returns_403(self, mock_ce, client):
        mock_ce.side_effect = CostExplorerError("Access denied", status_code=403)
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 403

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    async def test_throttling_returns_429(self, mock_ce, client):
        mock_ce.side_effect = CostExplorerError("Rate limit", status_code=429)
        cache.reset()

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 429

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    @patch("numio.api.cost_explorer.cache")
    async def test_cache_hit_skips_aws_call(self, mock_cache, mock_ce, client):
        cached_response = {
            "account_id": "111111111111",
            "start_date": "2025-11-01",
            "end_date": "2025-12-01",
            "granularity": "DAILY",
            "data": [
                {
                    "start": "2025-11-01",
                    "end": "2025-11-02",
                    "service": "cached",
                    "amount": "1.00",
                    "currency": "USD",
                },
            ],
        }
        mock_cache.cache_get.return_value = cached_response
        mock_cache.make_cache_key.return_value = "test_key"

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"][0]["service"] == "cached"
        mock_ce.assert_not_called()  # AWS was NOT called

    @patch("numio.api.cost_explorer.ce_get_cost_by_service")
    @patch("numio.api.cost_explorer.cache")
    async def test_cache_miss_calls_aws_and_stores(self, mock_cache, mock_ce, client):
        mock_cache.cache_get.return_value = None
        mock_cache.make_cache_key.return_value = "test_key"
        mock_ce.return_value = [
            {
                "start": "2025-11-01",
                "end": "2025-11-02",
                "service": "AmazonEC2",
                "amount": "50.00",
                "currency": "USD",
            },
        ]

        resp = await client.get(
            "/api/v1/cost-explorer/cost-by-service",
            params={
                "account_id": "111111111111",
                "start_date": "2025-11-01",
                "end_date": "2025-12-01",
            },
        )
        assert resp.status_code == 200
        mock_ce.assert_called_once()
        mock_cache.cache_set.assert_called_once()


# ---------------------------------------------------------------------------
# Cost records table schema test
# ---------------------------------------------------------------------------


class TestCostRecordsSchema:
    async def test_cost_records_table_exists(self, db_session):
        """Verify the cost_records table was created by the migration."""
        from sqlalchemy import text

        result = await db_session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'cost_records' ORDER BY ordinal_position"
            )
        )
        columns = [row[0] for row in result.fetchall()]

        # Verify key columns exist
        expected = [
            "id",
            "workspace_id",
            "provider",
            "data_source",
            "tenant",
            "api_key",
            "line_item_id",
            "billing_period",
            "payer_account_id",
            "usage_account_id",
            "usage_start",
            "usage_end",
            "service",
            "region",
            "availability_zone",
            "resource_id",
            "instance_type",
            "usage_type",
            "operation",
            "line_item_type",
            "unblended_cost",
            "blended_cost",
            "net_unblended_cost",
            "usage_amount",
            "currency",
            "tags",
            "cost_category",
            "product_details",
            "pricing",
            "reservation",
            "savings_plan",
            "discount",
            "bill_details",
            "created_at",
            "updated_at",
        ]
        for col in expected:
            assert col in columns, f"Column {col} missing from cost_records"

    async def test_unique_constraint_exists(self, db_session):
        """Verify the unique constraint on (data_source, line_item_id)."""
        from sqlalchemy import text

        result = await db_session.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename = 'cost_records' "
                "AND indexname = 'uq_cost_records_source_line_item'"
            )
        )
        row = result.fetchone()
        assert row is not None, "Unique index uq_cost_records_source_line_item missing"

    async def test_gin_index_on_tags(self, db_session):
        """Verify the GIN index on tags JSONB column."""
        from sqlalchemy import text

        result = await db_session.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename = 'cost_records' AND indexname = 'ix_cost_records_tags'"
            )
        )
        row = result.fetchone()
        assert row is not None, "GIN index ix_cost_records_tags missing"
