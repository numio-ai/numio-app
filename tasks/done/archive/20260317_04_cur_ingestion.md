---
status: done
phase: 2
task_id: P2.4
---

# CUR (Cost & Usage Report) Ingestion

## Problem Statement

CUR is Numio's primary and only persistent cost data source. It provides resource-level, hourly line items with full dimension coverage — essential for cost attribution, anomaly detection, zombie hunter, right-sizing, and tag compliance. Unlike Cost Explorer (which serves as a pass-through API for quick visibility in P2.3), CUR data is ingested into the `cost_records` table for ad-hoc querying across multiple dimensions.

CUR requires the customer to configure S3 export in their AWS account. The `cost_records` schema is defined and created by P2.3; this task populates it.

## Design Document

See [docs/arb/cost-data-model-and-ingestion.md](../../docs/arb/cost-data-model-and-ingestion.md) — Section 3 (Cost Data Model) and Section 4 (CUR Ingestion Architecture).

## Scope

**In scope:**

- **CUR Parquet ingestion**: Read CUR Parquet files from a customer-configured S3 bucket. Parquet is the only supported format (preferred by AWS, better performance, typed columns).
- **CUR-to-schema mapping**: Map CUR's 126 columns to the `cost_records` wide table:
  - First-class columns: `service` (from `line_item_product_code`), `region` (from `product_region_code`), `resource_id`, `instance_type`, `usage_type`, `operation`, `line_item_type`, cost amounts (`unblended_cost`, `blended_cost`, `net_unblended_cost`), account IDs, timestamps
  - JSONB overflow columns: `tags` (from `resource_tags` MAP), `cost_category`, `product_details`, `pricing`, `reservation`, `savings_plan`, `discount`, `bill_details`
- **Multi-account attribution**: CUR from a consolidated billing (payer) account spans multiple linked accounts. Each line item is attributed to the correct `usage_account_id`.
- **Upsert via `line_item_id`**: CUR's `identity_line_item_id` is stored as `line_item_id`. Upsert uses the unique constraint `(data_source, line_item_id)` — re-ingesting updated CUR files does not create duplicates.
- **Incremental sync**: Check CUR manifest timestamps in S3; only re-ingest billing periods with updated manifests. First run ingests all available billing periods.
- **Stream processing**: Stream Parquet files row-group by row-group — do not load entire billing period into memory. Batch upserts (500 rows per batch).
- **CUR account configuration**: Store CUR S3 location per account (`cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name` fields on `aws_accounts` table).
- **Job framework integration**: Register as `cur_ingestion` job type in the P2.2 framework. Daily schedule. Per-account failure isolation via the job runner.
- **Credential handling**: STS AssumeRole per account to access S3 (reusing P2.1 patterns). The IAM role must have S3 read access to the CUR bucket.

**Out of scope:**

- CSV format support (Parquet only — AWS recommends Parquet, and CSV lacks typed columns)
- Cost Explorer pass-through API (P2.3)
- Cost views API endpoints for querying `cost_records` (Phase 3)
- Frontend CUR configuration UI (Phase 9)
- Setting up CUR export in the customer's AWS account (customer responsibility)
- Real-time or sub-daily CUR processing

## Constraints

- CUR files can be multi-GB for large organizations — must be stream-processed
- CUR files are delivered to S3 with a specific directory structure: `{prefix}/{report-name}/data/BILLING_PERIOD={YYYY-MM}/{timestamp}-{uuid}/{report-name}-{nnnnn}.snappy.parquet`
- Each billing period has a manifest file listing all Parquet files and content hashes
- The IAM role assumed for the account must have `s3:GetObject` and `s3:ListBucket` on the CUR bucket
- `cost_records` table schema is owned by P2.3 — this task writes to it but does not modify the schema
- Cost data source is configured at Numio setup time and is immutable until reset and backfill

## Acceptance Criteria

1. CUR ingestion reads Parquet files from the configured S3 bucket and populates `cost_records` with correct column mapping
2. Multi-account CUR (consolidated billing) correctly attributes line items to each `usage_account_id`
3. Resource-level line items include `resource_id`, `instance_type`, `operation`, and `tags` (JSONB)
4. Re-ingesting an updated CUR file upserts via `(data_source, line_item_id)` — no duplicate records
5. Incremental sync: only billing periods with updated manifests are re-processed
6. Stream processing: ingesting a large CUR file does not load the entire file into memory
7. CUR ingestion integrates with the P2.2 job framework and reports per-account status via `ingestion_statuses`
8. JSONB columns (`tags`, `reservation`, `savings_plan`, etc.) are populated from CUR MAP and scalar columns

## Quality Gates

### Automated checks

- Integration tests with sample CUR Parquet files (use the real sample at `/Users/vladimirkroz/datasets/agenture-costwatch-cur/` for test data generation)
- Test verifies CUR-to-schema mapping: all first-class columns and JSONB columns populated correctly
- Test verifies multi-account attribution from consolidated billing CUR
- Test verifies upsert: re-ingesting same CUR file does not duplicate records
- Test verifies incremental sync: unchanged billing periods are skipped
- Test verifies per-account failure isolation
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`

### Functional validation (requires running backend + PostgreSQL)

Prerequisites: `docker compose up postgres -d && cd backend && uv run alembic upgrade head`

1. Start backend: `cd backend && uv run uvicorn numio.main:app --port 8000`
2. **Register a test account** with CUR configuration:
   ```
   curl -s -X POST http://localhost:8000/api/v1/accounts \
     -H "Content-Type: application/json" \
     -d '{"aws_account_id":"123456789012","alias":"management","role_arn":"arn:aws:iam::123456789012:role/NumioAccess","environment_label":"production","cur_s3_bucket":"costwatch-cur-bucket","cur_s3_prefix":"cur/costwatch-cur-export","cur_report_name":"costwatch-cur-export"}' | python3 -m json.tool
   ```
3. **Trigger CUR ingestion**:
   ```
   curl -s -X POST http://localhost:8000/api/v1/jobs/cur_ingestion/trigger | python3 -m json.tool
   ```
   Expected: returns job_run_id with status
4. **Verify records in database**:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT service, region, line_item_type, count(*), sum(unblended_cost) FROM cost_records WHERE data_source = 'cur' GROUP BY service, region, line_item_type ORDER BY sum(unblended_cost) DESC LIMIT 20;"
   ```
   Expected: rows with correct service/region breakdown
5. **Verify JSONB columns populated**:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT resource_id, tags, product_details FROM cost_records WHERE resource_id IS NOT NULL LIMIT 5;"
   ```
   Expected: tags and product_details JSONB populated from CUR MAP columns
6. **Verify multi-account attribution**:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT usage_account_id, count(*), sum(unblended_cost) FROM cost_records GROUP BY usage_account_id;"
   ```
   Expected: multiple usage_account_ids if CUR covers consolidated billing
7. **Verify no duplicates after re-trigger**:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT count(*) FROM cost_records WHERE data_source = 'cur';"
   ```
   Trigger ingestion again, re-check. Expected: count unchanged (upsert, not insert)
