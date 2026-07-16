---
status: done
---

# Fix Backend Startup: Alembic Path Resolution and Async Migration Conflict

**Date:** 2026-03-21

## Context

During work on task `20260316_03_api_foundation`, the backend server was found to be unable to start. Two bugs in the database initialization code (introduced in `20260316_02_database_setup`) prevent the FastAPI application from launching. These are foundational issues that block all further backend development.

## Problem

The backend fails to start with two distinct errors:

### Bug 1: Wrong `alembic.ini` path resolution

`backend/src/numio/main.py` constructs the path to `alembic.ini` using:

```python
alembic_cfg_path = str(Path(__file__).parent.parent.parent.parent / "alembic.ini")
```

`__file__` resolves to `backend/src/numio/main.py`. Four `.parent` calls resolve to `numio-app/`, but `alembic.ini` is located at `numio-app/backend/alembic.ini`. The correct count is 3 parents.

**Error produced:**
```
alembic.util.exc.CommandError: No 'script_location' key found in configuration.
```

### Bug 2: `asyncio.run()` called inside a running event loop

`backend/alembic/env.py` line 56 calls:

```python
asyncio.run(run_migrations_online())
```

This is executed from the FastAPI async `lifespan()` handler via `init_db.run_migrations()` → `alembic command.upgrade()` → `env.py`. Since the lifespan handler already runs inside an event loop, `asyncio.run()` cannot create a new one.

**Error produced:**
```
RuntimeWarning: coroutine 'run_migrations_online' was never awaited
```

(In some Python versions this raises `RuntimeError: This event loop is already running`.)

### Reproduction

```bash
# Start PostgreSQL
docker run -d --name numio-postgres \
  -e POSTGRES_USER=numio -e POSTGRES_PASSWORD=numio -e POSTGRES_DB=numio \
  -p 5432:5432 postgres:16-alpine

# Wait for PostgreSQL
until docker exec numio-postgres pg_isready -U numio -q; do sleep 1; done

# Attempt to start backend (from repo root)
cd backend && uv run uvicorn numio.main:app --port 8000
# → Fails with 'No script_location key found in configuration'
```

## Goals

1. Backend starts successfully when launched via `cd backend && uv run uvicorn numio.main:app --port 8000`
2. Backend starts successfully when launched via `./scripts/numio-manager.sh backend dev`
3. Alembic migrations run correctly on startup (tables are created in PostgreSQL)
4. Default workspace is seeded after migrations complete
5. `/health` endpoint returns HTTP 200 with service status

## Non-goals

- Changing the Alembic migration files or database schema
- Adding new configuration settings or features
- Modifying the test infrastructure
- Fixing any issues unrelated to these two startup bugs

## Constraints & Assumptions

- The fix must work when the backend is started from the `backend/` directory (the standard documented workflow)
- The fix must work both via the `numio-manager.sh backend dev` script and direct `uv run uvicorn` invocation
- `alembic/env.py` must continue to work when invoked from the CLI (`cd backend && uv run alembic upgrade head`) for manual migration management
- PostgreSQL must be running and accessible at the configured `DATABASE_URL`

## Acceptance Criteria

1. `cd backend && uv run uvicorn numio.main:app --port 8000` starts without errors
2. `./scripts/numio-manager.sh backend dev` starts without errors
3. `curl http://localhost:8000/health` returns HTTP 200 JSON with `"status": "ok"`
4. `cd backend && uv run alembic upgrade head` still works for manual CLI migration
5. No `RuntimeWarning` or `RuntimeError` related to event loops in startup logs
6. Developer guide accurately documents how to start the backend and run migrations

## Validation Steps

**Prerequisites:** PostgreSQL running locally (see developer guide).

**Step 1 — Direct uvicorn start:**
```bash
cd backend && uv run uvicorn numio.main:app --port 8000
# Expected: Server starts, logs show "Database migrations applied" and "Numio server starting"
# No errors or warnings about event loops or alembic configuration
```

**Step 2 — Health check:**
```bash
curl -s http://localhost:8000/health | python3 -m json.tool
# Expected: {"service": "numio", "status": "ok", ...}
```

**Step 3 — Script-based start (stop server from step 1 first):**
```bash
./scripts/numio-manager.sh backend dev
# Expected: Server starts without errors
```

**Step 4 — Manual CLI migration (stop server first):**
```bash
cd backend && uv run alembic downgrade base && uv run alembic upgrade head
# Expected: Migrations revert and re-apply without errors
```

**Step 5 — Linting:**
```bash
cd backend && uv run ruff check .
# Expected: All checks passed
```

**Step 6 — Tests:**
```bash
cd backend && uv run pytest -v
# Expected: All tests pass
```

## Risks & Rollback

- **Risk:** Changing `env.py` to support both CLI and programmatic invocation could break one path if not tested against both.
  **Mitigation:** Validation steps 1 and 4 explicitly test both paths.
- **Rollback:** Revert the commit. The backend was already broken, so reverting returns to the same broken state.
