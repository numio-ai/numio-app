---
status: done
kind: task
feature: data_explorer
title: Data Explorer query endpoint
draft: true
---

# Data Explorer query endpoint

## Problem statement

Admins need a backend endpoint that accepts a SQL string, executes it against the read-only Postgres role, enforces a statement timeout and row cap, and returns a structured result the frontend can render directly.

## Scope

**In**

- New route `POST /api/v1/data-explorer/query`:
  - Admin-only. In dev mode (`AUTH_ENABLED=false`) the synthetic admin satisfies this.
  - Request body: `{ "sql": "<text>" }`.
  - Opens a session via the read-only engine from `data_explorer_readonly_role`.
  - Sets `SET LOCAL statement_timeout = <configured ms>` before executing.
  - Executes the supplied SQL once, no rewriting.
  - Reads up to `<row cap + 1>` rows. If the extra row exists, sets `truncated = true` and drops it.
  - Returns: `{ "columns": [...], "rows": [[...], ...], "row_count": N, "truncated": bool, "elapsed_ms": int }`.
- Error model:
  - Permission errors from Postgres (write attempts) → HTTP 400 with the Postgres message.
  - Statement timeout → HTTP 400 with a clear "query exceeded N seconds" message.
  - Syntax / runtime errors → HTTP 400 with the Postgres message.
  - Auth failure (non-admin) → HTTP 403.
- Settings: `DATA_EXPLORER_STATEMENT_TIMEOUT_MS` (default 30000), `DATA_EXPLORER_ROW_LIMIT` (default 1000).

**Out**

- Saved queries (next task).
- Frontend.
- Schema introspection / autocomplete.
- Streaming or paginated results — single batch is enough for v1.

## Acceptance criteria

1. `POST /api/v1/data-explorer/query` with a valid `SELECT` returns columns and rows under the cap.
2. A query returning more than the cap returns the cap's worth of rows with `truncated: true`.
3. A `CREATE TABLE`, `UPDATE`, or `DELETE` request returns HTTP 400 with the Postgres permission error and no side effects.
4. A query exceeding the statement timeout returns HTTP 400 with a clear timeout message.
5. A non-admin caller (auth enabled) receives HTTP 403.
6. The endpoint uses the read-only session, never the main app session.
7. Response includes `elapsed_ms` measured server-side.

## Quality gates

- `cd backend && uv run pytest` passes with new tests covering: success, truncation, permission rejection (each of CREATE/UPDATE/DELETE), timeout, auth gate.
- `ruff check` and `ruff format` clean.
- Manual curl against running backend matches the spec's documented response shape.

## Summary

### Steps completed

1. Added 3 settings to `core/config.py` (`data_explorer_statement_timeout_ms` 10s, `data_explorer_max_rows` 1000, `data_explorer_max_sql_bytes` 50 KB).
2. Added `QueryRequest` / `QueryResponse` Pydantic schemas.
3. Wrote `core/data_explorer_service.py` — `execute_query()` runs `SET LOCAL statement_timeout`, executes user SQL, fetches `max_rows + 1`, classifies psycopg errors by SQLSTATE, serialises rows.
4. Wrote `api/data_explorer.py` — `POST /api/v1/data-explorer/query` with `require_role("admin")`, structured error envelope mapped from error_code → HTTP status.
5. Registered the router in `main.py`.
6. Wrote 12 integration tests covering success, truncation, four write-rejection variants, syntax error, timeout (with monkeypatched 100 ms timeout + `pg_sleep(2)`), oversized SQL, empty body, decimal serialisation.
7. Manually curl-tested against the running worktree backend: SELECT works, CREATE → 403, syntax error → 400.

### Changes made

- New: `backend/src/numio/api/data_explorer.py`
- New: `backend/src/numio/core/data_explorer_service.py`
- New: `backend/src/numio/schemas/data_explorer.py`
- New: `backend/tests/test_data_explorer_query.py`
- Modified: `backend/src/numio/core/config.py` (3 new settings)
- Modified: `backend/src/numio/main.py` (router import + include)

### Notable decisions and deviations

- **Error code semantics from spec, not task body.** Task body said all errors → 400; spec defined 403 PERMISSION_DENIED, 408 STATEMENT_TIMEOUT, 413 SQL_TOO_LARGE, 400 INVALID_SQL. Followed spec because it is the locked contract.
- **Classification by SQLSTATE**, not error-message text. `42501` → permission denied, `57014` → query canceled. Robust across Postgres versions/locales.
- **`SET LOCAL` inside the same session/transaction as the user query.** AsyncSession autobegins on first execute; SET LOCAL applies to that transaction only.
- **No SQL rewriting / wrapping.** Read N+1 from cursor + statement_timeout is sufficient bound; doesn't break CTEs, multi-statement, or comments.
- **Postgres message returned verbatim** in the `message` field — operators are debugging the database, the literal Postgres line+caret pointer is what they need.

### Test results

- New: `tests/test_data_explorer_query.py` — 12/12 pass.
- Full backend suite: 580/580 pass.
- Lint + format clean.

### Links

- Spec: `docs/data-explorer/data-explorer-spec.md` §4.1, §7
- Feature: `tasks/features/20260503_data_explorer.md`
