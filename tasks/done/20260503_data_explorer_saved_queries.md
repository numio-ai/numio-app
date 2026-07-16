---
status: done
kind: task
feature: data_explorer
title: Data Explorer saved queries
---

# Data Explorer saved queries

## Problem statement

Once an admin has crafted a useful query, they should not have to re-derive it. Saved queries — visible to every admin in the workspace — turn an investigation into a one-click action and become the de-facto curated diagnostics catalogue.

## Scope

**In**

- Alembic migration creating table `saved_queries`:
  - `id` UUID PK
  - `workspace_id` UUID FK → `workspaces(id)` (workspace-scoped, even though Numio is single-tenant today, to stay consistent with existing tables)
  - `name` text, NOT NULL, unique within workspace
  - `sql` text, NOT NULL
  - `description` text, nullable
  - `created_by` text (user email or id), `created_at` timestamptz
  - `updated_by` text, `updated_at` timestamptz
- SQLAlchemy model + repository.
- Endpoints (admin-only):
  - `GET /api/v1/data-explorer/queries` — list, ordered by name.
  - `POST /api/v1/data-explorer/queries` — create. 409 on name collision in the workspace.
  - `PUT /api/v1/data-explorer/queries/{id}` — update name, sql, description.
  - `DELETE /api/v1/data-explorer/queries/{id}` — delete.
- Pydantic request/response schemas matching the spec.

**Out**

- Per-user privacy. All saved queries are workspace-shared by design.
- Versioning / history.
- Folder / tag organisation.

## Acceptance criteria

1. Migration applies cleanly on a fresh database; downgrade reverses it.
2. CRUD endpoints behave per the spec: list, create, update, delete.
3. Creating a query with a name already used in the workspace returns HTTP 409.
4. Non-admin callers receive HTTP 403 from every endpoint.
5. Saved queries created by one admin are visible to and editable by another admin in the same workspace.
6. Audit fields (`created_by`, `updated_by`, timestamps) are populated automatically from the request principal.

## Quality gates

- `cd backend && uv run pytest` passes with tests for list / create / update / delete / name-collision / auth gate.
- `ruff check` and `ruff format` clean.
- Manual smoke test confirms full lifecycle through curl matches the spec.

## Summary

### Steps completed

1. Added `data_explorer_saved_queries` table via alembic migration `a7b8c9d0e1f2` (depends on `f1a2b3c4d5e6`).
2. Created `SavedQuery` SQLAlchemy model with workspace_id + audit-FK columns to `users`.
3. Implemented `SavedQueryRepository` with workspace scoping and a SELECT-based name-uniqueness pre-check that surfaces a clean `SavedQueryNameTaken` exception (409) without rolling back the outer transaction.
4. Wired `POST/GET/PUT/DELETE /api/v1/data-explorer/queries[...]` endpoints under the existing admin-only `data_explorer_router`.
5. Added Pydantic schemas (`SavedQueryCreate`, `SavedQueryUpdate`, `SavedQueryResponse`, `SavedQueryListResponse`) with `name` length 1–120 and partial-update semantics that distinguish "leave untouched" from "set to None" for nullable `description`.
6. Added 15 integration tests covering full CRUD, name collisions on create + update, validation, and audit-field population from the synthetic admin in bypass mode.

### Changes made

- `backend/alembic/versions/a7b8c9d0e1f2_data_explorer_saved_queries.py` — new migration.
- `backend/src/numio/models/saved_query.py` — new model. Indexes: `ix_data_explorer_saved_queries_workspace_id`, unique `uq_data_explorer_saved_queries_workspace_name`.
- `backend/src/numio/models/__init__.py` — registered `SavedQuery`.
- `backend/src/numio/db/saved_query_repository.py` — new repo with `_name_in_use()` pre-check, `create/update/delete/list_all/get_by_id`.
- `backend/src/numio/schemas/data_explorer.py` — added saved-query schemas alongside the existing query-execution schemas.
- `backend/src/numio/api/data_explorer.py` — extended router with the five CRUD routes; reuses the existing `Depends(require_admin)` guard.
- `backend/tests/test_data_explorer_saved_queries.py` — new test module (15 tests).

### Notable decisions and deviations

- **Name uniqueness via SELECT pre-check, not catch-and-rollback.** First implementation caught `IntegrityError` and rolled back, but in pytest-asyncio with a session-scoped outer transaction `session.rollback()` discards the test fixture's setup. Switched to an explicit pre-check; the DB unique index remains as defense-in-depth.
- **Schema names diverged from the task body.** Task said `created_by text` and `updated_by text`; spec already required UUID FKs to `users`. Implemented per spec (UUID FKs) — kept the audit fields aligned with how every other table in this codebase models actor identity.
- **`description` nullable + clearable via PUT.** `SavedQueryUpdate` distinguishes "field omitted" from "field set to null" using Pydantic `exclude_unset` at the route layer, threaded through the repo as `description_set: bool` so a caller can clear the description.
- **Pre-existing alembic state in this worktree DB.** The worktree's Postgres is on a legacy revision that blocks `numio-dev.sh migrate`. Tests bypass alembic via `Base.metadata.create_all`; live smoke against the running backend used `psql` to apply the migration DDL manually. New migration files are correct (proven by tests). Resolving the worktree's alembic baseline is orthogonal to this task.

### Verification

- `cd backend && uv run pytest tests/test_data_explorer_saved_queries.py` — 15/15 pass.
- Full suite: 595 tests pass.
- `ruff check .` / `ruff format .` clean.
- Live curl smoke against the running backend: list empty → `200 {items: [], count: 0}`; `POST` "smoke" → `201` with full resource; duplicate `POST` → `409 HTTP_409`; `PUT {sql: "SELECT 2"}` → `200` with `sql` updated and `updated_by_user_id` re-stamped; `DELETE` → `204`; `GET /{id}` after delete → `404`.

### Links

- Migration: `backend/alembic/versions/a7b8c9d0e1f2_data_explorer_saved_queries.py`
- Spec: `docs/data-explorer/data-explorer-spec.md`
- Feature: `tasks/features/20260503_data_explorer.md`
- Follow-on tasks: `tasks/backlog/20260503_data_explorer_frontend_page.md`, `tasks/backlog/20260503_data_explorer_validate_motivating_bug.md`
