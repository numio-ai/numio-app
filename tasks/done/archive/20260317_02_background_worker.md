---
status: done
phase: 2
task_id: P2.2
---

# Background Worker and Job Scheduling

## Problem Statement

Numio needs to run periodic data ingestion jobs (billing sync, resource inventory sync) across all registered AWS accounts. These jobs must run on a schedule, be triggerable on demand, handle per-account failures gracefully, and track their execution status.

## Scope

**In scope:**
- Worker service that runs as a separate process from the API server, sharing the same codebase and database
- Job scheduling using APScheduler (or equivalent) for recurring jobs
- Jobs are plain async functions that can be called by: the scheduler (on a cron/interval), the API (on-demand trigger), or future event triggers
- Job execution is idempotent — running the same job twice for the same time period produces the same result without duplicating data
- Per-account job execution: when a job processes multiple AWS accounts, failure on one account is logged and does not block processing of remaining accounts
- Job execution tracking: for each job run, record start time, end time, status (success/partial/failure), error details, and record counts per account
- API endpoints to: list job types, trigger a job on demand, view recent job execution history, view job status per account
- Ingestion health tracking: last sync time, success/failure, and record count per data source per account. Alert (log-level for now) when an account has not synced within the expected window

**Out of scope:**
- The actual ingestion logic (Cost Explorer, CUR, resource sync) — those are separate tasks that plug into this framework
- Distributed job locking (single-instance worker is sufficient for MVP)
- Job queuing or priority systems
- Frontend UI for job management

## Acceptance Criteria

1. Worker service starts as a separate process and connects to the database
2. A sample/placeholder job can be scheduled to run on an interval and its execution is recorded
3. The same job can be triggered on demand via the API
4. When a job iterates over multiple accounts, failure on one account logs the error and continues with remaining accounts
5. Job execution history API shows the last N runs with status, timing, and per-account details
6. Ingestion status API shows per-account last sync time and status

## Quality Gates

### Automated checks
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`

### Functional validation (requires running backend + PostgreSQL)
Prerequisites: `docker compose up postgres -d && cd backend && uv run alembic upgrade head`

1. Start backend: `cd backend && uv run uvicorn numio.main:app --port 8000`
2. **List job types** — returns registered job types including sample_ingestion:
   ```
   curl -s http://localhost:8000/api/v1/jobs/types | python3 -m json.tool
   ```
3. **Trigger a job** — returns job_run_id with status:
   ```
   curl -s -X POST http://localhost:8000/api/v1/jobs/sample_ingestion/trigger | python3 -m json.tool
   ```
4. **Trigger nonexistent job** — returns 404:
   ```
   curl -s -X POST http://localhost:8000/api/v1/jobs/nonexistent/trigger
   ```
5. **View job history** — shows the triggered job run with per-account details:
   ```
   curl -s http://localhost:8000/api/v1/jobs/history | python3 -m json.tool
   ```
6. **View ingestion status** — shows per-account last sync time and status:
   ```
   curl -s http://localhost:8000/api/v1/jobs/ingestion-status | python3 -m json.tool
   ```
7. **Worker starts** — verify worker process starts and connects to DB:
   ```
   cd backend && timeout 10 uv run python -m numio.worker || true
   ```
   Expected: logs showing DB connection, job registration, and scheduler start (exits after timeout)
8. **Per-account isolation** — verify in job history that individual account results are tracked:
   ```
   curl -s 'http://localhost:8000/api/v1/jobs/history?limit=1' | python3 -m json.tool
   ```
   Expected: `account_results` array with per-account status and record_count
