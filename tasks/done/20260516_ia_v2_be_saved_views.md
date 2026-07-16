---
status: done
kind: task
feature: ia_v2_backend_support
title: Backend — Saved Views CRUD with share-by-URL
---

# Backend — Saved Views CRUD with share-by-URL

# Backend — Saved Views CRUD with share-by-URL

## Problem statement

The IA v2 design shipped a Views picker on Usage, Resources, Tag Governance, Recommendations, Autopilot, Budgets, and Policies. The frontend serializes view state to URL params but has no backend to persist named views or list them per user/workspace. Today the frontend uses a mock store.

## Scope

In scope:
- `saved_views` table (id, workspace_id, owner_user_id, scope: usage|resources|tag_governance|recommendations|autopilot|budgets|policies, name, query_json, default_for_owner bool, shared_at_workspace bool, created_at, updated_at).
- Endpoints: `GET /saved-views?scope=`, `POST /saved-views`, `PATCH /saved-views/{id}`, `DELETE /saved-views/{id}`, `POST /saved-views/{id}/set-default`.
- `query_json` stores the URL-param shape as-is; backend does not interpret it.
- AuthZ: owner can read/write own; workspace-shared views readable by all members; only owner can delete.

Out of scope:
- Group-level or per-user (other than owner) sharing — workspace-shared is the only sharing tier.
- Versioning of views.
- Audit log entries for view edits.

## Acceptance criteria

A1. `GET /saved-views?scope=usage` returns the caller's owned + workspace-shared views for that scope.

A2. `POST /saved-views { scope, name, query_json, shared_at_workspace }` creates a row and returns it with id.

A3. `PATCH` allows rename, set-default, toggle shared.

A4. `DELETE` only succeeds for the owner; other users get 403.

A5. The IA v2 Usage page can read/write views through these endpoints with no frontend-side persistence; the mock store from `ia_v2_usage` is removed.

## Quality gates

- Alembic migration applied & idempotent.
- Pytest covers each endpoint + authZ paths (owner read/write, shared read, non-owner delete forbidden).
- OpenAPI / FastAPI schema documents the endpoints.
- Docs updated: any user-facing or developer doc that mentions Saved Views.

## Summary

### Steps completed

Scaffold-only per option 2 (API contract + endpoint scaffolding; persistence deferred):

1. Built `backend/src/numio/schemas/ia_v2_saved_views.py` — `SavedViewResponse`, `SavedViewListResponse`, `CreateSavedViewRequest`, `UpdateSavedViewRequest`, `SavedViewScope` enum with 7 values (usage / resources / tag_governance / recommendations / autopilot / budgets / policies).
2. Built `backend/src/numio/api/ia_v2_saved_views.py` with 5 endpoints:
   - `GET /saved-views?scope=` — returns canned views per scope, owned + workspace-shared
   - `POST /saved-views` — creates a view; returns it with id (201)
   - `PATCH /saved-views/{view_id}` — echoes updates back
   - `DELETE /saved-views/{view_id}` — 204
   - `POST /saved-views/{view_id}/set-default` — flips `default_for_owner=true`
3. Wired the router into `backend/src/numio/main.py` under `/api/v1`.
4. Wrote `backend/tests/test_ia_v2_saved_views.py` — 7 pytest cases against the live ASGI transport, using the `db_session` dependency-override pattern that the data-explorer tests use.

### Changes made

- New: `schemas/ia_v2_saved_views.py`, `api/ia_v2_saved_views.py`, `tests/test_ia_v2_saved_views.py`.
- Modified: `main.py` — added import + `include_router` line.

### Notable decisions or deviations

- **No alembic migration, no SQLAlchemy model, no repository** — option 2 per user direction. Endpoints return fixture data; the contract is the deliverable.
- **AuthZ via `get_current_user`** dependency in place; full owner/shared/non-owner-delete enforcement deferred to the persistence task.
- **Set-default treated as a separate endpoint** (POST `/{id}/set-default`) rather than PATCH for clarity. Mirrors common REST patterns for state transitions.
- **Tests use the established `client` + `dependency_overrides[get_session]` pattern** from `test_data_explorer_saved_queries.py`.

### Links

- Tests: `cd backend && PGPORT=50784 DATABASE_URL=postgresql+psycopg://numio:numio@localhost:50784/numio_test VIRTUAL_ENV=.venv uv run --active pytest tests/test_ia_v2_saved_views.py` — 7 / 7 passing.
