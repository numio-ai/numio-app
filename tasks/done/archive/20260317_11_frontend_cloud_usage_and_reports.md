---
status: done
phase: 3
task_id: P3.6
---

# Frontend: Cloud Usage Page and Cost Reports

## Prerequisites

- **P3.3 — Cost attribution & cost views API:** Provides all backend APIs consumed by this page: cost views (total spend, spend by dimension, spend over time), trend analysis, and attribution rules for dimension grouping.

## Problem Statement

Customers need to explore their cloud costs in detail — drill down by dimension, filter by account or time range, and build custom cost reports on the fly. The current prototype pages need to be replaced with functional implementations backed by real data.

## Scope

**In scope:**
- **Cloud Usage page:**
  - Time-series chart of spend over the selected date range
  - Drill-down by attribution dimension (service, team, project, account, region, environment)
  - Date range selector
  - Filtering by account, dimension values
  - Data export capability (CSV) — client-side for MVP: formats the data currently displayed in the browser. If the dataset exceeds the browser's practical limit, the export covers the currently visible/loaded page of results. A server-side export endpoint is not required for MVP.
- **Cost report builder:**
  - Select dimensions, filters, date range, and grouping to build an ad-hoc cost report
  - Reports are ephemeral — built on-the-fly from the cost views API, not persisted
- All data sourced from the cost views API (P3.3)
- Unattributed costs are clearly visible and link to the tag governance dashboard at `/tag-governance` with a filter pre-applied to show non-compliant resources for the relevant dimension (e.g., `/tag-governance?filter=missing-tag&tag=team`). P3.4 must support this incoming filter parameter.

**Out of scope:**
- Backend cost views API (P3.3)
- Saving report configurations (deferred to a future task — requires backend persistence endpoints not available in Phase 3)
- Scheduled report generation (deferred — requires backend job scheduling and report output storage not provided by any Phase 3 task)
- Report sharing with external users
- PDF export
- Server-side CSV export

## Acceptance Criteria

1. Cloud Usage page shows a time-series cost chart with real data from the API
2. Users can drill down by at least 3 dimensions (service, team, account)
3. Date range selector and filters work correctly
4. CSV export downloads cost data matching the current view (client-side formatting)
5. Users can build ad-hoc cost reports by selecting dimensions, filters, date range, and grouping
6. Unattributed costs are visible and link to the tag governance dashboard with a pre-applied filter for the relevant missing tag/dimension
7. Pages handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
