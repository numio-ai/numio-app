"""Integration tests for CUR Parquet ingestion.

Uses in-memory Parquet data (generated from real CUR schema) and mocked S3 clients.
Requires a real PostgreSQL test database — runs against numio_test.
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pyarrow as pa  # noqa: F401
import pyarrow.parquet as pq
import pytest

from numio.core.cur_service import (
    _build_records,
    _ingest_parquet_file,
    _list_latest_manifests,
    _map_to_dict,
    _parse_s3_url,
)
from numio.models.aws_account import AwsAccount
from numio.models.cost_record import CostRecord

# ---------------------------------------------------------------------------
# Helpers to build in-memory CUR Parquet data
# ---------------------------------------------------------------------------


def _make_cur_parquet(rows: list[dict]) -> bytes:
    """Create an in-memory Parquet file from a list of CUR row dicts.

    Returns the raw bytes of the Parquet file.
    """
    if not rows:
        rows = [_sample_cur_row()]

    # Build a PyArrow table from the rows
    col_names = list(rows[0].keys())
    col_data = {name: [r.get(name) for r in rows] for name in col_names}

    # Represent MAP columns as list<struct<key, value>> (PyArrow map type)
    # For simplicity in tests we use plain Python lists of tuples cast to object arrays
    arrays = {}
    for name, values in col_data.items():
        arrays[name] = pa.array(values)

    table = pa.table(arrays)
    buf = io.BytesIO()
    pq.write_table(table, buf)
    buf.seek(0)
    return buf.read()


def _sample_cur_row(
    line_item_id: str = "abc123lineitemid",
    usage_account_id: str = "123456789012",
    service: str = "AmazonEC2",
    region: str = "us-east-1",
    unblended_cost: float = 12.50,
    resource_id: str | None = "i-0abc123456",
    instance_type: str | None = "m5.xlarge",
    tags: list | None = None,
) -> dict:
    """Return a minimal CUR row dict with first-class columns populated."""
    return {
        "identity_line_item_id": line_item_id,
        "bill_billing_period_start_date": datetime(2025, 11, 1, tzinfo=timezone.utc),
        "bill_billing_period_end_date": datetime(2025, 12, 1, tzinfo=timezone.utc),
        "bill_payer_account_id": "123456789012",
        "bill_bill_type": "Anniversary",
        "bill_billing_entity": "AWS",
        "bill_invoicing_entity": "Amazon Web Services, Inc.",
        "bill_invoice_id": None,
        "line_item_usage_account_id": usage_account_id,
        "line_item_usage_start_date": datetime(2025, 11, 15, 0, tzinfo=timezone.utc),
        "line_item_usage_end_date": datetime(2025, 11, 15, 1, tzinfo=timezone.utc),
        "line_item_product_code": service,
        "line_item_availability_zone": "us-east-1a",
        "line_item_resource_id": resource_id,
        "line_item_usage_type": "BoxUsage:m5.xlarge",
        "line_item_operation": "RunInstances",
        "line_item_line_item_type": "Usage",
        "line_item_unblended_cost": unblended_cost,
        "line_item_blended_cost": unblended_cost,
        "line_item_net_unblended_cost": None,
        "line_item_usage_amount": 1.0,
        "line_item_currency_code": "USD",
        "product_region_code": region,
        "product_instance_type": instance_type,
        "product_product_family": "Compute Instance",
        "resource_tags": tags or [],
        "cost_category": [],
        "product": [],
        "pricing_currency": "USD",
        "pricing_public_on_demand_cost": unblended_cost,
        "reservation_effective_cost": 0.0,
        "savings_plan_savings_plan_effective_cost": None,
        "discount": [],
        "discount_bundled_discount": None,
    }


# ---------------------------------------------------------------------------
# Unit tests: column mapping helpers
# ---------------------------------------------------------------------------


class TestMapToDict:
    def test_empty_map(self):
        assert _map_to_dict([]) == {}

    def test_none_value(self):
        assert _map_to_dict(None) == {}

    def test_single_entry(self):
        assert _map_to_dict([("Team", "platform")]) == {"Team": "platform"}

    def test_multiple_entries(self):
        result = _map_to_dict([("Env", "prod"), ("Team", "data")])
        assert result == {"Env": "prod", "Team": "data"}


class TestParseS3Url:
    def test_standard_url(self):
        bucket, key = _parse_s3_url("s3://my-bucket/path/to/file.parquet")
        assert bucket == "my-bucket"
        assert key == "path/to/file.parquet"

    def test_nested_key(self):
        bucket, key = _parse_s3_url("s3://example-cur-bucket/cur/export/data/file.snappy.parquet")
        assert bucket == "example-cur-bucket"
        assert key == "cur/export/data/file.snappy.parquet"


# ---------------------------------------------------------------------------
# Unit tests: _build_records column mapping
# ---------------------------------------------------------------------------


class TestBuildRecords:
    def test_first_class_columns_mapped(self):
        row = _sample_cur_row()
        col_dict = {k: [v] for k, v in row.items()}
        records = _build_records(col_dict, workspace_id="default")

        assert len(records) == 1
        r = records[0]
        assert r["provider"] == "aws"
        assert r["data_source"] == "cur"
        assert r["line_item_id"] == "abc123lineitemid"
        assert r["usage_account_id"] == "123456789012"
        assert r["payer_account_id"] == "123456789012"
        assert r["service"] == "AmazonEC2"
        assert r["region"] == "us-east-1"
        assert r["resource_id"] == "i-0abc123456"
        assert r["instance_type"] == "m5.xlarge"
        assert r["line_item_type"] == "Usage"
        assert r["currency"] == "USD"
        assert r["unblended_cost"] == Decimal("12.5")
        assert r["blended_cost"] == Decimal("12.5")
        assert r["net_unblended_cost"] is None

    def test_billing_period_extracted_as_date(self):
        row = _sample_cur_row()
        col_dict = {k: [v] for k, v in row.items()}
        records = _build_records(col_dict, workspace_id="default")
        from datetime import date

        assert records[0]["billing_period"] == date(2025, 11, 1)

    def test_tags_populated_from_resource_tags_map(self):
        row = _sample_cur_row(tags=[("Team", "platform"), ("Env", "prod")])
        col_dict = {k: [v] for k, v in row.items()}
        records = _build_records(col_dict, workspace_id="default")

        assert records[0]["tags"] == {"Team": "platform", "Env": "prod"}

    def test_empty_tags_stored_as_none(self):
        row = _sample_cur_row(tags=[])
        col_dict = {k: [v] for k, v in row.items()}
        records = _build_records(col_dict, workspace_id="default")

        assert records[0]["tags"] is None

    def test_row_without_line_item_id_skipped(self):
        row = _sample_cur_row()
        row["identity_line_item_id"] = None
        col_dict = {k: [v] for k, v in row.items()}
        records = _build_records(col_dict, workspace_id="default")
        assert records == []

    def test_multi_account_attribution(self):
        """Each row is attributed to the correct usage_account_id."""
        rows = [
            _sample_cur_row(line_item_id="id-1", usage_account_id="111111111111"),
            _sample_cur_row(line_item_id="id-2", usage_account_id="222222222222"),
        ]
        col_dict = {k: [r[k] for r in rows] for k in rows[0]}
        records = _build_records(col_dict, workspace_id="default")

        assert len(records) == 2
        account_ids = {r["usage_account_id"] for r in records}
        assert account_ids == {"111111111111", "222222222222"}


# ---------------------------------------------------------------------------
# Unit tests: manifest discovery
# ---------------------------------------------------------------------------


class TestListLatestManifests:
    def _make_s3_mock(self, objects: list[dict]):
        """Build a mocked boto3 S3 client with list_objects_v2 paginator."""
        s3 = MagicMock()
        paginator = MagicMock()
        s3.get_paginator.return_value = paginator
        paginator.paginate.return_value = [{"Contents": objects}]
        return s3

    def test_returns_latest_manifest_per_billing_period(self):
        older = datetime(2025, 11, 23, 5, tzinfo=timezone.utc)
        newer = datetime(2025, 11, 24, 13, tzinfo=timezone.utc)
        objects = [
            {
                "Key": (
                    "cur/export/metadata/BILLING_PERIOD=2025-11"
                    "/2025-11-23T05-uuid/report-Manifest.json"
                ),
                "LastModified": older,
            },
            {
                "Key": (
                    "cur/export/metadata/BILLING_PERIOD=2025-11"
                    "/2025-11-24T13-uuid/report-Manifest.json"
                ),
                "LastModified": newer,
            },
        ]
        s3 = self._make_s3_mock(objects)
        results = _list_latest_manifests(s3, "bucket", "cur/export", "report")

        assert len(results) == 1
        bp, key, lm = results[0]
        assert bp == "2025-11"
        assert "2025-11-24T13" in key
        assert lm == newer

    def test_multiple_billing_periods(self):
        objects = [
            {
                "Key": "cur/export/metadata/BILLING_PERIOD=2025-11/ts-uuid/report-Manifest.json",
                "LastModified": datetime(2025, 11, 30, tzinfo=timezone.utc),
            },
            {
                "Key": "cur/export/metadata/BILLING_PERIOD=2025-12/ts-uuid/report-Manifest.json",
                "LastModified": datetime(2025, 12, 15, tzinfo=timezone.utc),
            },
        ]
        s3 = self._make_s3_mock(objects)
        results = _list_latest_manifests(s3, "bucket", "cur/export", "report")

        assert len(results) == 2
        billing_periods = [r[0] for r in results]
        assert "2025-11" in billing_periods
        assert "2025-12" in billing_periods

    def test_skips_non_manifest_keys(self):
        objects = [
            {
                "Key": "cur/export/metadata/BILLING_PERIOD=2025-11/ts-uuid/report-Manifest.json",
                "LastModified": datetime(2025, 11, 30, tzinfo=timezone.utc),
            },
            {
                "Key": "cur/export/metadata/BILLING_PERIOD=2025-11/ts-uuid/some-other-file.json",
                "LastModified": datetime(2025, 11, 30, tzinfo=timezone.utc),
            },
        ]
        s3 = self._make_s3_mock(objects)
        results = _list_latest_manifests(s3, "bucket", "cur/export", "report")
        assert len(results) == 1


# ---------------------------------------------------------------------------
# Integration tests: upsert into real test DB
# ---------------------------------------------------------------------------


@pytest.fixture
async def account_with_cur(db_session, default_workspace_id):
    """Create a test AWS account with CUR configuration."""
    account = AwsAccount(
        id=uuid.uuid4(),
        workspace_id=default_workspace_id,
        aws_account_id="123456789012",
        alias="management",
        role_arn="arn:aws:iam::123456789012:role/NumioAccess",
        status="active",
        environment_label="production",
        cur_s3_bucket="example-cur-bucket",
        cur_s3_prefix="cur/example-cur-export",
        cur_report_name="example-cur-export",
    )
    db_session.add(account)
    await db_session.flush()
    return account


class TestIngestParquetFile:
    def _make_s3_parquet_mock(self, rows: list[dict] | None = None):
        """Build an S3 mock that returns in-memory Parquet bytes on get_object."""
        parquet_bytes = _make_cur_parquet(rows or [_sample_cur_row()])
        s3 = MagicMock()

        class _StreamBody:
            def __init__(self, data):
                self._buf = io.BytesIO(data)

            def read(self, n=-1):
                return self._buf.read(n)

        s3.get_object.return_value = {"Body": _StreamBody(parquet_bytes)}
        return s3

    @pytest.mark.asyncio
    async def test_ingests_records_into_db(self, db_session, account_with_cur):
        s3 = self._make_s3_parquet_mock([_sample_cur_row(line_item_id="unique-id-001")])
        count = await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")
        assert count == 1

        from sqlalchemy import select

        result = await db_session.execute(
            select(CostRecord).where(CostRecord.line_item_id == "unique-id-001")
        )
        record = result.scalar_one_or_none()
        assert record is not None
        assert record.service == "AmazonEC2"
        assert record.region == "us-east-1"
        assert record.unblended_cost == Decimal("12.5")

    @pytest.mark.asyncio
    async def test_upsert_does_not_create_duplicates(self, db_session, account_with_cur):
        """Re-ingesting the same line_item_id does not create a new row."""
        row = _sample_cur_row(line_item_id="dup-test-001", unblended_cost=10.0)
        s3 = self._make_s3_parquet_mock([row])

        count1 = await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")
        assert count1 == 1

        # Re-ingest with updated cost
        row["line_item_unblended_cost"] = 20.0
        row["line_item_blended_cost"] = 20.0
        s3 = self._make_s3_parquet_mock([row])
        count2 = await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")
        assert count2 == 1

        from sqlalchemy import func as sqlfunc
        from sqlalchemy import select

        total = await db_session.execute(
            select(sqlfunc.count())
            .select_from(CostRecord)
            .where(CostRecord.line_item_id == "dup-test-001")
        )
        assert total.scalar() == 1

        # Updated cost should be reflected
        from sqlalchemy import select

        result = await db_session.execute(
            select(CostRecord).where(CostRecord.line_item_id == "dup-test-001")
        )
        record = result.scalar_one()
        assert record.unblended_cost == Decimal("20.0")

    @pytest.mark.asyncio
    async def test_jsonb_columns_populated(self, db_session, account_with_cur):
        """JSONB columns are populated from MAP and prefix columns."""
        row = _sample_cur_row(
            line_item_id="jsonb-test-001",
            tags=[("Team", "platform"), ("Env", "prod")],
        )
        s3 = self._make_s3_parquet_mock([row])
        await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")

        from sqlalchemy import select

        result = await db_session.execute(
            select(CostRecord).where(CostRecord.line_item_id == "jsonb-test-001")
        )
        record = result.scalar_one()
        assert record.tags == {"Team": "platform", "Env": "prod"}
        assert record.pricing is not None
        assert "public_on_demand_cost" in record.pricing

    @pytest.mark.asyncio
    async def test_resource_level_fields(self, db_session, account_with_cur):
        """resource_id and instance_type are correctly stored."""
        row = _sample_cur_row(
            line_item_id="resource-test-001",
            resource_id="i-0abc123def456",
            instance_type="m5.2xlarge",
        )
        s3 = self._make_s3_parquet_mock([row])
        await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")

        from sqlalchemy import select

        result = await db_session.execute(
            select(CostRecord).where(CostRecord.line_item_id == "resource-test-001")
        )
        record = result.scalar_one()
        assert record.resource_id == "i-0abc123def456"
        assert record.instance_type == "m5.2xlarge"

    @pytest.mark.asyncio
    async def test_multi_account_attribution(self, db_session, account_with_cur):
        """Line items from different usage accounts are correctly attributed."""
        rows = [
            _sample_cur_row(line_item_id="ma-001", usage_account_id="111111111111"),
            _sample_cur_row(line_item_id="ma-002", usage_account_id="222222222222"),
        ]
        s3 = self._make_s3_parquet_mock(rows)
        count = await _ingest_parquet_file(s3, "bucket", "key.parquet", db_session, "default")
        assert count == 2

        from sqlalchemy import select

        result = await db_session.execute(
            select(CostRecord).where(CostRecord.line_item_id.in_(["ma-001", "ma-002"]))
        )
        records = result.scalars().all()
        account_ids = {r.usage_account_id for r in records}
        assert account_ids == {"111111111111", "222222222222"}


# ---------------------------------------------------------------------------
# Integration test: incremental sync
# ---------------------------------------------------------------------------


class TestIncrementalSync:
    def _make_s3_mock_with_manifest(self, manifest_last_modified: datetime, parquet_rows=None):
        """S3 mock that returns one manifest pointing to one Parquet file."""
        rows = parquet_rows or [_sample_cur_row(line_item_id="incr-001")]
        parquet_bytes = _make_cur_parquet(rows)
        manifest = {
            "executionId": "test-exec-id",
            "dataFiles": ["s3://test-bucket/data/file.parquet"],
        }

        class _StreamBody:
            def __init__(self, data: bytes):
                self._buf = io.BytesIO(data)

            def read(self, n=-1):
                return self._buf.read(n)

        s3 = MagicMock()
        paginator = MagicMock()
        s3.get_paginator.return_value = paginator
        paginator.paginate.return_value = [
            {
                "Contents": [
                    {
                        "Key": (
                            "cur/export/metadata/BILLING_PERIOD=2025-11"
                            "/ts-uuid/example-cur-export-Manifest.json"
                        ),
                        "LastModified": manifest_last_modified,
                    }
                ]
            }
        ]
        s3.get_object.side_effect = lambda Bucket, Key: {
            "Body": _StreamBody(
                json.dumps(manifest).encode() if Key.endswith("Manifest.json") else parquet_bytes
            )
        }
        return s3

    @pytest.mark.asyncio
    async def test_unchanged_manifest_skipped(self, db_session, account_with_cur):
        """Billing period whose manifest predates last_sync_at is skipped."""
        from numio.core.cur_service import _run_cur_ingestion
        from numio.models.job import IngestionStatus

        # Simulate a previous sync at 2025-12-01
        last_sync = datetime(2025, 12, 1, tzinfo=timezone.utc)
        status = IngestionStatus(
            id=uuid.uuid4(),
            workspace_id="default",
            account_id="123456789012",
            data_source="cur_ingestion",
            last_sync_at=last_sync,
            last_status="success",
            record_count=10,
            updated_at=last_sync,
        )
        db_session.add(status)
        await db_session.flush()

        # Manifest is older than last sync
        old_manifest_time = datetime(2025, 11, 30, tzinfo=timezone.utc)
        s3 = self._make_s3_mock_with_manifest(old_manifest_time)

        with (
            patch("numio.core.cur_service.assume_role_for_account") as mock_sts,
            patch("numio.core.cur_service.get_boto_session") as mock_session,
        ):
            mock_sts.return_value = (
                True,
                None,
                {"AccessKeyId": "x", "SecretAccessKey": "y", "SessionToken": "z"},
            )
            mock_boto = MagicMock()
            mock_boto.client.return_value = s3
            mock_session.return_value = mock_boto

            count = await _run_cur_ingestion("123456789012", db_session)

        # No records ingested because manifest is stale
        assert count == 0
        s3.get_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_updated_manifest_triggers_reingest(self, db_session, account_with_cur):
        """Billing period with a manifest newer than last_sync_at is re-ingested."""
        from numio.core.cur_service import _run_cur_ingestion
        from numio.models.job import IngestionStatus

        last_sync = datetime(2025, 11, 20, tzinfo=timezone.utc)
        status = IngestionStatus(
            id=uuid.uuid4(),
            workspace_id="default",
            account_id="123456789012",
            data_source="cur_ingestion",
            last_sync_at=last_sync,
            last_status="success",
            record_count=0,
            updated_at=last_sync,
        )
        db_session.add(status)
        await db_session.flush()

        # Manifest is newer than last sync
        new_manifest_time = datetime(2025, 11, 25, tzinfo=timezone.utc)
        s3 = self._make_s3_mock_with_manifest(new_manifest_time)

        with (
            patch("numio.core.cur_service.assume_role_for_account") as mock_sts,
            patch("numio.core.cur_service.get_boto_session") as mock_session,
        ):
            mock_sts.return_value = (
                True,
                None,
                {"AccessKeyId": "x", "SecretAccessKey": "y", "SessionToken": "z"},
            )
            mock_boto = MagicMock()
            mock_boto.client.return_value = s3
            mock_session.return_value = mock_boto

            count = await _run_cur_ingestion("123456789012", db_session)

        assert count == 1

    @pytest.mark.asyncio
    async def test_first_run_ingests_all(self, db_session, account_with_cur):
        """First run (no IngestionStatus) ingests all available billing periods."""
        from numio.core.cur_service import _run_cur_ingestion

        manifest_time = datetime(2025, 11, 25, tzinfo=timezone.utc)
        s3 = self._make_s3_mock_with_manifest(manifest_time)

        with (
            patch("numio.core.cur_service.assume_role_for_account") as mock_sts,
            patch("numio.core.cur_service.get_boto_session") as mock_session,
        ):
            mock_sts.return_value = (
                True,
                None,
                {"AccessKeyId": "x", "SecretAccessKey": "y", "SessionToken": "z"},
            )
            mock_boto = MagicMock()
            mock_boto.client.return_value = s3
            mock_session.return_value = mock_boto

            count = await _run_cur_ingestion("123456789012", db_session)

        assert count == 1


# ---------------------------------------------------------------------------
# Integration test: per-account failure isolation
# ---------------------------------------------------------------------------


class TestFailureIsolation:
    @pytest.mark.asyncio
    async def test_sts_failure_raises(self, db_session, account_with_cur):
        """STS failure raises RuntimeError for per-account isolation."""
        from numio.core.cur_service import _run_cur_ingestion

        with patch("numio.core.cur_service.assume_role_for_account") as mock_sts:
            mock_sts.return_value = (False, "Access denied", None)
            with pytest.raises(RuntimeError, match="STS AssumeRole failed"):
                await _run_cur_ingestion("123456789012", db_session)

    @pytest.mark.asyncio
    async def test_unconfigured_account_returns_zero(self, db_session, default_workspace_id):
        """Account without CUR configuration returns 0 without error."""
        account = AwsAccount(
            id=uuid.uuid4(),
            workspace_id=default_workspace_id,
            aws_account_id="999999999999",
            alias="no-cur",
            role_arn="arn:aws:iam::999999999999:role/NumioAccess",
            status="active",
            environment_label="dev",
            cur_s3_bucket=None,
            cur_s3_prefix=None,
            cur_report_name=None,
        )
        db_session.add(account)
        await db_session.flush()

        from numio.core.cur_service import _run_cur_ingestion

        count = await _run_cur_ingestion("999999999999", db_session)
        assert count == 0
