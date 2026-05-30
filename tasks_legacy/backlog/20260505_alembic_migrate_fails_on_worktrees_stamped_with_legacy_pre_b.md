---
status: backlog
kind: bug
title: Alembic: migrate fails on worktrees stamped with legacy pre-baseline revision
---

# Alembic: migrate fails on worktrees stamped with legacy pre-baseline revision

# Alembic: migrate fails on worktrees stamped with legacy pre-baseline revision

## Problem statement

On 2026-04-29 commit `e62f19e` ("Consolidate alembic migrations into a single baseline") deleted ~24 individual migration files spanning 2026-03-19 → 2026-04-26 and replaced them with a single consolidated baseline at revision `e25d2a1b1d46`. The baseline's own docstring (`backend/alembic/versions/e25d2a1b1d46_baseline.py`) names the legacy chain head as `c1a8b9d2e3f4`.

**Observed behaviour.** A dev worktree whose Postgres volume was created **before** that commit has its `alembic_version` table stamped with `c1a8b9d2e3f4` (or any of the deleted intermediate revisions). Running `./scripts/numio-dev.sh migrate` in that worktree fails because alembic cannot find that revision id in `backend/alembic/versions/` — the new chain only knows `e25d2a1b1d46 → f1a2b3c4d5e6 → a7b8c9d0e1f2`. As a result, any new migration cannot be applied; the operator must either nuke the volume (losing data) or stamp by hand. This was hit on 2026-05-04 during the Data Explorer feature work — migrations `f1a2b3c4d5e6` and `a7b8c9d0e1f2` had to be applied via raw psql DDL.

**Expected behaviour.** Either:
- (a) `migrate` succeeds without manual intervention on a worktree whose DB schema already matches the consolidated baseline (because that DB was previously fully migrated through the legacy chain — its schema is a *superset* of what the baseline produces), OR
- (b) the operator gets a clear, actionable error explaining what to do — e.g. *"This DB is on legacy revision `c1a8b9d2e3f4`. Run `./scripts/numio-dev.sh migrate --rebase-from-legacy` to stamp it as `e25d2a1b1d46`, or `./scripts/numio-dev.sh nuke` to start fresh"*.

Today the operator gets a raw alembic stack trace pointing at a missing revision and no guidance.

**Why this might not be a bug.** The baseline-collapse refactor may have intentionally drawn the line at fresh DBs only. If every operator who had a pre-baseline DB has already nuked their worktree, this is a one-time cutover hole that nobody will ever hit again — closeable as Won't Fix. The author of `e62f19e` knows whether that's the case.

## Scope

**In**

- Decide intent: is the baseline-collapse "fresh DBs only" by design, or do we want to support already-stamped worktrees?
- If "support already-stamped worktrees": ship a one-shot rebase utility — either an alembic `stamp` command wrapped by `numio-dev.sh`, or a tiny `c1a8b9d2e3f4_to_baseline_alias.py` migration that recognises the legacy head and stamps it forward without touching the schema. The legacy chain head and the consolidated baseline produce equivalent schema (the baseline is a `pg_dump --schema-only` of that exact head per the baseline docstring), so stamping is sufficient — no DDL needed.
- If "fresh DBs only": improve the failure message in `numio-dev.sh migrate` to detect a missing-revision error and print the nuke instructions.
- Either way: add a one-line note in `docs/dev-runbook.md` § *Database migrations* describing what to do when migrate fails on a pre-2026-04-29 worktree.

**Out**

- Retroactively reproducing the legacy migrations chain. The baseline is already correct.
- Re-running the consolidation. Done.
- Anything beyond the alembic chain — application data is not in scope.

## Acceptance criteria

1. A worktree whose `alembic_version = 'c1a8b9d2e3f4'` can be brought to head via a single documented command, without losing application data.
2. The dev-runbook tells an operator what to do if `./scripts/numio-dev.sh migrate` fails with a missing-revision error.
3. If the team decides "fresh DBs only" is the right call, this task is closed as Won't Fix with a one-line entry in the runbook telling operators in that situation to nuke.

## Quality gates

- The chosen path (rebase utility OR Won't Fix + docs update) is approved by whoever authored `e62f19e`.
- `./scripts/numio-dev.sh migrate` either succeeds or prints a clear remediation message — no raw alembic stack traces.
- Doc note exists.
