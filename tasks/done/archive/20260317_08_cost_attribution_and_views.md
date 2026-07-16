---
status: done
phase: 3
task_id: P3.3
---

# Cost Attribution and Cost Views API

## Prerequisites

- **P2.3 or P2.4 — Cost Explorer or CUR ingestion:** Provides the cost data that attribution rules operate on. CUR ingestion (P2.4) is required for resource-level attribution; Cost Explorer (P2.3) provides service/account-level aggregates only.
- **P2.2 — Background worker framework:** Provides the job scheduling infrastructure if attribution materialization is introduced post-MVP.

## Problem Statement

Raw cost data stored from ingestion (Phase 2) is not useful until it can be attributed to business dimensions — teams, projects, environments — and queried through flexible views. This task builds the attribution engine and the cost views API that all downstream consumers (dashboards, reports, anomaly detection, chat) depend on.

## Scope

**In scope:**
- **Attribution dimensions:** Support configurable dimensions: team, project, environment, application, service, account, region. Dimensions map to AWS tags or account-level metadata.
- **Attribution rules:** Define rules via REST API (CRUD endpoints) that map cost records to dimensions. Each rule has a dimension name, a source type, and a mapping configuration. Supported rule types for MVP:
  - **Tag-based:** Map a tag key to a dimension. Example: tag key `Team` → dimension `team`. The tag's value becomes the dimension value. This is the primary attribution mechanism and leverages the JSONB `tags` column on `cost_records`.
  - **Tag data source note:** Cost attribution uses tags from `cost_records.tags` (populated by CUR ingestion, P2.4, from the `resource_tags` column). These are *cost allocation tags* that must be activated separately in the AWS Billing console. They may differ from the tags visible via AWS service APIs (used by P3.1 for compliance audit via P2.5 resource inventory). A resource can have a tag applied (visible in EC2 API, P3.1 says compliant) but the tag may not appear in CUR if it hasn't been activated as a cost allocation tag (P3.3 shows `unallocated`). This discrepancy is an AWS limitation, not a Numio bug. The tag governance dashboard (P3.4) should surface both compliance status and attribution status so users can identify tags that need cost allocation activation.
  - **Account-based:** Map an account ID (or set of account IDs) to a dimension value. Example: accounts `111111111111`, `222222222222` → dimension `environment` = `production`. Useful when accounts represent environments or teams.
  - **Naming conventions are deferred to post-MVP.** MVP supports tag-based and account-based attribution only.
  - **Multi-dimension attribution:** A single cost record can be attributed to multiple dimensions simultaneously (e.g., team=platform AND environment=prod AND project=search). Each rule operates on one dimension independently. There is no cross-rule conflict — rules target different dimensions.
  - **Within a single dimension:** If multiple rules map to the same dimension (e.g., two rules both map to `team`), the rules are evaluated in priority order (each rule has an integer `priority` field). The first matching rule wins. If no rule matches, the dimension value is `unallocated`.
  - **Unallocated costs:** Cost records that have no matching rule for a given dimension are categorized as `unallocated` for that dimension. Unallocated is a per-dimension status, not a global one — a cost record can be `team=platform` but `project=unallocated`. The API supports filtering and drilling into unallocated costs to see which resources lack attribution.
  - **Retroactive attribution:** Attribution is computed at query time (not materialized), so changing rules immediately affects all historical queries. There is no separate "re-attribution" job. This is feasible for MVP because attribution is a SQL GROUP BY on indexed JSONB columns — no pre-computation needed. If query performance becomes an issue at scale, materialization can be introduced post-MVP via the worker framework (P2.2).
  - Rules are workspace-scoped and versioned with `created_at` / `updated_at` timestamps.
- **Cost views API:** REST API endpoints for:
  - Total spend (with date range filter)
  - Spend by dimension (group by team, project, service, account, region, etc.)
  - Spend over time (daily, weekly, monthly granularity)
  - All views support filtering by: date range, account, dimension values
  - All views support both consolidated (all accounts) and per-account queries
- **Trend analysis:** Calculate period-over-period changes: day-over-day, week-over-week, month-over-month. The comparison is always current period vs. immediately preceding period of the same type (e.g., this week vs. last week). Weeks follow ISO 8601 (Monday start). Partial periods (e.g., current month is half over) compare against the equivalent partial window of the prior period (e.g., first 15 days of this month vs. first 15 days of last month) to avoid misleading ratios.
  - **Significant change detection:** Identify dimensions with cost changes exceeding a configurable percentage threshold (default: 20%) AND an absolute minimum dollar threshold (default: $100). Both thresholds are API query parameters with server-side defaults. This prevents noise from low-spend dimensions with large percentage swings (e.g., $0.50 → $1.00 = 100% but irrelevant).
- **Empty/no-data behavior:** When queried for a date range with no cost data, the API returns an empty `data` array with a `metadata` object containing the requested parameters and a `total` of zero. No 404 — the query is valid, the result set is empty. Time-series endpoints return the requested time buckets with $0 values rather than omitting them, so consumers can render zero-value chart points.
- All data is workspace-scoped

**Out of scope:**
- Attribution rules based on naming conventions (deferred to post-MVP; MVP supports tag-based and account-based rules only)
- Materialized/pre-computed attribution tables (MVP uses query-time attribution; materialization can be added if performance requires it)
- Frontend dashboards (separate tasks P3.4, P3.5, P3.6)
- Report builder with save/share/schedule functionality (separate task P3.6)
- Anomaly detection (Phase 4 — consumes the cost views API)
- Budget tracking (Phase 5 — consumes the cost views API)

## Acceptance Criteria

1. Create a tag-based attribution rule mapping the `Team` tag to the `team` dimension, and verify costs are correctly grouped by team in the cost views API
2. Create an account-based attribution rule mapping specific account IDs to an `environment` dimension value, and verify costs from those accounts are correctly attributed
3. Update an attribution rule and verify that historical queries immediately reflect the change (query-time attribution)
4. Cost data is attributable by at least 3 dimensions simultaneously (team, project, environment) — a single cost record appears in all three groupings
5. Costs with no matching attribution rule for a given dimension appear as `unallocated` for that dimension with a clear dollar amount, and can be drilled into to see which resources lack attribution
6. Cost views API returns spend grouped by any supported dimension with date range filtering
7. Consolidated view aggregates costs across all registered accounts; per-account view filters correctly
8. Trend analysis correctly calculates week-over-week (ISO 8601 weeks) and month-over-month changes, comparing current vs. immediately preceding period
9. Partial-period comparison is correct: comparing the first N days of the current month against the first N days of the prior month, not the full prior month
10. Dimensions with significant cost changes are identifiable via API with configurable percentage threshold (default 20%) and absolute minimum dollar threshold (default $100)
11. Querying a date range with no cost data returns an empty `data` array with zero-value time buckets (not a 404)

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
