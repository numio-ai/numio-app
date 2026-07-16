---
status: backlog
kind: task
feature: ia_v2_persistence
title: Persist Usage with tag-as-dimension group-by over real cost data
---

# Persist Usage with tag-as-dimension group-by over real cost data

## Problem statement

`api/ia_v2_usage.py` returns synthetic chart series + breakdown for any combination of scope/range/group_by. Real implementation projects `cost_records` by an arbitrary tag key (read from `tags` JSONB) or platform attribute, includes an Untagged bucket, and computes the prior-period delta. This is the deepest cost-data integration in the IA v2 set.

## Scope

In scope:
- No new tables (uses existing `cost_records` with `tags` JSONB).
- `GET /usage` implements real aggregation:
  - Filter by date range derived from `range` enum.
  - Group by `tag:<key>` → `SELECT tags->>'<key>' AS bucket, SUM(unblended_cost), date_trunc('day', billing_period) FROM cost_records GROUP BY bucket, day`.
  - Group by `platform:<key>` → bucket from a fixed column mapping (service, account, region, provider, resource_type).
  - NULL `bucket` → "Untagged" series + breakdown row.
  - Prior-period delta: same query offset by `range_days`; compute `(current - prior) / prior * 100`.
- `GET /usage/tag-keys` returns the distinct set of tag keys present in `cost_records.tags` across the workspace (capped at 50 keys, sorted by frequency).
- AuthZ: workspace-scoped; reader+ role.
- Frontend: `UsagePage` calls the live endpoint via a `useUsageQuery` hook; `usageMockData.js` is deleted.

Out of scope:
- Multi-tag group-by (`team + env`) — flagged for later.
- Compare mode against arbitrary baselines.
- Real-time / streaming updates.

## Acceptance criteria

A1. `GET /usage?scope=cloud&range=30D&group_by=tag:cost-center` returns a series with one entry per cost-center bucket plus Untagged, where Untagged = `SUM(cost) WHERE tags->>'cost-center' IS NULL`.

A2. Untagged is rendered as the LAST series + breakdown row (frontend already expects this).

A3. Delta percentage matches `(this period - prior period) / prior period * 100`, computed against the same query offset by `range_days`.

A4. Pytest with seeded `cost_records` covers: group-by-tag with multiple buckets; group-by-platform; Untagged bucket; delta computation; tag-keys discovery.

A5. Frontend UsagePage renders real cost data; `usageMockData.js` is deleted; `CLOUD_SCENARIO`/`AI_SCENARIO` no longer referenced.

A6. Performance: 30-day group-by-tag query for a 100k-line workspace returns in < 2s on dev hardware.

## Quality gates

- Backend pytest with seeded `cost_records` passes.
- Frontend `npm test` + `npm run build` pass.
- `git grep -F 'usageMockData' frontend/src/` returns zero hits.
- Query plan inspected for the group-by-tag projection — no sequential scan of the full `cost_records` table without index.
