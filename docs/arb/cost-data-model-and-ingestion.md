---
Date: 2026-03-24
Status: Draft — Pending Review
Tasks: P2.3 (Cost Explorer pass-through), P2.4 (CUR ingestion)
Scope: Cost data model + Cost Explorer pass-through API + CUR ingestion architecture
---

# Cost Data Model & Ingestion — Design Document

## 1. Problem Statement

Numio needs to provide cost visibility from day one of customer onboarding. Two AWS data sources serve different needs:

- **Cost Explorer API** — immediate, zero-setup cost summaries (service, region, tag breakdowns). No persistence needed — pass-through queries with known limitations (daily granularity, no resource-level data).
- **CUR (Cost & Usage Reports)** — the production data source. Resource-level, hourly line items ingested into Numio's database for full ad-hoc querying, attribution, anomaly detection, and optimization.

**Key decision: CUR and CE data are NOT combined in the database.** CE returns aggregates (daily, per-service), CUR returns line items (hourly, per-resource). These are fundamentally different granularities that cannot be meaningfully mixed. The `cost_records` table stores CUR data only. CE is served via pass-through API calls.

The cost data source is configured at Numio setup time and is immutable until reset and backfill.

## 2. Cost Explorer Pass-Through API (P2.3)

### 2.1 Purpose

Provide immediate cost visibility for newly onboarded accounts before CUR export is configured and ingested. The backend proxies requests to the AWS Cost Explorer API and returns results directly to the frontend.

### 2.2 Characteristics

| Aspect | Detail |
|--------|--------|
| Persistence | None — results are not stored in `cost_records` |
| Granularity | Daily |
| Dimensions | Service, region, account, tags (max 2 GroupBy per request) |
| Resource-level | No — CE does not return resource IDs |
| Data freshness | 24–48 hour lag (AWS limitation) |
| History | Up to 12 months |
| Rate limit | 5 req/s per payer account (shared across all linked accounts) |

### 2.3 API Endpoints

The backend exposes REST endpoints that translate frontend requests into CE API calls:

**`GET /api/v1/cost-explorer/cost-by-service`**
- Parameters: `account_id`, `start_date`, `end_date`, `granularity` (DAILY/MONTHLY)
- CE call: `GetCostAndUsage` with `GroupBy=[{Type: DIMENSION, Key: SERVICE}]`
- Returns: time series of cost per service

**`GET /api/v1/cost-explorer/cost-by-region`**
- Parameters: `account_id`, `start_date`, `end_date`, `granularity`
- CE call: `GetCostAndUsage` with `GroupBy=[{Type: DIMENSION, Key: REGION}]`
- Returns: time series of cost per region

**`GET /api/v1/cost-explorer/cost-by-tag`**
- Parameters: `account_id`, `start_date`, `end_date`, `tag_key`, `granularity`
- CE call: `GetCostAndUsage` with `GroupBy=[{Type: TAG, Key: <tag_key>}]`
- Returns: time series of cost per tag value

**`GET /api/v1/cost-explorer/tags`**
- Parameters: `account_id`, `start_date`, `end_date`
- CE call: `GetTags`
- Returns: list of available tag keys for the account

**`GET /api/v1/cost-explorer/total`**
- Parameters: `account_id`, `start_date`, `end_date`, `granularity`
- CE call: `GetCostAndUsage` with no GroupBy
- Returns: total cost time series

### 2.4 Backend Implementation

For each request:

1. Look up the `AwsAccount` by ID to get `role_arn`
2. `STS.AssumeRole` to get temporary credentials (reuse `aws_service._get_session` pattern)
3. Call the CE API with assumed credentials
4. Transform the CE response into a normalized JSON response
5. Return to frontend

**Rate limiting:** Exponential backoff with jitter on `ThrottlingException`:
- Base delay: 1s, max delay: 60s, max retries: 3
- 200ms proactive pacing between consecutive CE calls

**Error handling:**
- AssumeRole failure → HTTP 502 with error message
- CE throttling after retries exhausted → HTTP 429
- CE access denied → HTTP 403
- Empty data → valid empty response

### 2.5 ValKey Cache Layer

CE API responses are cached in ValKey (open-source Redis fork) to reduce API calls, avoid rate limit pressure, and improve response times. Cost data only updates every 24–48 hours, so caching is highly effective.

**Cache design:**

| Aspect | Detail |
|--------|--------|
| **Cache key** | `ce:{workspace_id}:{account_id}:{endpoint}:{params_hash}` |
| **Default TTL** | 1 hour |
| **Invalidation** | TTL-based only — no explicit invalidation needed |
| **Serialization** | JSON (CE responses are already JSON-shaped) |
| **Cache miss** | Call CE API → store result in ValKey → return |
| **Cache hit** | Return cached result directly (no AWS call) |

**Configuration (via Numio config file):**

| Setting | Default | Description |
|---------|---------|-------------|
| `VALKEY_URL` | `""` (disabled) | ValKey connection URL (e.g., `valkey://localhost:6379`) |
| `CE_CACHE_TTL_SECONDS` | `3600` | Cache TTL in seconds. Useful for development/debugging. |
| `CE_CACHE_ENABLED` | `true` | Master switch to disable caching (even if ValKey is available) |

**ValKey is optional.** If `VALKEY_URL` is not configured, the CE pass-through works without caching — every request calls the AWS CE API directly. This means ValKey is not a hard dependency for development or small deployments.

**No UI cache control.** The UI cannot bypass or control cache TTL. Cache behavior is managed exclusively through the config file, which is useful during development and debugging.

**Deployment:** ValKey is added to `docker-compose.yml` as a new service. Lightweight, no persistence needed (cache is ephemeral).

### 2.6 Limitations (Surfaced to UI)

The frontend should clearly communicate these limitations to users:

- Data delayed 24–48 hours
- Daily granularity only (no hourly drill-down)
- No resource-level breakdown
- Max 2 GroupBy dimensions per query
- Features unavailable: zombie hunter, right-sizing, tag compliance audit (require resource-level data from CUR)

## 3. Cost Data Model — `cost_records` Table (CUR Only)

### 3.1 Design Approach: Wide Table with JSONB Overflow

The data model adopts the AWS CUR structure as its foundation — a wide table with first-class columns for frequently queried dimensions and JSONB columns for dynamic/infrequently queried data.

Three options were evaluated:

| Option | Multi-dimension queries | Schema flexibility | Verdict |
|--------|------------------------|-------------------|---------|
| **Wide table** (all dims as columns) | Simple GROUP BY | ALTER TABLE for new dims | Good queries, rigid schema |
| **Long/narrow (EAV)** | Self-joins for multi-dim | Very flexible | Poor query ergonomics |
| **Wide + JSONB overflow** | Simple GROUP BY + JSONB operators | Tags: no migration; columns: migration | **Best of both** |

**Wide + JSONB** was chosen because:
- Queries like `GROUP BY service, region, tags->>'Team'` are natural SQL — no joins
- New tag keys need no schema changes
- First-class columns are indexable for fast filtering
- JSONB supports GIN indexes for efficient key/value lookups

### 3.2 JSONB and GIN Indexes

**JSONB vs plain JSON:**
- JSONB stores pre-parsed binary — parsed once at insert, fast on every read
- JSON stores raw text — re-parsed on every query
- JSONB supports indexing (GIN); JSON does not
- For write-once/query-often cost data, JSONB is the clear choice

**GIN (Generalized Inverted Index):** PostgreSQL's index type for JSONB contents. Maps keys and values inside JSONB to rows:

```sql
CREATE INDEX idx_cost_records_tags ON cost_records USING GIN (tags);

-- These queries use the index (no full table scan):
WHERE tags @> '{"Team": "platform"}'   -- contains key-value pair
WHERE tags ? 'CostCenter'              -- contains key
```

### 3.3 First-Class Columns

**Numio identity columns:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | PK | Auto-generated primary key |
| `workspace_id` | VARCHAR(255) | NOT NULL | Multi-tenancy scoping |
| `provider` | VARCHAR(50) | NOT NULL | Cloud/vendor: `aws`, `gcp`, `azure`, `anthropic`, `openai` |
| `data_source` | VARCHAR(50) | NOT NULL | Ingestion source: `cur`, `billing_api` |
| `tenant` | VARCHAR(255) | NULL | Tenant/org identifier within a provider (e.g., AWS Org ID, GCP billing account) |
| `api_key` | VARCHAR(255) | NULL | API key identifier for vendor billing (e.g., Anthropic API key ID) |
| `line_item_id` | VARCHAR(255) | NOT NULL | Natural key from source: CUR `identity_line_item_id`, or synthetic key for other sources |

**Account & time dimensions:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `billing_period` | DATE | NOT NULL | First day of billing month (e.g., `2025-11-01`) |
| `payer_account_id` | VARCHAR(50) | NULL | Payer/management account (AWS payer, GCP billing account) |
| `usage_account_id` | VARCHAR(50) | NOT NULL | Account that incurred the cost |
| `usage_start` | TIMESTAMPTZ | NOT NULL | Usage period start |
| `usage_end` | TIMESTAMPTZ | NOT NULL | Usage period end |

**Service & resource dimensions:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `service` | VARCHAR(255) | NOT NULL | Service name (e.g., `AmazonEC2`, `AmazonS3`, `claude-api`) |
| `region` | VARCHAR(100) | NULL | Cloud region (e.g., `us-east-1`). NULL for global services |
| `availability_zone` | VARCHAR(100) | NULL | AZ within region |
| `resource_id` | VARCHAR(512) | NULL | Resource identifier (ARN). NULL for non-resource line items |
| `instance_type` | VARCHAR(100) | NULL | Compute instance type (e.g., `m5.xlarge`) |
| `usage_type` | VARCHAR(255) | NULL | Usage type detail (e.g., `USW1-Fargate-GB-Hours`) |
| `operation` | VARCHAR(255) | NULL | Operation (e.g., `RunInstances`, `ListSecrets`) |
| `line_item_type` | VARCHAR(50) | NOT NULL | Record type: `Usage`, `Tax`, `Credit`, `Fee`, `Refund`, `SavingsPlanCoveredUsage` |

**Cost amounts:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `unblended_cost` | NUMERIC(20,10) | NOT NULL | Actual cost for the account |
| `blended_cost` | NUMERIC(20,10) | NULL | Organization-blended cost |
| `net_unblended_cost` | NUMERIC(20,10) | NULL | After-discount cost |
| `usage_amount` | NUMERIC(20,10) | NULL | Quantity consumed (hours, GB, requests) |
| `currency` | VARCHAR(10) | NOT NULL | Currency code (`USD`, `EUR`) |

**Timestamps:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update time |

### 3.4 JSONB Overflow Columns

| JSONB Column | Contents | Use Case |
|-------------|----------|----------|
| `tags` | Resource tags: `{"Team": "platform", "Environment": "prod"}` | Ad-hoc grouping by any tag |
| `cost_category` | AWS Cost Categories: `{"Department": "Engineering"}` | Cost allocation rules |
| `product_details` | Product metadata: `product_family`, `product_name`, `sku`, location fields | Drill-down into product specifics |
| `pricing` | Pricing info: `currency`, `term`, `rate_code`, `public_on_demand_cost` | Pricing analysis |
| `reservation` | RI details: amortized costs, effective cost, ARN, status | RI utilization analysis |
| `savings_plan` | SP details: commitment, effective cost, ARN, offering type | SP utilization analysis |
| `discount` | Discount details: bundled discount, total discount | Discount analysis |
| `bill_details` | Bill metadata: `bill_type`, `invoicing_entity`, `invoice_id` | Invoice-level queries |

### 3.5 Column Type Rationale

**NUMERIC(20,10) for cost amounts:**
- AWS CUR uses `double`, but NUMERIC avoids floating-point rounding errors on aggregation
- 10 decimal places preserves precision (CUR has amounts like `$0.000005`)
- 20 total digits supports values up to ~$10 billion per row

**VARCHAR(512) for `resource_id`:**
- AWS ARNs can be 200+ characters (e.g., `arn:aws:cloudfront::123456789012:distribution/EJLNIL3AMEEL0`)
- 512 provides headroom for non-AWS identifiers

**VARCHAR(50) for `provider`:**
- Short enum-like values: `aws`, `gcp`, `azure`, `anthropic`, `openai`
- VARCHAR (not ENUM) for extensibility without migration

### 3.6 Unique Constraint & Upsert Key

CUR provides a natural unique key: `identity_line_item_id`. This is stored in the `line_item_id` column.

**Unique constraint:** `(data_source, line_item_id)`

This enables `INSERT ... ON CONFLICT DO UPDATE` for CUR re-ingestion:

```sql
INSERT INTO cost_records (...)
VALUES (...)
ON CONFLICT (data_source, line_item_id)
DO UPDATE SET
    unblended_cost = EXCLUDED.unblended_cost,
    blended_cost = EXCLUDED.blended_cost,
    updated_at = now();
```

For future non-CUR sources (GCP, Anthropic), `line_item_id` will hold the provider's native line item identifier or a synthetic key.

### 3.7 Indexes

| Index | Columns | Type | Purpose |
|-------|---------|------|---------|
| PK | `id` | B-tree | Primary key |
| Unique | `(data_source, line_item_id)` | B-tree | Upsert deduplication |
| Workspace | `(workspace_id)` | B-tree | Workspace-scoped queries |
| Account+period | `(usage_account_id, billing_period)` | B-tree | Time-range queries per account |
| Service | `(service)` | B-tree | Service-level aggregation |
| Provider | `(provider)` | B-tree | Multi-cloud filtering |
| Tags | `(tags)` | GIN | Tag-based queries |

### 3.8 Multi-Provider Extensibility

| Provider | `tenant` | `api_key` | `service` example |
|----------|---------|-----------|-------------------|
| `aws` | AWS Org ID (optional) | NULL | `AmazonEC2` |
| `gcp` | GCP billing account ID | NULL | `Compute Engine` |
| `anthropic` | Anthropic org ID | API key ID | `claude-api` |
| `openai` | OpenAI org ID | API key ID | `gpt-4-api` |

## 4. CUR Ingestion Architecture (P2.4)

### 4.1 Integration with Job Framework

- **Job type:** `cur_ingestion`
- **Schedule:** Daily (`interval_seconds = 86400`)
- **Job function signature:** `async def cur_ingestion_job(account_id: str, session: AsyncSession) -> int`
- Per-account failure isolation via the P2.2 job runner

### 4.2 CUR Source

The customer configures an S3 export for CUR in their AWS account. Numio reads Parquet files from the configured S3 bucket/prefix.

CUR configuration per account is stored in the `aws_accounts` table (new fields: `cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name`).

### 4.3 Ingestion Flow

1. **AssumeRole** into the target account
2. **List CUR manifests** in the S3 bucket to find new/updated billing periods
3. **Download Parquet files** for each billing period
4. **Map CUR columns** to `cost_records` schema (see 4.4)
5. **Upsert** records in batches (500 rows) using `ON CONFLICT (data_source, line_item_id)`
6. **Update** `ingestion_statuses` via the job runner

### 4.4 CUR-to-Schema Mapping

| `cost_records` column | CUR source column |
|----------------------|-------------------|
| `provider` | `'aws'` (constant) |
| `data_source` | `'cur'` (constant) |
| `line_item_id` | `identity_line_item_id` |
| `billing_period` | `bill_billing_period_start_date` (truncated to date) |
| `payer_account_id` | `bill_payer_account_id` |
| `usage_account_id` | `line_item_usage_account_id` |
| `usage_start` | `line_item_usage_start_date` |
| `usage_end` | `line_item_usage_end_date` |
| `service` | `line_item_product_code` |
| `region` | `product_region_code` |
| `availability_zone` | `line_item_availability_zone` |
| `resource_id` | `line_item_resource_id` |
| `instance_type` | `product_instance_type` |
| `usage_type` | `line_item_usage_type` |
| `operation` | `line_item_operation` |
| `line_item_type` | `line_item_line_item_type` |
| `unblended_cost` | `line_item_unblended_cost` |
| `blended_cost` | `line_item_blended_cost` |
| `net_unblended_cost` | `line_item_net_unblended_cost` |
| `usage_amount` | `line_item_usage_amount` |
| `currency` | `line_item_currency_code` |
| `tags` | `resource_tags` (MAP → JSONB) |
| `cost_category` | `cost_category` (MAP → JSONB) |
| `product_details` | `product` map + `product_*` scalar columns → JSONB |
| `pricing` | `pricing_*` columns → JSONB |
| `reservation` | `reservation_*` columns → JSONB |
| `savings_plan` | `savings_plan_*` columns → JSONB |
| `discount` | `discount` map + `discount_*` columns → JSONB |
| `bill_details` | Remaining `bill_*` columns → JSONB |

### 4.5 Incremental Sync

- **First run:** Ingest all available billing periods from S3
- **Subsequent runs:** Check manifest timestamps; only re-ingest billing periods with updated manifests
- CUR manifests include a list of Parquet files and their content hash — compare against last ingestion to detect changes
- Upsert via `line_item_id` handles re-ingested records naturally

### 4.6 Rate Limiting

S3 reads are not rate-limited in the same way as CE API. The main concern is:
- Memory: stream Parquet files, don't load entire billing period into memory
- DB throughput: batch upserts (500 rows) with periodic commits

## 5. Error Handling

| Error Scenario | Handling |
|---------------|----------|
| STS AssumeRole fails | Account marked as failed, other accounts continue |
| S3 bucket access denied | Account marked as failed with error details |
| CUR manifest not found | Log warning, skip account (CUR may not be configured yet) |
| Parquet file corrupt/unreadable | Account marked as failed, log error details |
| DB upsert fails | Account marked as failed, already-upserted data retained |
| CE API throttled (pass-through) | Exponential backoff + retry, then HTTP 429 to frontend |

## 6. Observability

- Log each ingestion step: account_id, billing period, file count, record count
- Log rate limit events for CE pass-through
- Log per-account summary: total records upserted, duration, success/failure
- IngestionStatus (P2.2 framework): last_sync_at, status, record_count per account

## 7. Example Queries on `cost_records`

**Cost by service for an account:**
```sql
SELECT service, SUM(unblended_cost)
FROM cost_records
WHERE usage_account_id = '552629255862'
  AND billing_period = '2025-11-01'
  AND line_item_type = 'Usage'
GROUP BY service
ORDER BY SUM(unblended_cost) DESC;
```

**Cost by account, service, and team tag:**
```sql
SELECT usage_account_id, service, tags->>'Team' AS team, SUM(unblended_cost)
FROM cost_records
WHERE billing_period = '2025-11-01'
  AND line_item_type = 'Usage'
GROUP BY usage_account_id, service, tags->>'Team';
```

**Cost by region and environment tag:**
```sql
SELECT region, tags->>'Environment' AS env, SUM(unblended_cost)
FROM cost_records
WHERE provider = 'aws'
  AND billing_period = '2025-11-01'
GROUP BY region, tags->>'Environment';
```

**Multi-cloud total by provider:**
```sql
SELECT provider, SUM(unblended_cost)
FROM cost_records
WHERE billing_period = '2025-11-01'
GROUP BY provider;
```

**Resource-level drill-down (CUR only):**
```sql
SELECT resource_id, instance_type, SUM(unblended_cost), SUM(usage_amount)
FROM cost_records
WHERE service = 'AmazonEC2'
  AND billing_period = '2025-11-01'
  AND resource_id IS NOT NULL
GROUP BY resource_id, instance_type
ORDER BY SUM(unblended_cost) DESC
LIMIT 20;
```
