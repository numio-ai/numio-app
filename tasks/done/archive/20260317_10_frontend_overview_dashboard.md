---
status: done
phase: 3
task_id: P3.5
---

# Frontend: Overview Dashboard

## Prerequisites

- **P3.3 — Cost attribution & cost views API:** Provides the cost data APIs (total spend, spend by dimension, spend over time, trend analysis) that power the dashboard's cost widgets.
- **P3.1 — Tag policy engine & compliance audit:** Provides the compliance summary API for the tag compliance widget.

## Problem Statement

The current Overview page is a dummy prototype with mock data. Customers need a real dashboard that provides an at-a-glance summary of their cloud cost posture: total spend, trends, top cost drivers, tag compliance status, anomalies, and action items.

## Scope

**In scope:**
- Replace the prototype Overview page with a functional dashboard backed by real API data
- Dashboard shows:
  - Total spend for the current period with comparison to previous period
  - Spend trend chart (daily spend over the last 30 days minimum)
  - Top cost drivers — default grouping is by AWS service (no attribution rules required). A dropdown allows switching to other dimensions (team, project, account, etc.) when P3.3 attribution rules are configured. If no attribution rules exist for the selected dimension, the widget shows "No attribution rules configured for [dimension]" with a link to settings.
  - Cost breakdown by top attribution dimensions
  - Tag compliance summary: cost-weighted compliance percentage (prominent placement, not an afterthought)
  - Anomaly summary: count of active anomalies with link to details
  - Action items count: open findings and recommendations requiring attention
  - **Graceful degradation for Phase 4+ widgets:** The anomaly summary and action items sections are included in the dashboard layout but display "No data available" or are hidden when the backing API returns a 404 or is not yet deployed. These sections become functional when P4.1 (anomaly detection), P4.3 (findings management), and P6.1 (recommendations engine) are completed — no changes to P3.5 should be required. The frontend must handle missing/unavailable API endpoints without errors or broken UI.
- Date range selector for adjusting the dashboard time window
- All data sourced from the cost views API (P3.3) and other backend APIs

**Out of scope:**
- Backend API endpoints (built in other tasks)
- Customizable dashboard layouts or widget configuration
- Export functionality
- Cloud Usage detail page (separate task P3.6)

## Acceptance Criteria

1. Overview dashboard displays real cost data from the backend API
2. Total spend shows current vs previous period comparison
3. Spend trend chart displays daily costs for at least the last 30 days
4. Top cost drivers default to grouping by AWS service; switching to another dimension via dropdown works when attribution rules are configured
5. Tag compliance % is displayed prominently alongside total spend
6. Anomaly and action item sections degrade gracefully when Phase 4/6 APIs are unavailable — display "No data available" or hide without errors
7. Anomaly and action item counts link to the correct route paths (e.g., `/anomalies`, `/findings`). If the target page is not yet built (P4.4), the link still navigates to the correct route
8. Date range selector changes the data displayed across all dashboard widgets
9. Dashboard handles loading, empty, and error states gracefully

## Quality Gates

- Page renders correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
