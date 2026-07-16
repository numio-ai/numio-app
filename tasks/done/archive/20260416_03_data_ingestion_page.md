---
status: done
kind: task
---

# Data Ingestion observability page at /ingestion

**Date:** 2026-04-16

## Context

Backend already exposes the telemetry needed for an ingestion observability surface:

- `GET /jobs/ingestion-status` — per-account × per-data-source last sync, status, row count, errors (`backend/src/numio/api/jobs.py:125`)
- `GET /jobs/history?limit=N` — recent `JobRun`s with per-account results (`backend/src/numio/api/jobs.py:85`)
- `GET /jobs/types` — registered job types with schedule intervals
- `POST /jobs/{job_type}/trigger` — admin-only on-demand trigger

No UI surfaces this today. The only ingestion-adjacent UI is `frontend/src/pages/Settings/Integrations.jsx`, which only covers connection validation at handshake time — not ongoing health. This task creates the core observability surface; subsequent tasks (04, 05, 06, 07) link to and extend it.

## Problem

Users who connect an AWS account cannot confirm whether scheduled ingestion has run, see when data last landed, check row counts, or investigate failures. Their only recourse today is to escalate to engineering.

## Goals

1. Add a new route `/ingestion` outside of `/settings/*`.
2. Add a sidebar entry in `frontend/src/components/OverviewSidebar.jsx` labelled "Data Ingestion".
3. Render a per-account × per-data-source matrix showing last sync, status, row counts, expandable errors.
4. Render a recent job-runs history table with expandable errors and pagination.
5. Provide an admin-only "Run now" control per registered job type.

## Non-goals

- Top-bar `Data` pill — see Task 04.
- Inline freshness on dashboard widgets — see Task 05.
- Diagnostic empty states on dashboard widgets — see Task 06.
- Global app-shell banner for failing ingestion — see Task 07.
- Cross-workspace rollups — current workspace only.
- Backend changes — all endpoints already exist.

## Constraints & assumptions

- Route must live outside `/settings/*`. Settings holds configuration; this page holds observation.
- "Run now" action must respect `require_role("admin")` gating already enforced by `POST /jobs/{job_type}/trigger`. Frontend should also hide/disable the button for non-admins to avoid dead clicks, but must not rely on frontend gating alone.
- Thresholds for "stale" or "recently ran" are frontend constants for MVP (e.g. `STALE_THRESHOLD_HOURS = 26`).
- Assume polling interval of 30s while page is visible is acceptable; if the API becomes expensive at scale, introduce a dedicated lightweight endpoint in a future task.

## Acceptance criteria

1. Route `/ingestion` registered in `frontend/src/App.jsx` and protected by the same auth wrapper as other authenticated routes.
2. Page component exists at `frontend/src/pages/Ingestion/IngestionPage.jsx` (or equivalent).
3. Sidebar entry added in `OverviewSidebar.jsx`:
   - Label: "Data Ingestion"
   - Icon: `lucide-react` `Activity` or `Database`
   - Placement: top-level entry (not under Settings), near Overview
4. Page header: title "Data Ingestion", one-line subtitle explaining purpose, a manual "Refresh" button, and a "last refreshed at" timestamp.
5. **Per-account × per-data-source matrix table** with columns:
   - Account (alias + AWS account ID)
   - Data source (e.g. CUR, Cost Explorer, Resource Inventory)
   - Last sync (relative + absolute tooltip)
   - Status (color-coded badge: `success`, `running`, `failed`, `never`)
   - Rows (current count)
   - Δ rows (delta vs previous sync; requires comparing successive `/jobs/ingestion-status` snapshots client-side or via `/jobs/history`)
   - Last error (inline expandable when status = failed; copy-to-clipboard affordance on error body)
6. **Recent job-runs table** with columns: Job type, Started, Finished, Duration, Status, Accounts affected (count + hover for list), Errors (expandable). Paginated: initial limit=20, "Load more" button fetches next batch.
7. **Admin "Run now"** control:
   - Rendered as a button per registered job type (from `/jobs/types`) in a dedicated section
   - Hidden or disabled-with-tooltip for non-admin users
   - Confirmation dialog ("Run <job_type> now?") before triggering
   - On trigger: calls `POST /jobs/{job_type}/trigger`, disables button + shows spinner, polls `/jobs/history` until the new run finishes or times out (e.g. 5 min), then shows toast with result
8. **Empty state** when no accounts configured: shows message + primary CTA linking to `/settings/integrations`.
9. **API error handling**: toast on fetch failure + retry affordance; skeleton loader during initial fetch; no white-screen crash.
10. **Auto-refresh** every 30s while page is in foreground; pauses while the user has an expanded error row open.
11. Unit / component tests cover: matrix renders from mocked `/jobs/ingestion-status`, history renders from mocked `/jobs/history`, admin gating of Run now button, empty state when no accounts.

## Validation steps

1. With no accounts connected, navigate to `/ingestion` → empty state + CTA to Integrations.
2. Connect an AWS account with valid CUR config → return to `/ingestion`. After first job run, account row shows `success` with last sync time and row count.
3. Point an account to a broken CUR S3 location. Run job (via Run now as admin) → account row shows `failed` status with expandable error; history table shows corresponding failed run.
4. As admin, click "Run now" on CUR job type → confirm dialog → confirm → button disables and spins. New run appears in history table, transitions `running` → `success`. Matrix updates.
5. Switch user to non-admin role (via `RoleSwitcher`) → Run now button is hidden or disabled with tooltip "Admin only".
6. Leave page open, observe auto-refresh every 30s.
7. Open an error row, confirm auto-refresh pauses until closed.
8. Navigate via sidebar entry from any other page; confirm entry highlights active.

## Risks & rollback

**Risks:**

- Polling every 30s across many tabs could multiply backend load. Mitigation: simple interval now; switch to visibility-aware or server-sent events in a later task if needed.
- Δ rows calculation requires comparing snapshots. If the backend only returns current counts, delta must be computed client-side and persisted in memory — will reset on page reload. Document this limitation; consider a backend enhancement task if delta is critical.
- Run now trigger with no progress endpoint means the frontend polls history for completion — time-out window needs to be generous (e.g. 5 min) because long CUR ingests can take minutes.

**Rollback:**

- Pure additive frontend change. Revert PR; route and sidebar entry disappear. No data migrations.
