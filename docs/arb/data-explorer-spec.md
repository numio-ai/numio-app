# Data Explorer — Specification

Status: draft, locked for implementation
Owner: Numio engineering
Linked feature: [`tasks/features/20260503_data_explorer.md`](../../tasks/features/20260503_data_explorer.md)

## 1. Goals

- Let an admin run read-only SQL against Numio's Postgres from inside the app and see results in a table.
- Let admins save named queries that other admins in the same workspace can rerun, rename, or delete.
- Bypass the UI when a tile shows a confusing number — query the rows that produced it without opening `psql`.

## 2. Non-goals

- Natural-language → SQL via Chat (separate feature).
- Schema browser, autocomplete, query history, CSV export, scheduled queries, `EXPLAIN` UI.
- Cross-workspace sharing of saved queries.
- Multi-tenant isolation. Numio is a self-hosted single-tenant deployment today; `workspace_id` is reserved for future multi-tenancy. See feature file for full rationale.
- App-level SQL parsing or write-statement detection. Read-only is enforced by Postgres role grants.

## 3. Architecture summary

```
Frontend (/data-explorer, admin-only)
        │  POST /api/v1/data-explorer/query   {sql}
        │  GET/POST/PUT/DELETE /api/v1/data-explorer/queries
        ▼
FastAPI router (admin-only via require_role("admin"))
        │
        ├──► Saved-query CRUD ─► default app session (numio user) ─► PostgreSQL (RW)
        │
        └──► Ad-hoc query     ─► numio_readonly session (separate engine)
                                   │
                                   └─► PostgreSQL (SELECT-only role)
                                         statement_timeout set per session
```

Two database connections live side by side:

- **Primary** — existing `numio` role with full access. Used for everything else in the backend, plus the saved-queries CRUD.
- **Read-only** — new `numio_readonly` role with `USAGE` on `public` and `SELECT` on every table in `public`. Used **only** for ad-hoc queries from the Data Explorer.

Anything that requires a write (e.g. insert, update, drop) fails with a Postgres error like `permission denied for table X`. The error is surfaced verbatim to the operator. There is no app-level allow/deny list.

## 4. API contract

Base path: `/api/v1/data-explorer`. All endpoints require an authenticated user with role `admin`. In dev mode (`AUTH_ENABLED=false`) the synthetic admin satisfies this.

Errors follow the existing Numio envelope (`error_code`, `message`, `request_id`, optional `details`) — see `docs/api-guide.md`.

### 4.1 `POST /query` — run ad-hoc SQL

Request body:

```json
{
  "sql": "SELECT billing_period, SUM(unblended_cost) FROM cost_records GROUP BY 1 ORDER BY 1"
}
```

Response (200):

```json
{
  "columns": ["billing_period", "sum"],
  "rows": [
    ["2026-04-01", "12345.6700"],
    ["2026-05-01", "-2.0000"]
  ],
  "row_count": 2,
  "truncated": false,
  "elapsed_ms": 142
}
```

Field semantics:

| Field | Type | Notes |
|---|---|---|
| `columns` | `string[]` | Column names from the cursor description, in order. |
| `rows` | `any[][]` | Rows in column order. Postgres values are JSON-serialised: numbers as JSON numbers, decimals/dates/uuids/bytes as strings, `NULL` as `null`. The frontend must treat values as opaque and render with `String(value)` (or `""` for `null`). |
| `row_count` | `int` | Number of rows in `rows` (after the row cap). |
| `truncated` | `bool` | `true` when more rows existed than the configured `max_rows`. |
| `elapsed_ms` | `int` | Server-side execution wall time. |

Error responses (all use the standard envelope):

| HTTP | `error_code` | When |
|---|---|---|
| 400 | `INVALID_SQL` | Postgres rejected the statement (syntax, unknown column, type mismatch, etc.). `message` is the Postgres error string. |
| 403 | `PERMISSION_DENIED` | The role rejected the statement (write, DDL, or table the read-only role cannot see). `message` is the Postgres error string. Caller is admin — this means the *role*, not Numio RBAC, denied it. |
| 408 | `STATEMENT_TIMEOUT` | Query exceeded `statement_timeout`. |
| 413 | `SQL_TOO_LARGE` | Submitted SQL longer than the configured upper bound (default 50 KB). |
| 422 | `VALIDATION_ERROR` | Body shape invalid (missing `sql`, wrong type). |
| 500 | `INTERNAL_ERROR` | Unhandled error. Logged with traceback. |

Notes:

- Only the first statement in `sql` is executed. Multi-statement input is rejected by psycopg's default behaviour or returns the first result; we do not advertise multi-statement support.
- Rate limit: write-tier limit (`RATE_LIMIT_WRITE`, default 20 req/min) — running SQL is operationally a write-shaped action even though the role is read-only.

### 4.2 Saved queries

Resource shape:

```json
{
  "id": "f3c1...",
  "workspace_id": "00000000-...",
  "name": "Pending May 2026",
  "sql": "SELECT * FROM cost_records WHERE ...",
  "description": "Rows behind the May 2026 -$2 pending tile",
  "created_by_user_id": "00000000-...",
  "updated_by_user_id": "00000000-...",
  "created_at": "2026-05-03T10:11:12Z",
  "updated_at": "2026-05-03T10:11:12Z"
}
```

`description` is optional free text (nullable). `updated_by_user_id` is set on every PUT.

| Method & path | Behaviour |
|---|---|
| `GET /queries` | List saved queries in the caller's workspace, ordered by `name` ascending. Returns `{ "items": [...], "count": N }`. No pagination — this list is small by design (Data Explorer is a power-user tool, not a knowledge base). |
| `POST /queries` | Create. Body: `{name, sql}`. `name` must be 1–120 chars and unique per workspace; collision returns `409 NAME_TAKEN`. Returns the new resource. |
| `GET /queries/{id}` | Fetch one. `404 NOT_FOUND` if the row is in another workspace or does not exist. |
| `PUT /queries/{id}` | Rename and/or replace SQL. Body: `{name?, sql?}`. Same uniqueness rule. |
| `DELETE /queries/{id}` | Delete. Returns `204`. |

Authorisation: every saved-query endpoint requires `admin`. Any admin in the workspace can edit or delete any saved query — no per-row ownership check. (Numio is single-tenant single-admin in practice; the simplest possible model.)

The endpoints use the **primary** database connection (`get_session`), not the read-only one — they need to write to `data_explorer_saved_queries`.

## 5. Saved-query data model

Migration adds one table:

```
data_explorer_saved_queries
  id                    uuid       primary key, default gen_random_uuid()
  workspace_id          uuid       not null, references workspaces(id) on delete cascade
  name                  varchar(120) not null
  sql                   text       not null
  description           text       nullable
  created_by_user_id    uuid       not null, references users(id)
  updated_by_user_id    uuid       not null, references users(id)
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()

  unique (workspace_id, name)
  index  (workspace_id)
```

Notes:

- `workspace_id` is populated from `current_user.workspace_id` on insert. Every read filters by `workspace_id = current_user.workspace_id`.
- `updated_at` is bumped on every PUT.
- `name` uniqueness is per workspace, not global.

## 6. Read-only enforcement

A separate Postgres role and connection pool, no app-level filtering.

### 6.1 Role

Created by an Alembic migration that runs idempotently:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'numio_readonly') THEN
    CREATE ROLE numio_readonly LOGIN PASSWORD :'pwd';
  END IF;
END$$;

GRANT USAGE   ON SCHEMA   public TO numio_readonly;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO numio_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO numio_readonly;
```

The default-privileges line ensures tables added by future migrations are also readable. Without it, every new table needs a follow-up grant. CONNECT on the database is granted by Postgres to PUBLIC by default, so `numio_readonly` inherits it without an explicit GRANT — keeping the DDL portable across database names.

The migration `MUST` set the password from an Alembic context variable bound to the env var `DATA_EXPLORER_DB_PASSWORD`. The migration writer is responsible for not echoing the password to logs. Operators set the env var in `.env`; the value is documented in `docs/ops-runbook.md`.

### 6.2 Connection

A second async engine sits next to the primary one:

```
backend/src/numio/db/explorer_session.py
  explorer_engine        — read-only engine
  ExplorerSessionLocal   — async_sessionmaker
  get_explorer_session() — FastAPI dependency
```

Built from `settings.data_explorer_database_url`. If unset, it is derived from `database_url` by replacing the userinfo with `numio_readonly:${DATA_EXPLORER_DB_PASSWORD}`.

Pool size: small (default 5). Data Explorer is interactive and low-volume.

Each request opens a session, sets the per-session statement timeout via `SET LOCAL statement_timeout = '<ms>ms'`, runs the query, and closes the session. The session is never used to write.

### 6.3 Why no app-level guard

Two reasons:

1. Postgres already knows what is and is not a read. Reimplementing that with a SQL parser is brittle (CTEs, comments, `WITH ... INSERT ... RETURNING`, `SELECT ... FOR UPDATE`).
2. A misclassification has direct cost: either the operator is blocked from a legitimate query, or a write slips through. Neither is acceptable. Postgres role grants are the right boundary.

## 7. Operational defaults

| Setting | Env var | Default |
|---|---|---|
| Statement timeout | `DATA_EXPLORER_STATEMENT_TIMEOUT_MS` | `10000` (10 s) |
| Row cap | `DATA_EXPLORER_MAX_ROWS` | `1000` |
| Max SQL length | `DATA_EXPLORER_MAX_SQL_BYTES` | `51200` (50 KB) |
| Read-only role password | `DATA_EXPLORER_DB_PASSWORD` | none — must be set in any env where the role exists |
| Read-only DSN override | `DATA_EXPLORER_DATABASE_URL` | empty — derived from `DATABASE_URL` |

The row cap is enforced server-side using a hard `LIMIT max_rows + 1` wrapper, or by reading at most `max_rows + 1` rows from the cursor. If the extra row exists, `truncated = true` and only the first `max_rows` are returned.

The frontend never enforces the cap.

## 8. Role gating

- Backend: every Data Explorer endpoint depends on `require_role("admin")`. Non-admins receive `403`.
- Frontend: the `Data Explorer` nav entry only renders when `auth.role === "admin"`. Direct navigation to `/data-explorer` by a non-admin shows an "Admin only" page (consistent with other admin-gated screens).
- Dev mode (`AUTH_ENABLED=false`): the synthetic admin (`admin@localhost`, role `admin`) passes both checks. No extra setup.

## 9. UI layout

Single page at `/data-explorer`. Two-column layout — editor and results on the left, saved-queries panel on the right:

```
┌────────────────────────────────────────────────┬──────────────────────────┐
│ Data Explorer            ⌘/Ctrl+Enter to run   │ Saved queries  [Save▸]   │
│ ┌──────────────────────────────────────────┐   │ ┌──────────────────────┐ │
│ │  SQL editor (monospace <textarea>)       │   │ │  Pending May 2026    │ │
│ └──────────────────────────────────────────┘   │ │  Run · Rename · Del  │ │
│ [ ▶ Run ]                                      │ │                      │ │
│ ─────────────────────────────────────────────  │ │  Cost by service…    │ │
│ 1234 rows · 42 ms  ⚠ Result truncated to 1000  │ │  Run · Rename · Del  │ │
│ ┌──────────────────────────────────────────┐   │ └──────────────────────┘ │
│ │  Result table (columns, rows)            │   │                          │
│ └──────────────────────────────────────────┘   │                          │
└────────────────────────────────────────────────┴──────────────────────────┘
```

Behaviour:

- **Run** button (or `⌘/Ctrl + Enter` in the editor) calls `POST /query`. While in flight, the button label switches to "Running…" and is disabled.
- **Result table** — columns from `columns`, rows from `rows`. `null` renders as a muted `NULL`. Numbers, decimals, dates render as their `String()` form (no client-side reformatting — the operator is debugging the raw row).
- **Truncation indicator** — when `truncated`, a yellow banner above the table reads "Result truncated to {row_count} rows. Refine the query (LIMIT, WHERE) to see more." The banner is visible, not subtle.
- **Errors** — backend errors render in a red panel above the editor footer with the message verbatim, prefixed with `{HTTP_STATUS} · {hint} ({error_code})`. Hints: 400 Invalid SQL · 403 Permission denied · 408 Statement timeout · 413 Query too large · 422 Validation error.
- **Saved queries panel** — list of names with optional descriptions; each row has inline **Run / Rename / Delete** buttons. **Run** loads the SQL into the editor *and* executes it (a single click is enough to reproduce a saved investigation). **Delete** confirms via `window.confirm` before deleting.
- **Save current** — the panel header has a `Save current` button that opens an inline `name` + `description` form and calls `POST /queries`. On `409`, the form shows the backend's collision message verbatim.
- **Empty state** — when there are no saved queries, the panel reads "No saved queries yet."

Out of MVP: syntax highlighting (we use a plain `<textarea>` with monospace), schema browser, autocompletion, query history, export.

### 9.1 Deviations from the original wireframe

The spec's first wireframe placed saved queries on the **left**. The implementation moved them to the **right** so the editor and result table get the dominant horizontal space. Functionality and acceptance criteria are unchanged.

## 10. Worked example — May 2026 `-$2 pending` Overview tile

This is the investigation that motivated the Data Explorer. It is recorded here so a future operator can reproduce the methodology against any "this number looks wrong" UI tile.

**Question.** On 2026-05-04 the Overview "Total Spend" tile read `-$2.96` for the May 2026 month-to-date period, with no further breakdown. Is this a real credit, a UI rounding artefact, or a data bug in CUR ingestion?

**Saved query.** `overview_pending_breakdown_by_month` — splits each month's total into `line_item_type` buckets:

```sql
SELECT billing_period,
       line_item_type,
       COUNT(*) AS rows,
       ROUND(SUM(unblended_cost)::numeric, 4) AS total_usd
FROM cost_records
GROUP BY billing_period, line_item_type
ORDER BY billing_period, line_item_type;
```

**Result.** Run via the Data Explorer against the dev worktree's `cost_records` (53,510 rows, Nov 2025 → May 2026):

| billing_period | line_item_type | rows  | total_usd |
|----------------|----------------|-------|-----------|
| 2025-11-01     | Usage          | 355   |    0.6597 |
| 2025-11-01     | Tax            | 8     |    0.0000 |
| 2025-12-01     | Usage          | 598   |    2.0389 |
| 2025-12-01     | Tax            | 3     |    0.0000 |
| 2026-01-01     | Usage          | 14718 |    2.6933 |
| 2026-01-01     | Credit         | 1326  |  -20.6505 |
| 2026-02-01     | Usage          | 27485 |    5.8926 |
| 2026-02-01     | Credit         | 1169  |  -32.1333 |
| 2026-03-01     | Usage          | 4662  |    3.3692 |
| 2026-03-01     | Credit         | 714   |  -14.4365 |
| 2026-04-01     | Usage          | 1232  |    5.7162 |
| 2026-04-01     | Credit         | 1022  |  -11.2210 |
| **2026-05-01** | **Usage**      | **53**    | **0.0214**  |
| **2026-05-01** | **Credit**     | **165**   | **-2.9853** |

For May 2026: $0.02 of real usage + $-2.99 of credits = **net `-$2.96`** — exactly the value in the tile. Drilling into the credits (next query) shows they are spread across legitimate AWS services — EBS volumes, Secrets Manager, Public IPv4 addresses, ECR, S3 — which is the signature of AWS Free Tier credits offsetting small dev usage. The same pattern (credits exceeding usage) holds across Jan–Apr 2026.

```sql
SELECT service, usage_type,
       ROUND(SUM(unblended_cost)::numeric, 4) AS total_usd,
       COUNT(*) AS rows
FROM cost_records
WHERE billing_period = '2026-05-01' AND line_item_type = 'Credit'
GROUP BY service, usage_type
ORDER BY total_usd
LIMIT 20;
```

Top contributors: `AmazonEC2 / EBS:VolumeUsage.gp3 -$1.02`, `AWSSecretsManager / Secrets -$0.63`, regional EBS variants, `AmazonVPC / PublicIPv4:IdleAddress`, etc. — all dev-tier services on Free Tier.

**Conclusion.** The data is correct. The `-$2.96` is the **net cost** after AWS Free Tier credits, not a data bug or a sign error. The bug is in **UI presentation**: summing `unblended_cost` across `Usage + Credit` and showing the result with a "pending" label, with no breakdown, is confusing in low-usage accounts. A non-engineer reader sees a negative dollar amount on the headline and reasonably suspects an error.

**Follow-up.** [`tasks/backlog/20260504_overview_tile_pending_is_misleading_surface_usage_and_credit.md`](../../tasks/backlog/20260504_overview_tile_pending_is_misleading_surface_usage_and_credit.md) — UI fix to surface usage and credits separately on the Overview tile (or clip the headline at $0 with an explanatory tooltip). No CUR-ingestion change required.

**Reproducibility.** Any admin can open the Data Explorer, click **Run** on `overview_pending_breakdown_by_month`, and reach the same conclusion. The saved query is workspace-shared.

## 11. Open questions

None at lock time. Anything that surfaces during implementation should be raised in the corresponding task and reflected back here.
