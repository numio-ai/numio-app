# Numio backend + frontend conventions

This document pins the canonical patterns the codebase already uses. It is **descriptive, not aspirational** — every section points to a real file in the tree and explains the shape that file is in today. New work (the 15-task IA v2 / discovery / tag-writeback / CUR-regression plan) follows these patterns; PR review checks conformance against this doc.

**Rules of engagement:**

- If a new task needs a pattern this doc does not yet cover, the task adds the section before merging. Patterns crystallize as we go.
- If a section drifts from what the reference file actually does, the doc is wrong — fix the doc or fix the file; do not let them diverge silently.
- Existing code that predates a section is allowed to stay non-conforming until it has a reason to change. This doc is for new and modified surfaces, not a refactor mandate.

Table of contents:

1. [Repository pattern](#1-repository-pattern)
2. [API router pattern](#2-api-router-pattern)
3. [AuthZ pattern](#3-authz-pattern)
4. [Alembic migration pattern](#4-alembic-migration-pattern)
5. [AWS service pattern](#5-aws-service-pattern)
6. [Job pattern](#6-job-pattern)
7. [Frontend data-fetching hook pattern](#7-frontend-data-fetching-hook-pattern)
8. [Integration test pattern](#8-integration-test-pattern)

---

## 1. Repository pattern

**Reference:** `backend/src/numio/db/aws_account_repository.py`, `backend/src/numio/db/tag_policy_repository.py`.

A repository is the only allowed call site for SQLAlchemy queries against a given table. API routers and services do not write raw `select(...)` against models — they go through a repository. This is what makes workspace scoping enforceable in one place.

**Shape:**

```python
class XRepository:
    """CRUD operations for X — all queries scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: XCreate) -> X: ...
    async def list_all(self) -> list[X]: ...
    async def get_by_id(self, x_id: uuid.UUID) -> X | None: ...
    async def update(self, x_id: uuid.UUID, data: XUpdate) -> X | None: ...
    async def delete(self, x_id: uuid.UUID) -> bool: ...
```

**Required invariants:**

- Constructor takes `AsyncSession` and `workspace_id: str`. Always both. No repo is ever instantiated without a workspace.
- **Every** `select(X)` includes `X.workspace_id == self._workspace_id` in its `where` clause. Reading another workspace's data is impossible by construction.
- `get_by_id` returns `None` for both "not found" and "found but wrong workspace" — the router maps `None` → HTTP 404 without leaking which case it was.
- Methods that mutate (`create`, `update`, `delete`, status changers) commit the session and `await session.refresh(obj)`. They do not return uncommitted state.
- Soft delete: set a status field (e.g. `status="inactive"`) and commit. Hard delete is a separate method, used only where there is no audit value in keeping the row.
- Relationships are eager-loaded with `selectinload(X.children)` when the API contract includes them. Lazy loading on an async session is a bug.
- Pydantic schemas (`XCreate`, `XUpdate`) live in `backend/src/numio/schemas/<x>.py`, never in the repo file.

**Don't:**

- Don't accept `workspace_id` as a per-method argument. It is a constructor-time invariant.
- Don't return SQL row objects. Return ORM model instances (the API layer converts to Pydantic).
- Don't mix the repo's session with another session opened inside the same call path. One session per repo instance.

---

## 2. API router pattern

**Reference:** `backend/src/numio/api/tag_policies.py`.

A router exposes a thin REST surface over a repository. All non-trivial logic lives in the repo or a service module — the router parses the request, picks the right dependency, calls one repo method, and serializes the response.

**Shape:**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.db.session import get_session
from numio.db.x_repository import XRepository
from numio.schemas.x import XCreate, XListResponse, XResponse, XUpdate

router = APIRouter(prefix="/x", tags=["x"])


@router.get("", response_model=XListResponse, summary="List X")
async def list_x(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> XListResponse:
    repo = XRepository(session, str(current_user.workspace_id))
    items = await repo.list_all()
    return XListResponse(
        items=[XResponse.model_validate(i) for i in items],
        count=len(items),
    )


@router.post("", response_model=XResponse, status_code=201)
async def create_x(
    body: XCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> XResponse:
    repo = XRepository(session, str(current_user.workspace_id))
    return XResponse.model_validate(await repo.create(body))


@router.delete("/{x_id}", status_code=204)
async def delete_x(
    x_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin", "editor")),
    session: AsyncSession = Depends(get_session),
) -> None:
    repo = XRepository(session, str(current_user.workspace_id))
    if not await repo.delete(x_id):
        raise HTTPException(status_code=404, detail="X not found")
```

**Required invariants:**

- `APIRouter(prefix="/<resource>", tags=["<resource>"])`. Prefix is the resource noun, plural where appropriate. No `/api/v1` here — that's added at app-mount time.
- Every endpoint takes `session: AsyncSession = Depends(get_session)` and a user dependency (see §3).
- Repository is instantiated **inside the endpoint**, never at module scope.
- `current_user.workspace_id` is a `uuid.UUID`; the repo wants a `str`. Cast once: `str(current_user.workspace_id)`.
- 404 for missing entity is a one-liner: `if obj is None: raise HTTPException(status_code=404, detail="X not found")`.
- Response models are explicit (`response_model=...`) and converted via `Model.model_validate(orm_obj)`.
- Status codes are explicit on `POST` (201) and `DELETE` (204). `GET` and `PUT` default to 200.

**Don't:**

- **No module-level mutable state.** No `_BADGES: dict = {}`, no `_RULES: dict = {}`. Module-level state is a defect — it vanishes on restart and is shared across workspaces. The 15-task plan exists in large part to eradicate this pattern. The router state is the database, full stop.
- Don't catch exceptions to translate them to HTTP codes for "expected" failure paths — return `None` from the repo and let the router raise. Reserve `except` for genuinely unexpected I/O failures.
- Don't build response objects from raw `dict`s — use the Pydantic response schema. It's the contract.

---

## 3. AuthZ pattern

**Reference:** `backend/src/numio/core/auth.py:257-317`.

Two dependencies cover 95% of needs:

- `get_current_user` — any authenticated user (admin, editor, viewer). Use for reads and per-user mutations (e.g. acking your own finding, saving your own view).
- `require_role("admin", "editor")` — write operations that affect workspace-level state (creating policies, registering accounts, changing autopilot rules).

**Workspace scoping is enforced at the repository layer, not the router layer.** The router passes `current_user.workspace_id` into the repo constructor; the repo's queries are scoped from then on. Routers never write `where(workspace_id=...)` themselves.

**Ownership checks** (e.g. "only the owner can delete a saved view") happen in the repository, by comparing the row's `owner_user_id` field to a `user_id: uuid.UUID` argument passed in alongside the entity id. The router supplies `current_user.id`. Returning `None` means "not found OR not yours" — the router maps that to 404, deliberately not 403 (don't leak existence).

**Auth bypass** (`AUTH_ENABLED=false`, the local-dev default) returns a synthetic `admin@localhost` user from the `workspaces.slug='default'` row. All endpoints work identically — the dependency just resolves to a different user. This is why tests can run without any session cookie or API key (see `backend/tests/conftest.py:5-6`).

**Don't:**

- Don't call `get_current_user` or `require_role` from inside a service or repository. Auth is router-level.
- Don't accept a `workspace_id` query parameter. Workspace is implicit from the user.
- Don't conditionally enforce role checks inside an endpoint body. Pick the right dependency and let FastAPI do it.

---

## 4. Alembic migration pattern

**Reference:** `backend/alembic/versions/a7b8c9d0e1f2_data_explorer_saved_queries.py`.

**Shape of a new-table migration:**

```python
"""<title>

Revision ID: <12-hex-chars>
Revises: <previous_revision_id>
Create Date: YYYY-MM-DD
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "..."
down_revision: Union[str, Sequence[str], None] = "..."
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "x_table",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        # ... domain columns ...
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_x_table_workspace_id", "x_table", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_x_table_workspace_id", table_name="x_table")
    op.drop_table("x_table")
```

**Required invariants:**

- **Every workspace-scoped table** has `workspace_id UUID NOT NULL`, a `FK → workspaces.id ON DELETE CASCADE`, and an `ix_<table>_workspace_id` index. This is the precondition for §1 working efficiently.
- Primary key is a UUID column; the application generates it (or relies on the model's default).
- `created_at` / `updated_at` are `DateTime(timezone=True)` with `server_default=sa.func.now()`.
- Composite unique constraints across `(workspace_id, name)` (or similar) live as a `unique=True` index, so they're droppable in `downgrade` without juggling table-level constraints.
- `downgrade` is **symmetric** with `upgrade` — drop in the reverse order. A migration without a working downgrade is a one-way ratchet and a defect.
- Idempotency: the migration runs at most once per environment (alembic ensures this). Don't add `IF NOT EXISTS` — that hides bugs where a manual schema change drifted from the migration history.
- File naming: `<rev_id>_<short_snake_case_title>.py`. The rev id is the alembic-generated 12-hex-char string.

**For role/grant migrations** (e.g. the Data Explorer `numio_readonly` role at `f1a2b3c4d5e6_data_explorer_readonly_role.py`): use `op.execute("...")` with `CREATE ROLE IF NOT EXISTS` (Postgres 16+) or a `DO $$ ... $$` block. These are the only place `IF NOT EXISTS` is allowed, because role state is shared across databases.

**Don't:**

- Don't write data migrations and schema migrations in the same revision. Schema first, then a separate revision that backfills.
- Don't add columns with `NOT NULL` and no default to a non-empty table. Either add nullable, backfill, then set NOT NULL in a follow-up — or add with a server-default.
- Don't reference Python model classes from inside a migration. Migrations use raw `sa.Column` definitions so they survive when the model file is later renamed or deleted.

---

## 5. AWS service pattern

**Reference:** `backend/src/numio/core/aws_service.py:438-488`, `backend/src/numio/core/resource_inventory_service.py:94-167`.

Every call into AWS from Numio backend goes through two helpers:

1. `assume_role_for_account(account) -> (ok: bool, err: str | None, creds: dict | None)` — uses the account's stored `aws_access_key_id` / `aws_secret_access_key` + `role_arn` + `external_id` to call STS AssumeRole. Returns short-lived (15-minute) credentials.
2. `_get_session(credentials) -> boto3.Session` — wraps the temp creds into a boto3 session that the caller uses to make `boto_session.client("ec2", region_name=...)` etc.

**Canonical call sequence:**

```python
from numio.core.aws_service import assume_role_for_account, _get_session as get_boto_session

ok, err, creds = assume_role_for_account(account)
if not ok:
    raise RuntimeError(f"STS AssumeRole failed for {account.aws_account_id}: {err}")

boto_session = get_boto_session(creds)
client = boto_session.client("ec2", region_name=region)
```

**Required invariants:**

- **Never** use `validate_connectivity(role_arn)` for data pipelines. It is a connectivity-test helper that falls back to the host's default credential chain (env / `~/.aws`) when the customer's stored creds aren't available — which silently uses the wrong credentials on a developer laptop. This historically caused CUR ingestion to fail with `Unable to locate credentials`. Always use `assume_role_for_account(account)` for ingestion / discovery / mutation paths.
- One AssumeRole call per account per job invocation. Credentials are short-lived (15 min); long-running jobs that exceed that re-assume.
- `ClientError` from boto3 is caught **per region** and per service, with `error_code` inspected to decide skip vs. raise (`AuthFailure` / `OptInRequired` / `InvalidClientTokenId` → skip the region; others → log and continue). See `resource_inventory_service.py:136-154` for the canonical handler.
- Pagination uses boto3 paginators (`client.get_paginator("list_...")`), not manual `NextToken` loops.

**Throttling / backoff** — boto3's default retry config handles transient throttling. For broad-fanout discovery (RGTA across regions, the new C1/C2 enrichers), prefer **per-region serial execution within an account** to widen the time gap between calls, rather than parallelism with backoff. If a future workload genuinely needs explicit backoff, add a helper to `aws_service.py` and document it here — do not sprinkle `time.sleep` calls into individual services.

**Writes to AWS** (tag mutations from Workstream D): same assume-role pattern, plus the per-call constraints of the target API. For `resourcegroupstaggingapi.tag_resources`: max 20 ARNs per call, max 50 tags per resource. The write service batches before calling.

**Don't:**

- Don't hold a boto3 client at module scope — clients are tied to credentials and credentials expire.
- Don't pass `account.role_arn` into helpers that build their own boto3 session from defaults. Pass the `AwsAccount` row itself.
- Don't catch every `Exception` around an AWS call and swallow it. Catch `ClientError` for known retryable / skippable cases; let unknown failures propagate to the runner so the job is marked failed for that account (see §6).

---

## 6. Job pattern

**Reference:** `backend/src/numio/jobs/runner.py`, `backend/src/numio/core/cur_service.py:52-139`, `backend/src/numio/core/resource_inventory_service.py:55-91`.

The runner orchestrates a job across all eligible accounts; the service does the per-account work.

**Service entry point — the contract:**

```python
async def x_job(account_id: str) -> int:
    """Entry point for the job runner.

    Creates its own DB session for per-account isolation. Returns total records upserted.
    """
    async with AsyncSessionLocal() as session:
        return await _run_x(account_id, session)
```

That's the entire signature the runner expects: `async (account_id: str) -> int`. The integer is the per-account record count and lands in `JobRunAccount.record_count`.

**Required invariants:**

- The service owns its own session via `AsyncSessionLocal()`. It does not borrow the runner's session.
- The service **must call `await session.commit()` before returning.** Two separate historical CUR regressions were caused by missing this line. The `async with` context manager closes the session without committing — your data vanishes silently. The runner's session, which writes `ingestion_statuses` and `job_run_accounts`, commits independently; that's why the runner reports `success` while `cost_records` stays empty. See `cur_service.py:133-138` for the comment that pins this.
- Per-account isolation is the runner's job, not the service's: the service may raise any exception, and the runner records it as a per-account failure without blocking other accounts.
- Job types (the string `"cur_ingestion"`, `"resource_inventory_sync"`, etc.) are stable identifiers used by `JobRun.job_type`, the `/api/v1/jobs/<type>/trigger` endpoint, and the worker scheduler. Adding a new job means: (a) write the service entry point, (b) register it in the worker's scheduler, (c) document the IAM permissions it needs.

**Eligibility:** the runner pulls accounts with `status IN ('connected', 'incomplete')` from the workspace. `disconnected` / `inactive` accounts are skipped. See `runner.py:35`.

**Workspace resolution:** the runner can be called with an explicit `workspace_id`, or it falls back to the default workspace via `_get_default_workspace_id(session)` which looks up `workspaces.slug='default'`. Services that need the workspace_id inside their own session do the same lookup; do not pass it around as a parameter from the runner — it's implicit in the account.

**Don't:**

- Don't share a session between the runner and the service. Each owns its own.
- Don't catch your own exceptions and translate them to a "soft" success. The runner needs to see the exception to record the failure correctly.
- Don't read AWS data and write to the DB from inside the same async session block without intermediate commits if the AWS call is long. A 10-minute AssumeRole window can outlive a transaction holding row locks.

---

## 7. Frontend data-fetching hook pattern

**Reference:** `frontend/src/pages/Settings/Integrations.jsx:318-329`, `frontend/src/api/tagGovernance.js`.

**API clients** live in `frontend/src/api/<area>.js`. They export named async functions, each calling a tiny `request(path, options)` helper that:

- Prepends `import.meta.env.VITE_API_URL` (Docker builds) or `""` (Vite dev proxy).
- Sets `Content-Type: application/json` + `credentials: "include"` (for the session cookie).
- Throws `Error("API <status>: <body>")` on non-2xx so the page-level catch can show it.
- Returns `null` for 204, otherwise `res.json()`.

**Pages** consume these via `useCallback` + `useEffect`:

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

const loadData = useCallback(async () => {
  try {
    const result = await listX();
    setData(result);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { loadData(); }, [loadData]);
```

**Required invariants:**

- Three useState slots minimum: `data` / `loading` / `error`. The empty initial state (`null`, `true`, `null`) is the canonical "not yet fetched."
- The loader is a `useCallback` so children can call `loadData()` again after a mutation (re-fetch on success).
- `loading` starts `true` and goes `false` in `finally`, win or lose. Never leave the page spinning on an error.
- API errors render inline with the message from `e.message` (which is `API <status>: <body>` from the request helper). Don't swallow.
- Empty arrays render the empty-state UI explicitly, not "still loading." `data === null && loading` is loading; `Array.isArray(data) && data.length === 0` is empty.

**No global store, no react-query, no SWR for now.** The codebase is consistent at this level — keep it that way. If a page needs cross-component sync (e.g. ingestion status banner reflecting a job started elsewhere), that's a `Context` (see `frontend/src/context/IngestionStatusContext.jsx`), not a fetching library.

**Don't:**

- Don't put `fetch(...)` calls inline in components. Route through `frontend/src/api/<area>.js`.
- Don't catch fetch errors and silently fall back to mock data. The error state is part of the contract.
- Don't omit `credentials: "include"` — without it the session cookie isn't sent and auth-enabled environments break.

---

## 8. Integration test pattern

**Reference:** `backend/tests/conftest.py`, `backend/tests/test_cur_ingestion.py`.

Numio's test strategy is **integration-tested against a real Postgres, mock-where-it-touches-the-outside-world** (AWS, LLM APIs, S3). Pure unit tests are reserved for helpers that don't touch I/O.

**Fixture hierarchy** (from `conftest.py`):

- `_setup_test_database` (session, autouse) — drops `numio_test`, creates it fresh, drops at session end.
- `_engine` (session) — async engine, runs `Base.metadata.create_all`, seeds the `default` workspace.
- `db_session` (function) — opens a transaction; yields a session bound to it; rolls back on test exit. Tests never see each other's data.
- `default_workspace_id` (function) — returns the seeded `default` workspace's UUID. Auth-bypass routes resolve to this workspace.
- `workspace_factory` / `user_factory` — for tests that need multiple workspaces or users.
- Domain factories (e.g. `account_with_cur` in `test_cur_ingestion.py:294-311`) — created in the test file, not in `conftest.py`. They flush, do not commit (the outer transaction rolls back).

**Test shape:**

```python
@pytest.mark.asyncio
async def test_creates_x(db_session, default_workspace_id):
    repo = XRepository(db_session, default_workspace_id)
    item = await repo.create(XCreate(name="t"))
    assert item.id is not None
    assert item.workspace_id == uuid.UUID(default_workspace_id)
```

**Required invariants:**

- `AUTH_ENABLED=false` is set at the top of `conftest.py:5-6` so the bypass admin is used; tests do not deal with cookies / API keys.
- Tests marked `@pytest.mark.asyncio`. We use `pytest-asyncio` in auto mode (configured in `pyproject.toml`).
- AWS calls are mocked at the boto3 client level using `unittest.mock.MagicMock` — see the `_make_s3_parquet_mock` pattern in `test_cur_ingestion.py:315-328`. No `moto` server. No real AWS credentials in tests.
- Parquet / file fixtures are generated in-memory (`_make_cur_parquet` in `test_cur_ingestion.py:35-57`). No binary fixture files checked into the repo.
- Workspace isolation is asserted explicitly when the surface allows cross-workspace queries (e.g. "user in workspace A cannot see X created in workspace B"). One repo test in every PR should include this assertion when applicable.
- Job tests that exercise `runner.run_job(...)` use a real `AsyncSession` (the `db_session` fixture) — the runner is the source of truth for `JobRun`/`JobRunAccount` rows.

**Don't:**

- Don't use `sqlite::memory:` as a test DB. Production is Postgres; behavior diverges on JSONB, `ON CONFLICT`, and timezone handling.
- Don't share state between tests via module-level dicts. If a fixture must yield mutable state, scope it `function`.
- Don't mock the repository in a router test. The whole point of the integration tier is that the router → repo → DB path is exercised.

---

## Adding a section

When a new task discovers it needs a pattern not covered here:

1. Land the code with whatever pattern made sense locally.
2. Add the section to this file in the same PR, describing what landed and why.
3. Reference the new file as the canonical example.
4. If the new pattern obsoletes an existing one, mark the old section deprecated; don't silently overwrite it — the historical guidance matters for code that hasn't been touched yet.
