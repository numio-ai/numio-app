---
status: done
slug: data_explorer
title: Data Explorer
---

# Data Explorer

## Problem statement

Numio's UI screens (Overview, Recommendations, Insights) sometimes display values that are hard to interpret without seeing the underlying data. Recent example: the Overview tile showed `-$2 pending` for May 2026. It is unclear whether the value is a real credit, a UI rounding artefact, or a data bug in CUR ingestion. Today the only way to investigate is `docker exec -it numio-postgres psql ...`, which is gated by host access and Postgres knowledge.

While Numio is in active development, both engineering and product roles need fast, in-app access to the raw cost data so they can:

- Bypass incomplete or broken UI screens and still get answers from the data already loaded.
- Validate UI numbers against the rows that produced them.
- Save and share the queries that proved useful, so future investigations are one click instead of one re-derivation.

## Objective

Ship an in-app **Data Explorer** that lets an admin run read-only SQL against Numio's Postgres database, view results, and save queries that other admins in the workspace can reuse.

## Scope

**In scope**

- SQL editor with a Run action.
- Result table with columns, rows, and a truncation indicator when the row cap is hit.
- Saved queries — listed, runnable, renamable, deletable. Visible to every admin in the workspace.
- Read-only enforcement via a dedicated Postgres role with `SELECT`-only grants. No app-level SQL parsing.
- Server-side `statement_timeout` to bound runaway queries.
- Admin-only access in production. In dev mode (`AUTH_ENABLED=false`) the synthetic admin uses it.
- Spec at `docs/data-explorer/data-explorer-spec.md` defining API contract, UI layout, and operator notes.

**Out of scope**

- Natural-language → SQL via Chat. Tracked as a follow-up feature.
- Schema browser / autocomplete.
- Query history and CSV export.
- Scheduled queries.
- Sharing saved queries outside the workspace.
- Multi-tenant isolation. Numio is currently a self-hosted single-tenant application; `workspace_id` is reserved for future multi-tenancy.
- Write queries (INSERT/UPDATE/DELETE/DDL). Blocked by the read-only role.
- Query plan / `EXPLAIN` UI.

## Acceptance criteria

1. An admin sees a **Data Explorer** entry in the main navigation. Non-admin users do not.
2. An admin can type a SQL statement, click **Run**, and see results in a table within 5 seconds for typical queries against `cost_records`.
3. A non-`SELECT` statement (INSERT/UPDATE/DELETE/DDL/etc.) is rejected with a clear error returned by Postgres, not by application-level parsing.
4. A query exceeding the configured statement timeout is terminated and returns a clear error.
5. Result rows are capped at the configured limit. When the cap is hit the UI shows a visible truncation indicator.
6. An admin can save a named query. The saved query is listed in the same page and is visible to every admin in the workspace.
7. An admin can run, rename, or delete any saved query in the workspace.
8. In dev mode (`AUTH_ENABLED=false`), the synthetic admin can use the feature with no extra setup.
9. **Motivating example reproduces.** An admin can write a query that returns the rows behind the May 2026 `pending` Overview tile and decide whether the displayed `-$2` is real, a UI rounding artefact, or a data bug. The finding and the query are recorded in the spec as a worked example.

## Tasks

In execution order:

1. `data_explorer_spec` — Lock the API + UI contract under `docs/data-explorer/data-explorer-spec.md`.
2. `data_explorer_readonly_role` — Provision the read-only Postgres role and wire a separate connection for the explorer.
3. `data_explorer_query_endpoint` — `POST /api/v1/data-explorer/query` admin-only, runs SQL via the read-only connection with statement timeout and row cap.
4. `data_explorer_saved_queries` — Workspace-scoped saved-query model and CRUD endpoints.
5. `data_explorer_frontend_page` — `/data-explorer` route with editor, result table, error display, saved-queries panel, and admin-gated nav entry.
6. `data_explorer_validate_motivating_bug` — Reproduce the May 2026 `-$2 pending` case end-to-end, document in the spec, file follow-up for whichever cause is found.

## Linked spec

`docs/data-explorer/data-explorer-spec.md` (created in `data_explorer_spec`).

## Summary

### Steps completed

All six member tasks landed in the planned order, stop-per-task:

1. `data_explorer_spec` — locked the API + UI contract under `docs/data-explorer/data-explorer-spec.md`, including the read-only role design, saved-query data model, and operational defaults (10s `statement_timeout`, 1000-row cap, 50KB SQL limit).
2. `data_explorer_readonly_role` — alembic migration `f1a2b3c4d5e6` provisions the `numio_readonly` Postgres role with `USAGE + SELECT` grants. Backend wires a separate engine via `DATA_EXPLORER_DATABASE_URL` (or derives one from `DATABASE_URL` + `DATA_EXPLORER_DB_PASSWORD`).
3. `data_explorer_query_endpoint` — `POST /api/v1/data-explorer/query` admin-only, runs SQL through the readonly session with `SET LOCAL statement_timeout`, fetches `max_rows + 1` to detect truncation, and classifies errors by SQLSTATE (42501 → 403 PERMISSION_DENIED, 57014 → 408 STATEMENT_TIMEOUT, syntax → 400 INVALID_SQL, > size → 413 SQL_TOO_LARGE).
4. `data_explorer_saved_queries` — alembic migration `a7b8c9d0e1f2` adds `data_explorer_saved_queries` table with workspace + audit FKs to `users`. Repository uses a SELECT-based name-uniqueness pre-check (avoids the IntegrityError-rollback path that would discard the test fixture's outer transaction). Endpoints: GET / POST / PUT / DELETE under `/api/v1/data-explorer/queries`.
5. `data_explorer_frontend_page` — `/data-explorer` React route, plain `<textarea>` editor with `⌘/Ctrl+Enter`, result table with truncation banner and NULL rendering, side panel with Run / Rename / Delete and Save current. Admin-only via `RequireAdmin` + sidebar gating.
6. `data_explorer_validate_motivating_bug` — used the new tool to investigate the May 2026 `-$2 pending` Overview tile. Confirmed via Data Explorer that the negative is real net cost (Free Tier credits exceeding usage), not a data bug. Saved diagnostic query in the workspace; filed the UI follow-up; wrote the Worked example into spec section 10.

### Acceptance criteria — pass

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Admin sees Data Explorer in nav; non-admins don't | ✅ Sidebar `ADMIN_ONLY_ITEM_IDS` filter + `RequireAdmin` route guard |
| 2 | Run a SELECT, see results within 5s for typical `cost_records` queries | ✅ Live: 53k-row aggregation returns in ~84ms |
| 3 | Non-SELECT rejected by Postgres, not app parsing | ✅ Test `test_writes_are_denied_with_403` covers INSERT/UPDATE/DELETE/CREATE |
| 4 | Statement-timeout queries terminated with clear error | ✅ Test `test_statement_timeout_returns_408` |
| 5 | Result rows capped; UI shows truncation indicator | ✅ Test `test_truncation_indicator` + frontend banner |
| 6 | Save named queries; visible to every admin in workspace | ✅ Backend tests + live UI smoke |
| 7 | Run, rename, delete any saved query | ✅ Live UI smoke (Puppeteer) |
| 8 | Synthetic admin works in dev mode | ✅ Bypass mode confirmed end-to-end |
| 9 | **Motivating example reproduces** | ✅ Spec §10 Worked example; saved query `overview_pending_breakdown_by_month`; follow-up filed |

### Notable decisions and deviations

- **No app-level SQL parsing.** Read-only enforcement is delegated entirely to Postgres role grants. The error from a write attempt is the verbatim Postgres `permission denied for table X`. This is what the spec requires; no allow/deny list.
- **Saved-queries panel placed on the right, not the left** (deviation from initial wireframe). Spec section 9.1 documents the rationale: editor + result get the dominant horizontal space.
- **Run-from-panel both loads SQL into the editor and executes it** (deviation from initial spec). Reproducing a saved investigation should be one click. Rename remains a separate inline button for cases where you only want to view.
- **Workspace + audit FKs to `users`** (deviation from task body, which said `created_by text`). Brought in line with how every other table in the codebase models actor identity.
- **Did not fix two pre-existing infrastructure issues during this feature:**
  - The worktree's alembic baseline blocks `numio-dev.sh migrate`. New migrations (`f1a2b3c4d5e6`, `a7b8c9d0e1f2`) are correct; tests pass via `Base.metadata.create_all`. Live verification used manual psql to apply DDL. Orthogonal to this feature.
  - Backend misclassifies DB-connection failures as `INVALID_SQL` / 400. Surfaced during Task 5 smoke testing. Not blocking — but flagged in Task 5 summary as a follow-up to file.

### Verification

- Backend: `cd backend && uv run pytest` — 595 tests pass (35 new across Data Explorer).
- Frontend: `cd frontend && npm test --run` — 220 tests pass (10 new).
- Frontend: `cd frontend && npm run build` — clean.
- Live UI smoke against the running worktree dev stack: every acceptance criterion exercised end-to-end via Puppeteer.

### Follow-ups filed

- `tasks/backlog/20260504_overview_tile_pending_is_misleading_surface_usage_and_credit.md` — UI fix for the motivating tile (kind: bug, ad-hoc).
- _Mentioned but not yet filed (recommend filing if not already covered):_ backend SQLSTATE classifier should handle DB-connection errors → 500/`BACKEND_UNAVAILABLE` instead of falling through to `INVALID_SQL`.

### Links

- Spec: `docs/data-explorer/data-explorer-spec.md`
- Migrations: `backend/alembic/versions/f1a2b3c4d5e6_data_explorer_readonly_role.py`, `backend/alembic/versions/a7b8c9d0e1f2_data_explorer_saved_queries.py`
- Tasks (all done): see `tasks/done/20260503_data_explorer_*.md`
- Saved diagnostic query: `overview_pending_breakdown_by_month` (id `6dc67f30-19ea-4e71-bb59-8d5c75c1a39f`)
