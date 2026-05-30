---
status: backlog
kind: bug
feature: bugfixes
title: Top bar “Data” pill popover: show real ingestion / job data
---

# Top bar “Data” pill popover: show real ingestion / job data

**Date:** 2026-04-17

## Observed problem

Clicking the **Data** status pill in the **top header** opens a popover that still looks like a **dummy** list of jobs. It must show **real** data aligned with the same source of truth as the **Data Ingestion** page and global ingestion status (e.g. latest CUR run per account, failures, freshness), not placeholder copy.

## Expected vs actual

| | Expected | Actual |
|---|----------|--------|
| Content | Popover lists real recent runs or a concise real summary (status, account, last run time) from the API. | Reads as static / demo content. |
| Consistency | Numbers and states match `/ingestion` and any dashboard freshness indicators for the same workspace. | Perceived disconnect from backend. |

## Reproduction steps

1. Sign in with a workspace that has ingestion history (or an empty workspace for honest empty state).
2. Click the **Data** pill in the slim top bar.
3. Compare popover content to `GET` ingestion/jobs responses and to the Data Ingestion page.

## Environment & context

- **Related code:** `frontend/src/components/DataStatusPill.jsx`, `frontend/src/context/IngestionStatusContext.jsx`, `frontend/src/api/jobs.js`.
- **Pairs with:** `tasks/backlog/20260417_01_data_ingestion_cur_jobs_minimal_view.md` (shared contracts for what “real” means).

## Acceptance criteria (closure)

- Popover body is driven by **live** data from the same endpoints used elsewhere (or a single dedicated summary endpoint if introduced—document in task completion notes).
- **Loading** and **error** states are real (spinner / retry / message), not static.
- **Empty** state explains that no runs exist yet and points to Integrations or Run (per product copy), without fake rows.
- Spot-check: values match one manual API response for the same session.

## Risks & impact

- Users assume data is syncing when the popover is decorative; support burden and mistrust in freshness indicators.
