---
status: done
kind: task
---

# T4: Data Pipeline Wiring

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)

## Problem

After a customer registers an AWS account, they expect cost data to appear. Two pipeline components prevent this:

1. The **job runner** iterates over a hardcoded list of placeholder account IDs (`DEFAULT_ACCOUNTS = ["111111111111", "222222222222"]`) instead of querying registered accounts from the database.
2. The **worker** (background scheduler) does not register CUR ingestion as a scheduled job, so even with real account IDs, CUR ingestion never runs.

## Goals

1. Job runner queries active registered accounts from the `aws_accounts` table instead of using hardcoded placeholders.
2. Worker registers CUR ingestion jobs alongside the existing scheduled jobs.

## Non-goals

- Changing CUR ingestion logic itself (column selection, Parquet parsing, etc.)
- Changing job scheduling intervals
- Handling accounts in "error" or "warning" status (only "active" accounts should be processed)

## Constraints & Assumptions

- The runner's `run_job()` interface should remain compatible — existing callers that pass explicit account lists should still work.
- The CUR job registration function exists in the codebase but is not called from the worker.
- Only accounts with status="active" should be included in job runs.

## Acceptance Criteria

1. `run_job()` without an explicit account list queries active accounts from the database.
2. `DEFAULT_ACCOUNTS` is removed or guarded behind a development-only flag.
3. Worker's startup registers CUR ingestion jobs.
4. Scheduled CUR job runs successfully against a registered account (end-to-end with real AWS if available, or mock in test).
5. If no active accounts are registered, the runner logs a message and completes without error.
6. Existing scheduled jobs (anomaly, zombie, budget, policy) continue to work.

## Validation Steps

1. Register an account via API (T3). Trigger a CUR job via API or wait for schedule. Verify job run record shows the registered account ID (not placeholder).
2. Remove all accounts. Trigger a job. Verify it completes gracefully with "no active accounts" log.
3. Existing job types still appear in the worker's startup log.

## Risks & Rollback

- Low risk. Changes are additive (new DB query) and a one-line worker registration.
- If the runner's DB query fails, the fallback should be no-op (log error, skip), not crash.
- Rollback: revert runner.py and worker.py.
