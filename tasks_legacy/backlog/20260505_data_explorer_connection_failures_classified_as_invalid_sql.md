---
status: backlog
kind: bug
title: Data Explorer: connection failures classified as INVALID_SQL / 400
---

# Data Explorer: connection failures classified as INVALID_SQL / 400

# Data Explorer: connection failures classified as INVALID_SQL / 400

## Problem statement

The Data Explorer query endpoint (`POST /api/v1/data-explorer/query`) classifies all SQL execution errors by the Postgres SQLSTATE code returned in the `psycopg.Error.sqlstate` attribute. Connection-time errors — when the engine cannot establish a session at all (e.g. `password authentication failed`, host unreachable, role does not exist) — never produce a SQLSTATE because the SQL never executed. The fall-through bucket in `data_explorer_service._execute()` returns `400 INVALID_SQL` for any unclassified error, so a connection failure surfaces in the UI as **"400 · Invalid SQL (INVALID_SQL)"** with the raw libpq message in the body.

This was observed during Task 5 smoke testing on 2026-05-04: the worktree's `numio_readonly` role had a stale password; running any query produced `400 INVALID_SQL` even though the SQL itself was syntactically valid.

## Scope

**In**

- Detect connection-class failures (psycopg `OperationalError` with no `sqlstate`, or with a `08*` SQLSTATE class — connection exception) in `backend/src/numio/core/data_explorer_service.py`.
- Map them to a new error code `BACKEND_UNAVAILABLE` returned with HTTP 500 (or 503).
- Surface the original Postgres error message verbatim — do not mask the operator's view of what went wrong.
- Update the spec's error table in `docs/data-explorer/data-explorer-spec.md` (§4.1) to document the new code.
- Test: an integration test that points the readonly engine at a bad password / unreachable host, runs a query, and asserts the response is 500 / `BACKEND_UNAVAILABLE`.

**Out**

- Retries / circuit-breakers. The first request to a broken backend should still return a clear error.
- Adding a health check for the readonly role to the `/health` endpoint. File separately if desired.

## Acceptance criteria

1. With the readonly role's password broken, `POST /api/v1/data-explorer/query` returns HTTP 500 (or 503) with `error_code = "BACKEND_UNAVAILABLE"` and the libpq message in `message`.
2. Valid SQL against a working connection is unaffected — still returns 200.
3. Genuinely invalid SQL (`SELEKT * FROM workspaces`) still returns 400 / `INVALID_SQL`.
4. Spec error table includes the new code and its trigger.

## Quality gates

- `cd backend && uv run pytest tests/test_data_explorer_query.py` passes including a new test for the connection-failure path.
- `ruff check` clean.
- Manual: temporarily set `DATA_EXPLORER_DB_PASSWORD` to a wrong value, run a query through the UI, observe `500 · BACKEND_UNAVAILABLE`.
