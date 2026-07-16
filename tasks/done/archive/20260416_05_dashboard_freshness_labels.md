---
status: done
kind: task
---

# Inline ingestion freshness labels on dashboard widgets

**Date:** 2026-04-16

## Context

`frontend/src/components/CostSourceLabel.jsx` today renders a tag like `CUR` on cost widgets. Industry-standard dashboards (Stripe, Snowflake, Datadog) pair each data surface with a "last updated" signal — answering "can I trust this number right now?" at the point of doubt rather than forcing the user to navigate away. Task 03 exposes the ingestion status that powers this; this task applies it inline.

## Problem

Users staring at Overview / Costs / Resources dashboards cannot tell how current the numbers are. When data is a day stale, the dashboard silently misleads.

## Goals

1. Extend `CostSourceLabel` (or introduce a sibling `FreshnessLabel`) to show "Updated Xh ago" derived from `/jobs/ingestion-status` for the relevant data source.
2. Apply the label to every primary Overview widget.
3. Apply the label to Costs pages.
4. Apply the label to Resources pages.
5. Clicking the label navigates to `/ingestion`.

## Non-goals

- Dashboard empty-state rescue — Task 06.
- Failing-state banners — Task 07.
- Per-widget "freshness-based" color coding of the widget itself (the label gets amber on stale, but widget backgrounds stay neutral).

## Dependencies

- **Task 03** — `/ingestion` route required as the freshness label's click target.

## Constraints & assumptions

- A single shared hook caches `/jobs/ingestion-status` responses so many widgets don't trigger independent fetches.
- Label must tolerate missing / never-synced state gracefully.
- Component remains a small inline label; no layout changes to host widgets.

## Acceptance criteria

1. A shared hook `useIngestionFreshness(dataSource?)` exists under `frontend/src/hooks/` that:
   - Fetches `/jobs/ingestion-status` once per session (refetch on focus or on a configurable interval, default 5 min) and caches.
   - Returns `{ lastSyncAt, relativeLabel, isStale, isFailed, status, dataSource }` for the given `dataSource`; if `dataSource` is omitted, returns the aggregate most-recent sync across all sources.
2. `CostSourceLabel` accepts a new prop `showFreshness` (default `false`); when true and a `dataSource` is provided, renders `"<source> · Updated Xh ago"` where the relative label comes from the hook.
3. Label is a keyboard-accessible link: Enter / click navigates to `/ingestion`.
4. Hover / focus shows a tooltip with the absolute ISO timestamp.
5. When `isFailed` or `isStale`, the "Updated Xh ago" portion turns amber (`--warning` token); the widget itself is unaffected.
6. Applied to these Overview widgets in `frontend/src/pages/Overview.jsx`:
   - `TotalSpendWidget`, `SpendTrendWidget`, `TopCostDriversWidget`, `ComplianceWidget`, `AnomalySummaryWidget`, `ActionItemsWidget` (where each uses an ingestion-backed data source).
7. Applied to the primary widgets on `frontend/src/pages/CloudUsage/CloudUsagePage.jsx` and any other `pages/CostReporting/*` primary dashboards.
8. Applied to the primary widgets on `frontend/src/pages/Resources/ResourcesPage.jsx`.
9. Unit / component tests cover:
   - Hook cache behaviour — multiple consumers share one network call
   - Label renders with and without `showFreshness`
   - Stale / failed state renders amber
   - Click navigates to `/ingestion`

## Validation steps

1. Open Overview → each widget's source label now includes "Updated Xh ago".
2. Hover a freshness label → tooltip shows full ISO timestamp.
3. Click a freshness label → routes to `/ingestion`.
4. Simulate stale state (e.g. by stopping scheduler for > threshold) → label portion turns amber across all affected widgets.
5. Network inspection while loading Overview: `/jobs/ingestion-status` fired once, not per widget.
6. Repeat checks on Cloud Usage / Costs / Resources pages.

## Risks & rollback

**Risks:**

- Visual clutter if every widget header gains extra text. Mitigation: label is secondary typography (same size / muted color as existing source tag), appended with separator.
- Over-refetching if hook cache is misconfigured. Mitigation: shared cache validated by test + network assertion.

**Rollback:**

- Frontend-only. Revert PR; widgets fall back to showing just the source name.
