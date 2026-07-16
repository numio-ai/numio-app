---
status: done
phase: 2
task_id: P2.3
---

# Cost Explorer Pass-Through API & Cost Data Model

## Problem Statement

Numio needs to provide immediate cost visibility from day one of customer onboarding — before CUR export is configured. The Cost Explorer API provides daily cost summaries without any customer-side S3 setup. However, CE returns aggregated data (daily, per-service), not line items — it cannot be combined with CUR data in the same table. CE is therefore served as a pass-through API: the backend proxies requests to AWS CE and returns results directly to the frontend, with no persistence.

This task also defines the common cost data model (`cost_records` table) that CUR ingestion (P2.4) will populate. The schema is designed here; P2.4 writes to it.

## Design Document

See [docs/arb/cost-data-model-and-ingestion.md](../../docs/arb/cost-data-model-and-ingestion.md) for the full design, including data model rationale, schema details, and CE pass-through architecture.

## Scope

**In scope:**

- **Cost data model**: Define and create the `cost_records` table (Alembic migration). Wide table with JSONB overflow — first-class columns for frequently queried dimensions (service, region, account, instance_type, etc.), JSONB columns for dynamic data (tags, pricing, reservation, savings_plan, etc.). Adopted from AWS CUR structure with Numio additions (provider, tenant, api_key, workspace_id). This table stores CUR data only — no CE data is persisted.
- **CE pass-through API**: REST endpoints that proxy requests to the AWS Cost Explorer API and return results to the frontend. No data is written to the database.
  - `GET /api/v1/cost-explorer/cost-by-service` — cost breakdown by service
  - `GET /api/v1/cost-explorer/cost-by-region` — cost breakdown by region
  - `GET /api/v1/cost-explorer/cost-by-tag` — cost breakdown by a specific tag key
  - `GET /api/v1/cost-explorer/tags` — list available tag keys for an account
  - `GET /api/v1/cost-explorer/total` — total cost time series
- **ValKey cache layer**: Cache CE API responses to reduce API calls and rate limit pressure. TTL-based expiry. ValKey is optional — if not configured, CE pass-through works without caching.
- **Rate limiting**: Exponential backoff with jitter on CE API throttling (5 req/s per payer account). Proactive pacing (200ms between calls).
- **Credential handling**: STS AssumeRole per account (reusing P2.1 patterns)

**Out of scope:**

- CUR ingestion (P2.4 — writes to the `cost_records` table defined here)
- Resource-level cost attribution (requires CUR data)
- Cost views API for querying `cost_records` (Phase 3)
- Frontend cost dashboards (Phase 3)
- Cross-currency normalization

## Constraints

- Cost Explorer data lags 24-48 hours (AWS limitation)
- CE API rate limit: 5 requests/second per payer account, shared across all linked accounts
- `GetCostAndUsage` supports at most 2 `GroupBy` dimensions per request
- CE provides daily granularity only — no hourly drill-down
- CE does not return resource IDs — features like zombie hunter and right-sizing are unavailable in CE mode
- Cost data source (CE pass-through vs CUR) is configured at Numio setup time and is immutable until reset and backfill

## Acceptance Criteria

### Cost data model
1. `cost_records` table created via Alembic migration with all first-class columns and JSONB overflow columns as specified in the design document
2. Unique constraint on `(data_source, line_item_id)` enables upsert for CUR ingestion
3. GIN index on `tags` JSONB column for tag-based queries
4. Schema supports multi-provider extensibility (provider, tenant, api_key columns)

### CE pass-through API
5. Each CE endpoint assumes role into the target account and returns CE API results
6. Requests include proper error handling: 502 for AssumeRole failure, 429 for throttling after retries, 403 for access denied
7. API responses are normalized into a consistent JSON format (not raw AWS SDK responses)
8. Pagination is handled transparently — the client receives complete results

### ValKey cache
9. CE API responses are cached in ValKey with TTL-based expiry
10. Cache is optional — backend starts and serves CE requests without ValKey configured
11. Repeated identical requests within the TTL window return cached results without calling AWS

### Rate limiting
12. Exponential backoff with jitter handles ThrottlingException gracefully
13. No unhandled 429 errors propagated to the frontend

## Quality Gates

### Automated checks

- Tests verify CE pass-through endpoints return correct response format (with mocked AWS calls)
- Tests verify caching: second call returns cached result, no AWS API call made
- Tests verify cache bypass when ValKey is unavailable
- Tests verify rate limit retry logic
- Tests verify error handling for AssumeRole failure, CE access denied, throttling
- Migration creates `cost_records` table with correct columns, indexes, and constraints
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`

### Functional validation (requires running backend + PostgreSQL)

Prerequisites: `docker compose up postgres -d && cd backend && uv run alembic upgrade head`

1. Start backend: `cd backend && uv run uvicorn numio.main:app --port 8000`
2. **Verify migration** — confirm `cost_records` table exists:
   ```
   docker exec numio-postgres psql -U numio -c "\d cost_records"
   ```
   Expected: table with all first-class columns, JSONB columns, and indexes
3. **Register a test account** using the accounts API (P2.1):
   ```
   curl -s -X POST http://localhost:8000/api/v1/accounts \
     -H "Content-Type: application/json" \
     -d '{"aws_account_id":"111111111111","alias":"test-dev","role_arn":"arn:aws:iam::111111111111:role/NumioAccess","environment_label":"dev"}' | python3 -m json.tool
   ```
4. **Query cost by service** via CE pass-through:
   ```
   curl -s 'http://localhost:8000/api/v1/cost-explorer/cost-by-service?account_id=111111111111&start_date=2025-10-01&end_date=2025-11-01&granularity=MONTHLY' | python3 -m json.tool
   ```
   Expected: JSON with time series of cost per service
5. **Query available tags**:
   ```
   curl -s 'http://localhost:8000/api/v1/cost-explorer/tags?account_id=111111111111&start_date=2025-10-01&end_date=2025-11-01' | python3 -m json.tool
   ```
   Expected: list of tag keys
6. **Verify caching** (requires ValKey running) — make the same request twice, second should be faster:
   ```
   time curl -s 'http://localhost:8000/api/v1/cost-explorer/total?account_id=111111111111&start_date=2025-10-01&end_date=2025-11-01' > /dev/null
   time curl -s 'http://localhost:8000/api/v1/cost-explorer/total?account_id=111111111111&start_date=2025-10-01&end_date=2025-11-01' > /dev/null
   ```
   Expected: second request significantly faster (cache hit)
7. **Verify `cost_records` table is empty** — CE does not write to it:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT count(*) FROM cost_records;"
   ```
   Expected: 0 rows
