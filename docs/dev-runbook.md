# Numio Developer Guide

## Prerequisites

- Node.js 20+
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Docker (required — runs PostgreSQL and Valkey as containers)
- [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanner, required by the git pre-commit hook — `brew install gitleaks`)

Use the `numio-dev.sh init` command as shortcut to install dependencies for frontend and backend before starting the development environment.

---

## Secret scanning (git pre-commit hook)

Every commit is scanned for secrets (keys, tokens, passwords) by gitleaks via the committed hook [`.githooks/pre-commit`](../.githooks/pre-commit). A finding aborts the commit. The hook is fail-closed: if gitleaks is not installed, the commit is refused with install instructions.

Enrollment is per-checkout: `./scripts/numio-dev.sh init` enrolls it by setting `git config core.hooksPath .githooks`. For any checkout that hasn't run `init`, enroll manually:

```bash
git config core.hooksPath .githooks
```

For a deliberate false positive (e.g. a documented dummy credential), append a `# gitleaks:allow` comment on the flagged line.

Note: this is a client-side control only — `git commit --no-verify` bypasses it, and it protects nothing until a checkout is enrolled. A hard guarantee requires server-side scanning (CI or pre-receive), which is out of scope here.

---

## First-time worktree setup

Each git worktree runs its own isolated stack (Postgres volume, Compose project, port allocation — see `.numio/worktree.env`). Database state is not shared between worktrees. A fresh worktree needs four steps in order before the app will serve authenticated traffic:

```bash
./scripts/numio-dev.sh init            # 1. install frontend + backend deps
./scripts/numio-dev.sh run infra       # 2. start postgres + valkey containers
./scripts/numio-dev.sh migrate         # 3. apply alembic migrations
./scripts/numio-dev.sh seed            # 4. insert the default workspace row
./scripts/numio-dev.sh run all         # 5. start backend + frontend + worker
```

Steps 3 and 4 are **mandatory** and are **not run automatically** by `run all`. `numio-dev.sh` does not mutate application data on its own; the operator keeps full control of environment state. If you skip them, the backend starts but `GET /api/v1/auth/me` returns HTTP 500 in bypass mode — the frontend then falls back to the login page and shows *"Cognito is not configured"*. See [Authentication in local dev](#authentication-in-local-dev).

`./scripts/numio-dev.sh nuke -y` destroys this worktree's stack and volume; after `nuke`, rerun steps 2 → 4 before `run all`.

### Data Explorer read-only role

The Data Explorer feature uses a dedicated Postgres role `numio_readonly` with `SELECT`-only grants. It is provisioned by alembic migration `f1a2b3c4d5e6` (run as part of `./scripts/numio-dev.sh migrate`). The role's password is taken from `DATA_EXPLORER_DB_PASSWORD` (default `numio_readonly` for local dev). Override in any non-local environment via `backend/.env` or the deployment env.

To rotate the password after the migration has already run, re-run the migration's upgrade SQL with the new value or `ALTER ROLE numio_readonly WITH PASSWORD '...'` directly — the migration is idempotent.

---

## Authentication in local dev

The backend defaults to `AUTH_ENABLED=false` in local dev. In this mode every request is served by a **synthetic admin** (`admin@localhost`), no Cognito user pool is contacted, and the frontend never needs to render the Login page.

The flow:

1. On mount, the frontend calls `GET /api/v1/auth/me`.
2. The backend resolves the synthetic admin by reading the row `workspaces.slug = 'default'` (see `backend/src/numio/core/auth.py`).
3. `AuthContext` marks the user as authenticated; `/` redirects to `/overview`.

Because step 2 queries the `workspaces` table, both the migration and the default-workspace seed must be applied before the first login. That is what the *First-time worktree setup* SOP above guarantees.

### Verify bypass mode is working

```bash
./scripts/numio-dev.sh ports            # find this worktree's backend port
curl -fsS "http://localhost:${BACKEND_HOST_PORT}/api/v1/auth/me" | python3 -m json.tool
```

Expected output:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "email": "admin@localhost",
  "name": "Local Admin",
  "role": "admin",
  "is_active": true
}
```

HTTP 200 and the JSON above mean bypass mode is working end-to-end. Any 4xx/5xx, or a redirect to `/login` in the browser, means the SOP above was not completed for this worktree — most often the `seed` step.

### Frontend Cognito configuration

None is required in bypass mode. For the Cognito-enabled flow (`AUTH_ENABLED=true`), copy `frontend/.env.example` to `frontend/.env.local` and fill in `VITE_COGNITO_DOMAIN` / `VITE_COGNITO_CLIENT_ID`. The example file documents each `VITE_*` variable and when it is required.

---

## Frontend mock mode

The frontend can run the entire UI from generated synthetic data with **no backend, no database, and no AWS connectivity** — for a standalone customer demo and for deterministic tests. One build-time switch, `VITE_API_MODE` (`mock` | `real`, default `real`), selects the data source for the whole app. No application source changes between modes; the mock/real decision lives in one place, the shared API client `frontend/src/api/client.js`.

Design contract: [`docs/frontend/mock-backend-spec.md`](frontend/mock-backend-spec.md).

### Run the app in mock mode (no backend)

Use the `--mock` flag on `numio-dev.sh run` — it starts the frontend with `VITE_API_MODE=mock` and needs no backend, Postgres, or AWS account:

```bash
./scripts/numio-dev.sh run frontend --mock
```

Open the printed URL. The app authenticates as a synthetic admin and every screen renders from synthetic data in `frontend/src/mocks/`.

Do **not** edit `.env.example` to switch modes — Vite does not load it, and the build default comes from the `define` block in `frontend/vite.config.js` (an unset value compiles to `real`). For a one-off static demo bundle, build with the variable set: `VITE_API_MODE=mock npm run build` from `frontend/`.

### Switch back to the real backend

Run the app normally without `--mock` (`./scripts/numio-dev.sh run all`). With `VITE_API_MODE` unset it compiles to `real`, the identical source talks to the backend, and the mock layer is tree-shaken out of the build.

### How mock mode relates to tests

The same mock layer backs deterministic tests:

- **Vitest** component tests opt into the seam with the `frontend/src/test/mockMode.js` helper (`enableMockMode()`), asserting on mock-served data with no network. Runs under `npm test`.
- **Puppeteer** end-to-end: `cd frontend && npm run test:e2e` starts a mock-mode dev server with no backend and drives key screens, exiting non-zero on failure.

### Where the mock layer lives

- Synthetic data + the seeded generator and canonical entities: [`frontend/src/mocks/`](../frontend/src/mocks/) (the deterministic substrate is under `frontend/src/mocks/synthetic/`).
- Per-domain mock request handlers and the dispatch registry: `frontend/src/api/mock/`.

---

## Daily Workflow

### Start development

Run backend and frontend in separate terminals. Infrastructure (PostgreSQL, Valkey) starts automatically.

```bash
# Terminal 1: Backend (auto-starts postgres + valkey)
./scripts/numio-dev.sh run backend

# Terminal 2: Frontend
./scripts/numio-dev.sh run frontend
```

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173/ |
| Backend API | http://localhost:8000/ |
| Health check | http://localhost:8000/health |
| MCP endpoint | http://localhost:8000/mcp |

Or start everything at once (services run in the background, your terminal returns immediately):
```bash
./scripts/numio-dev.sh run all
./scripts/numio-dev.sh log -f          # follow output (Ctrl-C to stop tailing)
./scripts/numio-dev.sh status          # check what's running
```

`run all` opens your default browser to the frontend URL once Vite is ready (macOS only — other platforms just print the URL). Suppress with `--no-browser`, `NUMIO_NO_BROWSER=1`, or a non-interactive shell (`CI=1` or non-TTY stdout):
```bash
./scripts/numio-dev.sh run all --no-browser     # start without launching the browser
NUMIO_NO_BROWSER=1 ./scripts/numio-dev.sh run all
```

### Stop

```bash
./scripts/numio-dev.sh stop backend        # stop one component
./scripts/numio-dev.sh stop all            # stop everything
```

### Check status

```bash
./scripts/numio-dev.sh status
```

Output:
```
Worktree stack:
  project=numio-app-083a78
  backend=50786          http://localhost:50786       (health: /health, docs: /docs)
  frontend(dev)=50788    http://localhost:50788
  postgres=50784         localhost:50784
  valkey=50785           localhost:50785

COMPONENT    MODE       STATUS     DETAILS
postgres     container  running    numio-postgres
valkey       container  running    numio-valkey
backend      native     running    PID 12345
frontend     native     stopped    -
worker       native     stopped    -
```

The header prints each service with a clickable URL so you don't have to assemble `http://localhost:<port>` by hand — useful because per-worktree ports change between checkouts. The `name=port` tokens are preserved for any scripts that grep them.

### View logs

`log` shows the last 200 lines and exits. Add `-f` / `--follow` to stream. Output is safe to pipe through `grep`, `head`, or `less` without `2>&1`.

```bash
./scripts/numio-dev.sh log backend         # last 200 lines from backend, exit
./scripts/numio-dev.sh log                 # last 200 lines from every component
./scripts/numio-dev.sh log -f backend      # follow backend (Ctrl-C to stop)
./scripts/numio-dev.sh log worker | grep ERROR   # filter safely — no stderr leak
```

### Restart

```bash
./scripts/numio-dev.sh restart backend     # soft restart (keep state)
./scripts/numio-dev.sh rebuild infra       # hard restart (rebuild containers, re-migrate)
```

### Database migrations

After pulling new code that includes migration files, or after rebuilding infrastructure from scratch, run this command to apply the migrations.

```bash
./scripts/numio-dev.sh migrate
```

`migrate` is worktree-aware: it applies migrations to this worktree's Postgres (not to a sibling worktree's, even if that sibling holds port 5432). Immediately after `migrate` on a fresh volume, run `./scripts/numio-dev.sh seed` once to insert the default workspace row — see [First-time worktree setup](#first-time-worktree-setup).

### Health check

```bash
./scripts/numio-dev.sh health
```

## Troubleshooting

### Frontend shows "Cognito is not configured" warning

Symptom: opening the frontend in bypass mode lands on the Login page with a yellow banner:

> Cognito is not configured. Set AUTH_ENABLED=false in the backend to use bypass mode, or configure VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.

Cause: `GET /api/v1/auth/me` is not returning the synthetic admin, so `AuthContext` treats the user as unauthenticated and redirects to `/login`. The warning itself is the fallback UI — the real failure is upstream.

By far the most common trigger in local dev is an incomplete first-time worktree setup: migrations or the default-workspace seed were skipped, so `workspaces.slug = 'default'` does not exist and bypass-mode resolution crashes with HTTP 500.

Fix — run the full SOP for this worktree:

```bash
./scripts/numio-dev.sh run infra
./scripts/numio-dev.sh migrate
./scripts/numio-dev.sh seed
./scripts/numio-dev.sh restart backend
```

Then verify bypass mode with the `/api/v1/auth/me` check in [Authentication in local dev](#authentication-in-local-dev).

If `/me` still fails with HTTP 500, read the backend log (`./scripts/numio-dev.sh log backend`) and look for the first traceback — typical causes are a missing migration (`UndefinedTable`), a wrong `DATABASE_URL` (backend pointing at a sibling worktree's Postgres), or `AUTH_ENABLED` unexpectedly set to `true` without Cognito configured.

### Worker appears healthy but no data lands in the database

Symptom: the worker process is running, logs show `Scheduler started. Worker is running.`, but `cost_records` stays empty and dashboards show no cost data.

Work through these checks in order.

#### 1. Is the worker process up and the scheduler running?

In local dev, worker output is written to `.numio/logs/worker.log` (see `./scripts/numio-dev.sh log worker`). You should see:

- `Database connection verified.`
- `Registered N job types.`
- A `Scheduled job <name> every <N> seconds.` line for each job (including `cur_ingestion`, which runs once per day by default).
- `Scheduler started. Worker is running.`

If those lines are missing, the worker did not start cleanly.

#### 2. Are jobs actually running?

**Via the API (recommended first check)**

1. Confirm the backend is up: `./scripts/numio-dev.sh health` (or open `http://localhost:8000/health` in a browser).
2. From a terminal, call the jobs endpoints. Base URL in local dev is `http://localhost:8000/api/v1` (see [API Usage Guide](api-guide.md)).

With **auth disabled** (default in local dev: `AUTH_ENABLED=false` in the backend environment), no headers are required — every request is treated as an admin user:

```bash
curl -fsS "http://localhost:8000/api/v1/jobs/history?limit=20" | python3 -m json.tool

curl -fsS "http://localhost:8000/api/v1/jobs/ingestion-status" | python3 -m json.tool
```

If `curl` fails with HTTP 401/403, authentication is enabled. Then either:

- Pass an API key: `curl -fsS -H "X-API-Key: <your-key>" "http://localhost:8000/api/v1/jobs/history?limit=20"`, or
- Use the interactive docs at `http://localhost:8000/docs` — click **Authorize**, authenticate if prompted, then **Try it out** on `GET /api/v1/jobs/history` and `GET /api/v1/jobs/ingestion-status`.

What to look for in the JSON: `runs[]` with `job_type`, `status`, `account_results[]` (per-account `record_count` and errors); or `statuses[]` with `data_source`, `last_sync_at`, `last_status`, `record_count`.

**Via the database**

Or query the database directly:

```bash
docker exec -it numio-postgres psql -U numio -d numio
```

```sql
SELECT job_type, status, started_at, finished_at,
       left(coalesce(error_details,''), 120) AS err
FROM job_runs
ORDER BY started_at DESC
LIMIT 20;
```

Interpretation:

- **No rows** — nothing has been scheduled yet. Daily jobs only fire after their interval from worker start; use an on-demand trigger (step 5) to verify.
- **Many rows with `status = 'skipped'`** — go to step 3.
- **`failure` or `partial`** — go to step 4.

#### 3. Runs are always `skipped`

The job runner picks up accounts whose `aws_accounts.status` is `connected` or `incomplete` (see `backend/src/numio/jobs/runner.py`). Accounts in `disconnected` (credentials or role validation failed) or `inactive` (soft-deleted) are excluded.

Check:

```sql
SELECT aws_account_id, alias, workspace_id, status FROM aws_accounts;
SELECT id, slug FROM workspaces;
```

You need at least one account in the default workspace (slug `default`) in `connected` or `incomplete` state. If every account is `disconnected`, re-run validation from **Settings → Integrations** in the UI or `POST /api/v1/accounts/{id}/validate` — fix the credentials/role issue reported by the validation steps rather than editing `aws_accounts.status` directly.

#### 4. Runs are `failure` or `partial`

Inspect per-account errors:

```sql
SELECT jr.job_type, jra.account_id, jra.status, jra.record_count,
       left(jra.error_details, 300) AS err, jr.started_at
FROM job_run_accounts jra
JOIN job_runs jr ON jr.id = jra.job_run_id
ORDER BY jr.started_at DESC
LIMIT 20;
```

Typical `cur_ingestion` issues:

| Error signal | Likely cause |
|--------------|--------------|
| `STS AssumeRole failed` | Wrong `role_arn`, missing trust policy, or external ID mismatch. |
| `Account … not found` | Account not present in the default workspace. |
| Success with `record_count = 0` and logs mentioning CUR not configured | Missing `cur_s3_bucket`, `cur_s3_prefix`, or `cur_report_name` on the account. |
| S3 `AccessDenied` / `NoSuchBucket` | Bucket name or IAM permissions for the reader role. |
| Parquet / manifest errors | CUR export layout does not match what the ingestor expects under `{prefix}/metadata/BILLING_PERIOD=.../`. |

#### 5. Force a run instead of waiting for the schedule

Requires an **admin** user (in local dev with `AUTH_ENABLED=false`, that is the synthetic bypass admin — no header needed):

```bash
curl -fsS -X POST "http://localhost:8000/api/v1/jobs/cur_ingestion/trigger" | python3 -m json.tool
```

With auth enabled, add `-H "X-API-Key: <your-key>"` or use **POST** `/api/v1/jobs/cur_ingestion/trigger` from `http://localhost:8000/docs` after authorizing. The response includes `job_run_id` and `status`.

#### 6. Confirm data landed

```sql
SELECT data_source, last_status, last_sync_at, record_count,
       left(coalesce(error_details,''), 120) AS err
FROM ingestion_statuses
ORDER BY updated_at DESC;

SELECT COUNT(*) FROM cost_records;
SELECT provider, data_source, COUNT(*) FROM cost_records GROUP BY 1, 2;
```

A recent `last_sync_at`, `last_status = 'success'`, and non-zero `record_count` for `cur_ingestion`, plus rows in `cost_records`, means ingestion from AWS (CUR in S3) into the Numio database succeeded.

### Diverging signals: job says `success` but `cost_records` is empty

If `ingestion_statuses.record_count` is non-zero but `SELECT COUNT(*) FROM cost_records` is zero, the job ran end-to-end but never committed to the `cost_records` table. This has three known historical causes, all now fixed but worth knowing when triaging regressions or new data sources:

| Symptom | Root cause | Where |
|---------|-----------|-------|
| `STS AssumeRole failed … Unable to locate credentials` | Data-pipeline code used `validate_connectivity(role_arn)`, which falls back to the host credential chain (env / `~/.aws`) instead of the account's stored `aws_access_key_id` / `aws_secret_access_key`. | `cur_service.py` now calls `assume_role_for_account(account)`. Any new ingestion service must do the same. |
| `success` but `record_count = 0`, no ingesting billing period log line | Manifest-discovery prefix didn't match the actual CUR layout. AWS ships CUR in two layouts: legacy `{prefix}/metadata/...` and Data Exports / v2 `{prefix}/{report_name}/metadata/...`. | `_list_latest_manifests` scans both. If you see zero manifests, list the bucket directly (see *Inspecting S3 directly* below) and compare against the paths the function scans. |
| Job reports records upserted, `ingestion_statuses.record_count` is high, but `cost_records` is empty | The job's own DB session was never committed — only the job-runner session that writes `ingestion_statuses` commits. | `_run_cur_ingestion` ends with `await session.commit()`. Any future ingestion service that manages its own session must commit explicitly. |

A related error that looks like a data bug but is really schema-adjacent:

- `ON CONFLICT DO UPDATE command cannot affect row a second time` — a single CUR parquet batch contains repeated `line_item_id` values (typical with amortized RI / Savings Plan allocations). `_upsert_batch` now dedupes the batch by `(data_source, line_item_id)` before upsert, keeping the last occurrence. If you see this again, do not widen the natural key without checking `models/cost_record.py` first.

### Inspecting S3 and CUR from the backend venv

Instead of configuring host AWS credentials, drive boto3 through the backend code path — it reads the account's stored credentials, assumes the role, and lets you poke at S3 directly.

> Note: always set `VIRTUAL_ENV=.venv` when using `uv run` inside `backend/` (per local convention). The bare `uv run` picks a different venv.

List the actual CUR prefix for the connected account:

```bash
cd backend
VIRTUAL_ENV=.venv uv run --active python - <<'PY'
import asyncio
from sqlalchemy import select
from numio.db.session import AsyncSessionLocal
from numio.db.aws_account_repository import AwsAccountRepository
from numio.core.aws_service import assume_role_for_account, _get_session
from numio.models.workspace import Workspace, DEFAULT_WORKSPACE_SLUG

async def main():
    async with AsyncSessionLocal() as session:
        ws = (await session.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )).scalar_one()
        repo = AwsAccountRepository(session, str(ws.id))
        # Replace with the 12-digit account ID you are debugging.
        acct = await repo.get_by_aws_account_id("123456789012")
        print("bucket:", acct.cur_s3_bucket, "prefix:", acct.cur_s3_prefix,
              "report:", acct.cur_report_name)
        ok, err, creds = assume_role_for_account(acct)
        if not ok:
            print("ASSUME FAIL:", err); return
        s3 = _get_session(creds).client("s3")
        resp = s3.list_objects_v2(Bucket=acct.cur_s3_bucket,
                                  Prefix=acct.cur_s3_prefix, MaxKeys=30)
        for o in resp.get("Contents", []):
            print(o["Key"])
asyncio.run(main())
PY
```

What you are looking for: at least one `…-Manifest.json` file under a `BILLING_PERIOD=YYYY-MM/` path segment, and sibling `…snappy.parquet` data files.

### Forcing a reload after a bad run

The incremental filter in `cur_service.py` skips billing periods whose manifest `LastModified` ≤ the last successful sync time. After a bad run that recorded `success` with zero or wrong data, clear the CUR ingestion status row before re-triggering:

```bash
docker exec numio-postgres psql -U numio -d numio -c \
  "DELETE FROM ingestion_statuses WHERE data_source='cur_ingestion';"
```

Then hit the trigger endpoint again:

```bash
curl -fsS -X POST "http://localhost:8000/api/v1/jobs/cur_ingestion/trigger" | python3 -m json.tool
```

### End-to-end verification that CUR data loaded

After a successful trigger, expect:

```sql
SELECT provider, data_source, COUNT(*) AS rows,
       MIN(billing_period) AS min_bp, MAX(billing_period) AS max_bp,
       ROUND(SUM(unblended_cost)::numeric, 4) AS total_unblended
FROM cost_records
GROUP BY 1, 2;
```

Non-zero `rows`, a billing period that matches the current or previous month, and a non-zero (positive or negative — credits are negative) total means the pipeline is end-to-end green.

---

## Testing

### Backend

```bash
cd backend && uv run pytest                    # all tests
cd backend && uv run pytest tests/test_foo.py  # single file
cd backend && uv run ruff check .              # lint
cd backend && uv run ruff format .             # format
```

### Frontend

```bash
cd frontend && npm test              # run unit tests (vitest)
cd frontend && npm run test:watch    # watch mode
cd frontend && npm run test:coverage # with coverage report
cd frontend && npm run build         # production build (catches type/bundler errors)
```

# ------------------------------------------------------------
# ------- STOP READING HERE. THE REST OF DOCUMENT REQUIRES VALIDATION. -------
# ------------------------------------------------------------

## QA Environment Setup

Set up a clean Numio environment from scratch. Every QA round should start from a clean state.

### Clean-slate setup

```bash
# 1. Clean previous state
docker compose down -v --remove-orphans
docker rmi numio-srv numio-ui 2>/dev/null || true

# 2. Install dependencies (skip if unchanged)
./scripts/numio-dev.sh init

# 3. Build and start all services in containers
docker compose up -d --build

# 4. Wait for healthy (15-30 seconds)
docker compose ps

# 5. Apply migrations + seed
./scripts/numio-dev.sh migrate
docker exec numio-postgres psql -U numio -d numio -c \
  "INSERT INTO workspaces (id, name, slug) VALUES (gen_random_uuid(), 'default', 'default') ON CONFLICT (slug) DO NOTHING;"

# 6. Verify
./scripts/numio-dev.sh health
```

Open http://localhost:3000 in the browser.

### Tear down after QA

```bash
docker compose down -v
```

### Reset mid-session

Wipe all data without rebuilding images:
```bash
docker compose down -v
docker compose up -d
sleep 10
./scripts/numio-dev.sh migrate
docker exec numio-postgres psql -U numio -d numio -c \
  "INSERT INTO workspaces (id, name, slug) VALUES (gen_random_uuid(), 'default', 'default') ON CONFLICT (slug) DO NOTHING;"
```

### Notes for QA

- **No sample cost data.** Without AWS account configuration, dashboards show empty states with links to Settings > Integrations. QA should verify empty states render correctly.
- **Adding an AWS account.** Use **Settings > Integrations** in the UI (see the [User Guide](user-guide.md)), or call the API directly:
  ```bash
  curl -X POST http://localhost:8000/api/v1/accounts \
    -H "Content-Type: application/json" \
    -d '{
      "aws_account_id": "123456789012",
      "alias": "Test Account",
      "role_arn": "arn:aws:iam::123456789012:role/NumioReadRole",
      "environment_label": "production",
      "cur_s3_bucket": "my-cur-bucket",
      "cur_s3_prefix": "cur/my-report",
      "cur_report_name": "my-cur-report"
    }'
  ```

---

## Infrastructure Details

### PostgreSQL

PostgreSQL runs as a Docker container, started automatically by `numio-dev.sh run backend`.

- Host: `localhost:5432`
- User: `numio`, Password: `numio`, Database: `numio`
- Data persists across restarts via the `pgdata` Docker volume

**Connect to the database:**

```bash
# Inside container
docker exec -it numio-postgres psql -U numio -d numio

# From host
psql postgresql://numio:numio@localhost:5432/numio
```

Migrations are managed by Alembic. The application does not run migrations on startup — apply them explicitly with `./scripts/numio-dev.sh migrate`. See [ops-runbook.md](ops-runbook.md) for production migration procedures.

### Docker Compose (all-container mode)

For testing the containerized build (closer to production):

```bash
docker compose up              # start all five services
docker compose up -d --build   # rebuild and start in background
docker compose down            # stop all
docker compose down -v         # stop and delete data
```

| Service | URL |
|---------|-----|
| Frontend (nginx) | http://localhost:3000/ |
| Backend API | http://localhost:8000/ |

---

## Project Structure

```
numio/
├── backend/                       # Python backend (FastAPI + FastMCP)
│   ├── src/numio/
│   │   ├── main.py                # FastAPI app entrypoint
│   │   ├── worker.py              # Background worker entrypoint
│   │   ├── api/                   # REST API routes
│   │   ├── mcp/                   # MCP server for AI agents
│   │   └── core/                  # Shared business logic
│   ├── pyproject.toml             # Python dependencies (uv)
│   └── Dockerfile
├── frontend/                      # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                # Routes
│   │   ├── components/            # Shared components
│   │   └── pages/                 # Page components
│   ├── package.json
│   └── Dockerfile
├── deployment/                    # Laptop container configuration
│   └── localhost/                 # Local and laptop operation
├── scripts/
│   ├── numio-dev.sh               # Development lifecycle CLI
│   ├── numio-ctl.sh               # Production container management
│   └── tools/                     # Shared script utilities
├── docs/                          # Documentation
├── tasks/                         # Task tracking
├── docker-compose.yml             # Docker Compose (all services)
└── CLAUDE.md                      # AI agent guidance
```

### Architecture

- **Backend:** FastAPI (REST API) + FastMCP (MCP server for AI agents). Shared business logic in `core/`.
- **Frontend:** React 19 + Vite 6 + react-router-dom.
- **Infrastructure:** PostgreSQL 16, Valkey 8 (Redis-compatible cache).
- **Operator distribution:** Docker containers from published images, run on a laptop.

### Documentation

| Document | Description |
|----------|-------------|
| [User Guide](user-guide.md) | Connect AWS accounts, use Numio |
| [Operations Runbook](ops-runbook.md) | Install, configure, restart, troubleshoot |
| [Architecture](architecture-design.md) | System architecture |
| [Functional Specification](Numio%20functional%20specification.md) | Product specification |

---

## Appendix: numio-dev.sh Commands and Raw Equivalents

| numio-dev.sh command | Raw equivalent |
|---------------------|----------------|
| `run backend` | `docker compose up -d postgres valkey` then `cd backend && uv run uvicorn numio.main:app --reload --port 8000` |
| `run frontend` | `cd frontend && npm run dev` |
| `run worker` | `docker compose up -d postgres` then `cd backend && uv run python -m numio.worker` |
| `run infra` | `docker compose up -d postgres valkey` |
| `stop <app>` | `kill <PID>` (reads from `.numio/pids/<component>.pid`) |
| `stop <infra>` | `docker compose stop <service>` |
| `status` | `docker compose ps` + check PIDs in `.numio/pids/` |
| `log <infra>` | `docker compose logs --tail=200 <service> 2>&1` |
| `log -f <infra>` | `docker compose logs --tail=200 -f <service> 2>&1` |
| `log <app>` | `tail -n 200 .numio/logs/<component>.log 2>&1` |
| `log -f <app>` | `tail -n 200 -f .numio/logs/<component>.log 2>&1` |
| `restart <infra>` | `docker compose restart <service>` |
| `restart <app>` | Kill process, re-launch in background |
| `rebuild <infra>` | `docker compose up -d --build --force-recreate <service>` |
| `migrate` | `cd backend && uv run alembic upgrade head` |
| `health` | `curl -fsS http://localhost:8000/health` |
| `init` | `cd frontend && npm install` then `cd backend && uv sync` |
| `build` | `docker compose build` + tag images |
