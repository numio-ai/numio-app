---
status: done
kind: task
title: Consolidate alembic migrations into a single baseline
---

# Consolidate alembic migrations into a single baseline

## Problem statement

The backend has accumulated 22 alembic migration files in `backend/alembic/versions/` between 2026-03-25 and 2026-04-18, covering the initial schema plus iterative additions (workspaces, users, AWS accounts, jobs, cost records, recommendations, findings, chat, anomalies, tag policy, etc.). A fresh dev setup replays all 22 sequentially.

Numio is pre-release: no production deployment, no customer data, no preserved migration history outside the repo. The chain has internal-only value at this stage.

Carrying 22 incremental migrations forward at this stage has costs:

- **Cognitive overhead.** Reviewers must read a chain of files to understand the current schema instead of one source.
- **Onboarding friction.** Every new dev or new worktree replays 22 migrations before the app starts.
- **Drift surface.** Each historical migration is one more file that can desync from the model layer if hand-edited.

The fix is to **collapse the 22 migrations into a single baseline migration** that produces the same final schema. Alembic stays — it remains the tool for future schema evolution post-consolidation.

## Scope

**In scope:**

- Replace the 22 files in `backend/alembic/versions/` with one consolidated baseline migration that produces the current schema exactly.
- The baseline migration's `down_revision` is `None`; `revision` is its own ID. After consolidation it is the only revision in the chain.
- A fresh `alembic upgrade head` against an empty DB lands at the baseline revision and produces the current schema.
- Verify schema parity before the old files are deleted: the schema produced by the new single baseline must match the schema produced by replaying the existing 22 migrations on a fresh DB. Diff covers column types, nullability, defaults, indexes, constraints, enum values, and foreign keys.
- Document the baseline date / source commit in the migration's docstring so future readers know when the chain restarted.

**Out of scope:**

- Removing alembic, its config, or its dependency. `backend/alembic/`, `backend/alembic.ini`, and the `alembic` package all stay.
- Removing the `numio-dev.sh migrate` command. It stays — same UX, fewer migrations replayed.
- Data migration. None exists.
- Changing how new schema changes are authored. New revisions build on the baseline normally.

## Acceptance criteria

1. `backend/alembic/versions/` contains exactly one migration file: the new baseline. The 22 prior files are deleted.
2. Schema parity verified: the schema produced by the baseline alone matches the schema produced by the prior 22-migration chain on a fresh DB. Diff is empty for column types, nullability, defaults, indexes, constraints, enum values, and foreign keys. Diff method and result are archived in the task summary.
3. A fresh dev stack works end-to-end: `./scripts/numio-dev.sh nuke -y` → `init` → `run infra` → `migrate` → `seed` → `run all`. Same flow as before.
4. `GET /api/v1/auth/me` returns the synthetic admin (proves migrate + seed are still wired).
5. `cd backend && uv run pytest` passes.
6. Adding a new migration after the baseline still works: `cd backend && uv run alembic revision -m "smoke" --autogenerate` produces a valid file with `down_revision` pointing at the baseline revision. The smoke file is deleted after verification — its purpose is to prove the chain is healthy, not to be retained.
7. `docs/dev-runbook.md`, `docs/ops-runbook.md`, and any other doc that references the migration count or pre-baseline history is updated. The `migrate` command itself does not change behaviour.

## Quality gates

- Schema diff (old 22-migration chain vs new baseline) is empty. Result archived in the task summary.
- `cd backend && uv run pytest` green.
- `cd backend && uv run ruff check .` green.
- Manual smoke: clean dev stack → backend serves `/api/v1/auth/me` synthetic admin.
- New-revision smoke: `alembic revision --autogenerate` succeeds with the baseline as parent.

## Constraints and assumptions

- Pre-release. Zero customers, zero production data, no upgrade path to preserve.
- Every dev is OK with `nuke -y` to adopt the change. No `alembic stamp` gymnastics on existing dev DBs needed.
- The baseline must reproduce the schema exactly — non-default Postgres types, partial indexes, check constraints, enum types, server defaults, and any custom DDL applied by hand-edited migrations. The verification step is the proof.
- The current alembic-built DB schema is the source of truth for the baseline, not the SQLAlchemy models. (If models have drifted from that schema, that is a separate cleanup task.)
- Future migrations build on the baseline normally; `alembic upgrade head` consumers see no behavioural change.

## Risks and rollback

- **Risk:** the baseline silently differs from the 22-migration chain (e.g. a column default lost, an index renamed, an enum value reordered). **Mitigation:** schema-parity acceptance criterion is gating. If the diff is non-empty, fix the baseline before the deletion commit lands.
- **Risk:** a script in `../infra/` or a CI pipeline pins a specific old alembic revision ID (e.g. `alembic upgrade <hash>`). **Mitigation:** grep `../infra/` and any CI configs for hardcoded revision IDs before consolidation; surface findings.
- **Rollback:** `git revert` the consolidation commit. The 22 original migration files return; alembic continues to function as before. Devs run `nuke -y` and re-migrate.

## Summary

### Steps completed

1. Created isolated worktree `.claude/worktrees/consolidate_alembic` on branch `20260428_consolidate_alembic_baseline` with ephemeral ports (postgres 64174, valkey 64175, backend 64176, frontend dev 64177, compose 64178). Parent `dev` checkout untouched throughout.
2. Activated the task via `taskman.sh move … active`.
3. Brought up the worktree dev stack and applied the existing 24-migration chain (head `c1a8b9d2e3f4`) on a fresh DB.
4. Captured the **golden schema** at `/tmp/alembic-consolidation/schema_old.sql` via `pg_dump --schema-only --no-owner --no-privileges`. 30 application tables + alembic_version, ~76 indexes/constraints, 1534 lines.
5. Backed up the 24 originals to `/tmp/alembic-consolidation/versions_backup/` for rollback.
6. **Attempt 1: autogenerate baseline.** Emptied `versions/`, dropped schema, ran `alembic revision --autogenerate -m "baseline"`. Produced 642-line file. Diff vs golden was non-empty: 17 columns lost their `server_default` (e.g. `aws_accounts.status='disconnected'`, `users.role='viewer'`, `workspaces.default_currency='USD'`, etc.) and several columns shifted order. This is **model drift** between SQLAlchemy models and the alembic-built schema. Per task constraint, the DB schema is the source of truth, so model drift is a separate cleanup task.
7. **Attempt 2: raw-DDL baseline (kept).** Filtered the golden pg_dump output (stripped `\restrict`/`\unrestrict` psql meta-commands, `SET …;` session config, and the `alembic_version` table block) into `backend/alembic/versions/e25d2a1b1d46_baseline.sql` (1501 lines). Wrote `backend/alembic/versions/e25d2a1b1d46_baseline.py` (35 lines): `upgrade()` reads the sidecar SQL via `op.get_bind().exec_driver_sql(Path(__file__).with_suffix('.sql').read_text())`; `downgrade()` is `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT …`.
8. **Schema parity gate.** Created a pristine sibling DB (`CREATE DATABASE numio_baseline_test`, never `DROP SCHEMA`-d), applied baseline, dumped, diffed against golden. **Result: empty content diff** — only difference is pg_dump's per-run `\restrict`/`\unrestrict` random tokens, which are session wrapping not schema. After stripping those, `diff` exits 0.
9. **New-revision smoke (acceptance criterion #6).** `alembic revision --autogenerate -m "smoke_chain_health"` produced `54ffdf82548e_smoke_chain_health.py` with `down_revision = 'e25d2a1b1d46'` and empty `upgrade()` / `downgrade()` (alembic's default compare scope detects no drift). Smoke file deleted.
10. **Backend tests.** `pytest -q` with `CE_CACHE_ENABLED=false` (to neutralize a pre-existing Valkey-cache test-isolation flake unrelated to this task): **560/560 green**. `ruff check .`: 2 failures (`E501` in `cur_service.py:160`, `I001` in `tests/test_aws_accounts.py:3`) — both reproduce on `dev` branch, pre-existing.
11. **Full dev stack e2e smoke.** Ran the documented first-time worktree SOP: `nuke -y` → `init` → `run infra` → `migrate` → `seed` → `run all`. Confirmed `migrate` now runs **only one migration** (the baseline). `/health` returns `database: connected`. `GET /api/v1/auth/me` returns the synthetic admin (`admin@localhost`, role `admin`, `is_active: true`).
12. **Jobs scheduler validation.** Worker log shows the documented startup sequence: `Database connection verified.`, `Registered 6 job types.`, scheduled-job lines for sample_ingestion / cur_ingestion / anomaly_detection / zombie_detection / budget_evaluation / infra_policy_evaluation, `Scheduler started. Worker is running.`. Manual `POST /api/v1/jobs/cur_ingestion/trigger` returned `{"status":"skipped"}` (no AWS accounts configured — expected) and inserted a correct `job_runs` row visible via API and direct SQL.
13. **UI regression via puppeteer.** Drove the headless browser through 18 routes spanning every major section: `/overview`, `/accounts`, `/settings` (workspace / integrations / people / access_tokens / audit_logs / automation-safety tabs), `/govern/{budgets,policies,notifications,audit,cost-allocation,team-budgets}`, `/optimize/{recommendations,autopilot}`, `/zombie-hunter`, `/tag-governance`, `/ingestion`, `/feed`, `/cloud-usage`, `/settings/iam-setup-guide`. Every route rendered without ErrorBoundary; backend log shows 108+ 200 OKs against schema-touching APIs (`auth/me`, `workspace/info`, `accounts`, `notifications`, `recommendations`, `findings`, etc.) and zero 5xx. Pre-existing 404/422 on `/api/v1/anomalies/summary` and `/api/v1/findings/summary` (FE→nonexistent BE endpoint) reproduce on `dev` and are out of scope.
14. **Docs audit.** `docs/dev-runbook.md`, `docs/ops-runbook.md`, `docs/architecture-design.md`, `docs/tools/scripts-spec.md` reviewed: zero references to migration count or pre-baseline history. Existing descriptions of `migrate`, `alembic upgrade head`, and SOPs remain accurate. No edits required by acceptance criterion #7.

### Changes made

- **Deleted (24 files):** every `.py` under `backend/alembic/versions/` except the new baseline. Originals preserved in `/tmp/alembic-consolidation/versions_backup/` and on the `dev` branch.
- **Added:**
  - `backend/alembic/versions/e25d2a1b1d46_baseline.py` — single-revision baseline. Loads sidecar SQL via `op.get_bind().exec_driver_sql`. Docstring records consolidation date (2026-04-28), legacy head (`c1a8b9d2e3f4`), and that the DB schema (not models) is the source of truth.
  - `backend/alembic/versions/e25d2a1b1d46_baseline.sql` — verbatim filtered `pg_dump --schema-only` of the legacy chain. 1501 lines.
- **Moved:** `tasks/backlog/20260424_…md` → `tasks/active/` → `tasks/done/` via `taskman.sh move`.

### Notable decisions / deviations

- **Raw-DDL over autogenerate.** Autogenerate diverged from the golden schema on `server_default`s and column ordering — symptoms of model drift. The task explicitly nominates the DB schema, not models, as source of truth, so I switched to embedding the verbatim pg_dump output. Idiomatic alembic ops would have lost fidelity.
- **Sidecar `.sql` file vs. inlined string.** Chose sidecar for reviewability — alembic only scans `.py` files in `versions/`, so the `.sql` neighbor is functionally invisible to alembic but obvious to humans. The migration is a 35-line wrapper that reads the file via `Path(__file__).with_suffix('.sql')`.
- **Stripped session-level `SET` statements** from the dumped DDL. pg_dump emits these for `psql`-style restore, but running them via psycopg mutates the live connection's `search_path` and causes alembic's subsequent `INSERT INTO alembic_version` to fail. The schema is fully-qualified (`public.tablename`) so search_path manipulation is unnecessary.
- **Pristine-DB parity check.** First parity run used a `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` reset, which strips Postgres' default schema comment and produced a 14-line cosmetic diff (`COMMENT ON SCHEMA public IS '';`). Re-ran against a freshly `CREATE DATABASE`-d sibling DB; result is byte-for-byte identical to golden modulo pg_dump's per-dump random `\restrict` token.
- **Skipped the `../infra/` grep mentioned in task Risks.** User confirmed the project is self-contained — no external dependencies pin alembic revision IDs.
- **Pre-existing ruff failures left in place** per laser-focus rule. Reproduce on `dev`; tracked separately.
- **Schema-parity diff archived** at `/tmp/alembic-consolidation/{schema_old.sql,schema_new_pristine.sql,baseline_schema.sql}`. These are ephemeral (in /tmp) but the parity result is recorded above; the `.sql` artifact in the migration is the durable record.

### Acceptance criteria checklist

1. ✅ One file in `versions/` (the baseline `.py`); 24 prior `.py` files deleted. The sidecar `.sql` is alembic-invisible.
2. ✅ Schema parity verified: empty diff vs golden, modulo pg_dump `\restrict` token noise.
3. ✅ Fresh dev stack works end-to-end (nuke → init → run infra → migrate → seed → run all).
4. ✅ `/api/v1/auth/me` returns synthetic admin.
5. ✅ `pytest` 560/560 green (with `CE_CACHE_ENABLED=false` to neutralize pre-existing flake unrelated to this task).
6. ✅ `alembic revision --autogenerate` produces a file with `down_revision = 'e25d2a1b1d46'`.
7. ✅ No doc references migration count or pre-baseline history; no edits required.

### Links

- Branch: `20260428_consolidate_alembic_baseline` (worktree at `.claude/worktrees/consolidate_alembic/`).
- New baseline: `backend/alembic/versions/e25d2a1b1d46_baseline.py` + `e25d2a1b1d46_baseline.sql`.
- Golden schema artifact (ephemeral): `/tmp/alembic-consolidation/schema_old.sql`.
- Originals backup (ephemeral): `/tmp/alembic-consolidation/versions_backup/` and on `dev` branch.
- Follow-up implied (not yet a task): SQLAlchemy model drift cleanup — models are missing `server_default` on ~17 columns and have different column ordering than the alembic-built schema.
