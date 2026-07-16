"""CUR (Cost & Usage Report) Parquet ingestion service.

Reads CUR Parquet files from S3, maps columns to the cost_records schema,
and upserts records in batches of 500.

S3 structure expected:
  {prefix}/metadata/BILLING_PERIOD={YYYY-MM}/{timestamp}-{uuid}/{report_name}-Manifest.json
  {prefix}/data/BILLING_PERIOD={YYYY-MM}/{timestamp}-{uuid}/{report_name}-{nnnnn}.snappy.parquet
"""

from __future__ import annotations

import json
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pyarrow.parquet as pq
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.aws_service import _get_session as get_boto_session
from numio.core.aws_service import assume_role_for_account
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.session import AsyncSessionLocal
from numio.models.cost_record import CostRecord
from numio.models.job import IngestionStatus
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG

logger = logging.getLogger("numio.core.cur_service")

BATCH_SIZE = 500
DATA_SOURCE = "cur"


async def _get_default_workspace_id(session: AsyncSession) -> str:
    """Look up the default workspace ID by slug."""
    from numio.models.workspace import Workspace

    result = await session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
    return str(workspace.id)


async def cur_ingestion_job(account_id: str) -> int:
    """Entry point for the job runner.

    Creates its own DB session for per-account isolation and runs the full
    CUR ingestion pipeline. Returns total records upserted.
    """
    async with AsyncSessionLocal() as session:
        return await _run_cur_ingestion(account_id, session)


# ---------------------------------------------------------------------------
# Internal pipeline
# ---------------------------------------------------------------------------


async def _run_cur_ingestion(account_id: str, session: AsyncSession) -> int:
    """Run CUR ingestion for one account."""
    workspace_id = await _get_default_workspace_id(session)
    repo = AwsAccountRepository(session, workspace_id)
    account = await repo.get_by_aws_account_id(account_id)
    if account is None:
        raise ValueError(f"Account {account_id} not found")

    if not account.cur_s3_bucket or not account.cur_s3_prefix or not account.cur_report_name:
        logger.info("Account %s: CUR not configured, skipping", account_id)
        return 0

    # Assume role into the customer account using the account's stored base
    # credentials (STS AssumeRole + ExternalId). Falling back to the host
    # credential chain would fail on laptops and on servers that aren't wired
    # to the customer's IAM service user.
    ok, error_msg, credentials = assume_role_for_account(account)
    if not ok:
        raise RuntimeError(f"STS AssumeRole failed for {account_id}: {error_msg}")

    boto_session = get_boto_session(credentials)
    s3 = boto_session.client("s3")

    # Get last sync time for incremental filtering
    last_sync_at = await _get_last_sync_at(session, account_id)

    # Discover billing periods that have new/updated manifests
    manifests = _list_latest_manifests(
        s3,
        bucket=account.cur_s3_bucket,
        prefix=account.cur_s3_prefix,
        report_name=account.cur_report_name,
    )

    total_records = 0
    for billing_period, manifest_key, manifest_last_modified in manifests:
        if last_sync_at and manifest_last_modified <= last_sync_at:
            logger.info(
                "Account %s: billing period %s manifest unchanged (last_modified=%s), skipping",
                account_id,
                billing_period,
                manifest_last_modified,
            )
            continue

        logger.info("Account %s: ingesting billing period %s", account_id, billing_period)
        manifest = _read_manifest(s3, account.cur_s3_bucket, manifest_key)

        for parquet_s3_url in manifest.get("dataFiles", []):
            file_bucket, file_key = _parse_s3_url(parquet_s3_url)
            count = await _ingest_parquet_file(
                s3=s3,
                bucket=file_bucket,
                key=file_key,
                session=session,
                workspace_id=workspace_id,
            )
            total_records += count
            logger.info(
                "Account %s: %s: upserted %d records from %s",
                account_id,
                billing_period,
                count,
                file_key,
            )

    # This job owns its own DB session (see cur_ingestion_job above). Without
    # an explicit commit the async context manager closes the session without
    # persisting the cost_records upserts — the job-runner session that records
    # ingestion_statuses commits on a different session.
    await session.commit()
    logger.info("Account %s: total records upserted: %d", account_id, total_records)
    return total_records


# ---------------------------------------------------------------------------
# S3 manifest discovery
# ---------------------------------------------------------------------------


def _list_latest_manifests(
    s3,
    bucket: str,
    prefix: str,
    report_name: str,
) -> list[tuple[str, str, datetime]]:
    """List the latest manifest for each billing period.

    Returns list of (billing_period, manifest_s3_key, last_modified).
    Only the most recent manifest per billing period is returned.

    Supports two AWS CUR layouts:
    - Legacy CUR:         {prefix}/metadata/BILLING_PERIOD=.../.../{report_name}-Manifest.json
    - Data Exports / v2:  {prefix}/{report_name}/metadata/BILLING_PERIOD=.../{report_name}-Manifest.json
    """
    base = prefix.rstrip("/")
    candidate_prefixes = [
        f"{base}/metadata/",
        f"{base}/{report_name}/metadata/",
    ]
    paginator = s3.get_paginator("list_objects_v2")

    # billing_period → (manifest_key, last_modified) — keep only the latest
    latest: dict[str, tuple[str, datetime]] = {}

    for metadata_prefix in candidate_prefixes:
        for page in paginator.paginate(Bucket=bucket, Prefix=metadata_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(f"{report_name}-Manifest.json"):
                    continue

                parts = key.split("/")
                bp_segment = next((p for p in parts if p.startswith("BILLING_PERIOD=")), None)
                if bp_segment is None:
                    continue

                billing_period = bp_segment.removeprefix("BILLING_PERIOD=")
                last_modified: datetime = obj["LastModified"]
                if isinstance(last_modified, datetime) and last_modified.tzinfo is None:
                    last_modified = last_modified.replace(tzinfo=timezone.utc)

                existing = latest.get(billing_period)
                if existing is None or last_modified > existing[1]:
                    latest[billing_period] = (key, last_modified)

    return [(bp, key, lm) for bp, (key, lm) in sorted(latest.items())]


def _read_manifest(s3, bucket: str, key: str) -> dict:
    """Download and parse a CUR manifest JSON from S3."""
    resp = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(resp["Body"].read())


def _parse_s3_url(s3_url: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    without_scheme = s3_url.removeprefix("s3://")
    bucket, _, key = without_scheme.partition("/")
    return bucket, key


# ---------------------------------------------------------------------------
# Parquet ingestion
# ---------------------------------------------------------------------------


async def _ingest_parquet_file(
    s3,
    bucket: str,
    key: str,
    session: AsyncSession,
    workspace_id: str,
) -> int:
    """Download a CUR Parquet file from S3 and upsert rows into cost_records.

    Streams the file row-group by row-group to avoid loading the full file
    into memory. Returns the number of records upserted.
    """
    # Download to a temporary file so PyArrow can seek through row groups
    with tempfile.NamedTemporaryFile(suffix=".parquet", delete=True) as tmp:
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = resp["Body"]
        # Stream in 8 MB chunks
        for chunk in iter(lambda: body.read(8 * 1024 * 1024), b""):
            tmp.write(chunk)
        tmp.flush()

        pf = pq.ParquetFile(tmp.name)
        total = 0

        for batch in pf.iter_batches(batch_size=BATCH_SIZE):
            rows = batch.to_pydict()
            records = _build_records(rows, workspace_id)
            if records:
                await _upsert_batch(session, records)
                total += len(records)

    return total


def _build_records(rows: dict, workspace_id: str) -> list[dict]:
    """Convert a PyArrow batch (column-oriented dict) to a list of row dicts for upsert."""
    n = len(next(iter(rows.values())))
    records = []

    for i in range(n):

        def col(name, default=None):
            """Get value for column at row i, returning default if column absent or None."""
            val = rows.get(name, [default] * n)[i]
            return val if val is not None else default

        # -- First-class columns --
        line_item_id = col("identity_line_item_id")
        if not line_item_id:
            continue  # skip rows without natural key

        usage_account_id = col("line_item_usage_account_id") or ""
        service = col("line_item_product_code") or ""
        line_item_type = col("line_item_line_item_type") or ""
        currency = col("line_item_currency_code") or "USD"

        # Timestamps
        usage_start = col("line_item_usage_start_date")
        usage_end = col("line_item_usage_end_date")

        # billing_period: first day of the billing month
        bp_raw = col("bill_billing_period_start_date")
        billing_period = bp_raw.date() if isinstance(bp_raw, datetime) else bp_raw

        # Cost amounts — CUR stores as float, DB wants Decimal
        def _decimal(name: str) -> Decimal | None:
            v = col(name)
            return Decimal(str(v)) if v is not None else None

        # -- JSONB columns --
        tags = _map_to_dict(col("resource_tags"))
        cost_category = _map_to_dict(col("cost_category"))
        product_details = _build_product_details(rows, i, n)
        pricing = _build_prefix_dict(rows, i, n, "pricing_")
        reservation = _build_prefix_dict(rows, i, n, "reservation_")
        savings_plan = _build_prefix_dict(rows, i, n, "savings_plan_")
        discount = _build_discount(rows, i, n)
        bill_details = _build_bill_details(rows, i, n)

        records.append(
            {
                "id": uuid.uuid4(),
                "workspace_id": workspace_id,
                "provider": "aws",
                "data_source": DATA_SOURCE,
                "line_item_id": line_item_id,
                "billing_period": billing_period,
                "payer_account_id": col("bill_payer_account_id"),
                "usage_account_id": usage_account_id,
                "usage_start": usage_start,
                "usage_end": usage_end,
                "service": service,
                "region": col("product_region_code"),
                "availability_zone": col("line_item_availability_zone"),
                "resource_id": col("line_item_resource_id"),
                "instance_type": col("product_instance_type"),
                "usage_type": col("line_item_usage_type"),
                "operation": col("line_item_operation"),
                "line_item_type": line_item_type,
                "unblended_cost": _decimal("line_item_unblended_cost") or Decimal(0),
                "blended_cost": _decimal("line_item_blended_cost"),
                "net_unblended_cost": _decimal("line_item_net_unblended_cost"),
                "usage_amount": _decimal("line_item_usage_amount"),
                "currency": currency,
                "tags": tags or None,
                "cost_category": cost_category or None,
                "product_details": product_details or None,
                "pricing": pricing or None,
                "reservation": reservation or None,
                "savings_plan": savings_plan or None,
                "discount": discount or None,
                "bill_details": bill_details or None,
            }
        )

    return records


# ---------------------------------------------------------------------------
# JSONB column builders
# ---------------------------------------------------------------------------


def _map_to_dict(value) -> dict:
    """Convert a CUR MAP column value (list of (key, value) tuples) to a plain dict."""
    if not value:
        return {}
    return {k: v for k, v in value if k is not None}


def _build_prefix_dict(rows: dict, i: int, n: int, prefix: str) -> dict:
    """Collect all columns with the given prefix into a dict (excluding empty/None values)."""
    result = {}
    for col_name, values in rows.items():
        if col_name.startswith(prefix):
            v = values[i]
            if v is not None and v != "":
                short_key = col_name[len(prefix) :]
                result[short_key] = v
    return result


def _build_product_details(rows: dict, i: int, n: int) -> dict:
    """Build product_details JSONB from product MAP + product_* scalar columns."""
    result = {}

    # Product MAP column
    product_map = rows.get("product", [None] * n)[i]
    if product_map:
        result.update(_map_to_dict(product_map))

    # product_* scalar columns (skip already-mapped first-class ones)
    first_class_product_cols = {"product_region_code", "product_instance_type"}
    for col_name, values in rows.items():
        if col_name.startswith("product_") and col_name not in first_class_product_cols:
            v = values[i]
            if v is not None and v != "":
                result[col_name[len("product_") :]] = v

    return result


def _build_discount(rows: dict, i: int, n: int) -> dict:
    """Build discount JSONB from discount MAP + discount_* columns."""
    result = _map_to_dict(rows.get("discount", [None] * n)[i])
    for col_name, values in rows.items():
        if col_name.startswith("discount_"):
            v = values[i]
            if v is not None and v != "":
                result[col_name[len("discount_") :]] = v
    return result


def _build_bill_details(rows: dict, i: int, n: int) -> dict:
    """Build bill_details JSONB from bill_* columns (excluding first-class ones)."""
    first_class_bill_cols = {"bill_billing_period_start_date", "bill_payer_account_id"}
    result = {}
    for col_name, values in rows.items():
        if col_name.startswith("bill_") and col_name not in first_class_bill_cols:
            v = values[i]
            if v is not None and v != "":
                # Convert datetime to ISO string for JSON serialisation
                if isinstance(v, datetime):
                    v = v.isoformat()
                result[col_name[len("bill_") :]] = v
    return result


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------


async def _upsert_batch(session: AsyncSession, records: list[dict]) -> None:
    """Upsert a batch of cost records using ON CONFLICT DO UPDATE.

    Deduplicates within the batch by the natural key (data_source, line_item_id)
    because a single CUR parquet can contain repeated line_item_ids (e.g.
    amortized RI / Savings Plan allocations). Postgres' ON CONFLICT DO UPDATE
    rejects a batch that tries to affect the same row twice, so we keep the
    last occurrence.
    """
    deduped: dict[tuple[str, str], dict] = {}
    for r in records:
        deduped[(r["data_source"], r["line_item_id"])] = r
    records = list(deduped.values())
    if not records:
        return

    stmt = pg_insert(CostRecord.__table__).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=["data_source", "line_item_id"],
        set_={
            "unblended_cost": stmt.excluded.unblended_cost,
            "blended_cost": stmt.excluded.blended_cost,
            "net_unblended_cost": stmt.excluded.net_unblended_cost,
            "usage_amount": stmt.excluded.usage_amount,
            "tags": stmt.excluded.tags,
            "cost_category": stmt.excluded.cost_category,
            "product_details": stmt.excluded.product_details,
            "pricing": stmt.excluded.pricing,
            "reservation": stmt.excluded.reservation,
            "savings_plan": stmt.excluded.savings_plan,
            "discount": stmt.excluded.discount,
            "bill_details": stmt.excluded.bill_details,
            "updated_at": func.now(),
        },
    )
    await session.execute(stmt)
    await session.flush()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_last_sync_at(session: AsyncSession, account_id: str) -> datetime | None:
    """Return the last successful sync timestamp for this account's CUR ingestion."""
    result = await session.execute(
        select(IngestionStatus).where(
            IngestionStatus.account_id == account_id,
            IngestionStatus.data_source == "cur_ingestion",
            IngestionStatus.last_status == "success",
        )
    )
    status = result.scalar_one_or_none()
    return status.last_sync_at if status else None
