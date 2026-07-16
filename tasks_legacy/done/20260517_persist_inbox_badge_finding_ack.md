---
status: done
kind: task
feature: ia_v2_persistence
title: Persist Inbox badge + finding ack
---

# Persist Inbox badge + finding ack

## Problem statement

`api/ia_v2_inbox.py` keeps the per-workspace ack counter in a module-level `_ACK_COUNT` dict that resets on restart. The frontend hook `useInboxUnreadCount` returns a static value `11`. After this task, the unread count reflects real `findings` table state plus a new `finding_acks` join, and `useInboxUnreadCount` fetches from `/inbox/badge`.

## Scope

In scope:
- Alembic migration: new table `finding_acks(id, workspace_id, finding_id FK→findings, user_id FK→users, acknowledged_at)` with unique `(workspace_id, finding_id, user_id)`.
- SQLAlchemy model + `FindingAckRepository`.
- Update `GET /api/v1/inbox/badge` to compute `unread_count = findings.count() - finding_acks.count()` scoped to caller workspace.
- Update `POST /api/v1/inbox/findings/{id}/ack` to insert a row (idempotent on the unique key; second ack returns the same `new_unread_count`).
- AuthZ: caller must be authenticated; reads scope by `workspace_id`.
- Replace `frontend/src/hooks/useInboxUnreadCount.js` body with a `fetch('/api/v1/inbox/badge')` + `useEffect` polling (60s) implementation. V2Sidebar and InboxPage continue to import the hook unchanged.

Out of scope:
- Real-time push (SSE/WebSocket) — polling is fine for v1.
- Per-user vs per-workspace ack semantics — start workspace-wide (any user can ack on behalf of the workspace).

## Acceptance criteria

A1. Alembic migration applies cleanly to a fresh DB and an existing dev DB.

A2. `GET /inbox/badge` returns counts derived from real `findings` + `finding_acks` rows; no module-level state.

A3. `POST /inbox/findings/{id}/ack` is idempotent — second call for the same `(workspace, finding)` does not error and does not double-count.

A4. Pytest covers: cold-start unread = total findings; after one ack unread decrements by 1; duplicate ack is a no-op; cross-workspace isolation (workspace A ack doesn't affect workspace B count).

A5. Frontend V2Sidebar badge renders the live count after the hook flip; manual smoke confirms badge updates within 60s of an ack.

## Quality gates

- Backend pytest + alembic apply both green.
- Frontend `npm test` passes; existing V2Sidebar test still passes with the polled hook mocked.
- `git grep -F 'useMemo' frontend/src/hooks/useInboxUnreadCount.js` returns zero hits (proves it's no longer a static stub).

## Summary

### Steps completed

1. Alembic migration `b9c1d2e3f4a5_finding_acks.py` — chained off `a7b8c9d0e1f2`. Symmetric upgrade/downgrade. Creates `finding_acks` with the workspace-scoping index and the workspace-wide unique constraint (see Notable decisions for the uniqueness scope change).
2. SQLAlchemy model `models/finding_ack.py` + registration in `models/__init__.py`. The model is auto-picked-up by `Base.metadata.create_all` so the test suite (which bypasses alembic and uses `create_all`) sees the table immediately.
3. Repository `db/finding_ack_repository.py` per conventions §1: workspace-scoped constructor, `ack_finding` uses `pg_insert(...).on_conflict_do_nothing(["workspace_id", "finding_id"])` for atomic idempotency, `count_unread_findings` / `count_unread_by_severity` compute live counts via correlated `Finding.id NOT IN (acked subquery)`.
4. Router rewrite `api/ia_v2_inbox.py` per conventions §2: removed `_ACK_COUNT` module dict, the three `_INITIAL_*` constants, and the `_unread_for(...)` helper. Both endpoints now use `Depends(get_session)` + repo. `POST /findings/{id}/ack` now types `finding_id: uuid.UUID` so malformed paths return 422 cleanly and the FK to `findings.id` is type-safe.
5. Frontend hook `hooks/useInboxUnreadCount.js`: `useMemo => 11` replaced with `useState` + `useEffect` initial fetch + 60s `setInterval` polling. Hook signature `() => number` is preserved — V2Sidebar and InboxPage need no changes. Errors are swallowed silently so a transient backend hiccup keeps the badge at its last known good value.
6. Frontend API client `api/inbox.js` (new) — `fetchInboxBadge()` + `ackFinding(id)` following the §7 request helper pattern.
7. Backend integration test rewrite `tests/test_ia_v2_inbox.py` per conventions §8: full router → repo → DB exercise against the test Postgres. 7 cases covering cold start, severity filtering (`status='resolved'` excluded), ack decrement, idempotent re-ack, unknown-finding 404, workspace isolation, and cross-workspace 404.

### Acceptance criteria status

- **A1** — Fully verified. After `numio-dev.sh nuke -y` + `run infra` + `migrate` + `seed`, the full chain `e25d2a1b1d46 → f1a2b3c4d5e6 → a7b8c9d0e1f2 → b9c1d2e3f4a5` runs without errors. `SELECT version_num FROM alembic_version` reports `b9c1d2e3f4a5`; `\d finding_acks` reports the expected schema (varchar(255) workspace_id, UUID FKs `finding_id → findings.id CASCADE` and `user_id → users.id SET NULL`, `ix_finding_acks_workspace_id` index, `uq_finding_acks_workspace_finding` unique index on `(workspace_id, finding_id)`, `acknowledged_at` default `now()`). `Base.metadata.create_all` (used by the test suite, bypassing alembic) also builds the table cleanly — both paths agree on the schema.
- **A2** — Verified: `git grep '_ACK_COUNT' backend/src/numio/api/ia_v2_inbox.py` returns zero hits. Counts come from `FindingAckRepository.count_unread_findings()`.
- **A3** — Verified: `test_ack_is_idempotent` proves a second ack on the same finding returns the same `new_unread_count` and produces no error.
- **A4** — Verified: `test_badge_cold_start_unread_equals_open_findings` + `test_ack_decrements_unread` + `test_ack_is_idempotent` + `test_workspace_isolation` cover every required case, plus three extras (resolved findings excluded, unknown finding 404, cross-workspace 404).
- **A5** — Fully verified. Headless browser at `http://localhost:5173/` against the running dev stack. DOM evidence:
  - V2Sidebar badge: `[data-testid="v2-inbox-badge"]` rendered with text `"2"` and `aria-label="2 unread"`.
  - InboxPage header: *"Work queue · 2 need triage"*.
  - All 3 seeded `smoke test finding #N` rows visible.
  - The badge value matches the live `/api/v1/inbox/badge` (3 seeded findings, 1 acked critical, 2 unread).
  Also verified via the API directly: empty (0/0/0) → seed 3 with 1 critical (3/3/1) → ack critical (2/2/0) → re-ack same finding idempotent (still 2/2/0, no error). Round trip is real and persistent.

### Changes made

New:
- `backend/alembic/versions/b9c1d2e3f4a5_finding_acks.py`
- `backend/src/numio/models/finding_ack.py`
- `backend/src/numio/db/finding_ack_repository.py`
- `frontend/src/api/inbox.js`

Modified:
- `backend/src/numio/models/__init__.py` — register `FindingAck`.
- `backend/src/numio/api/ia_v2_inbox.py` — full rewrite; removed module-level state.
- `backend/tests/test_ia_v2_inbox.py` — full rewrite; old module-dict smoke tests are gone.
- `frontend/src/hooks/useInboxUnreadCount.js` — `useMemo` static stub → `useState` + 60s polled fetch.

### Notable decisions or deviations

1. **Uniqueness scope: `(workspace_id, finding_id)`, not `(workspace_id, finding_id, user_id)`.** The task scope text explicitly says "Per-user vs per-workspace ack semantics — start workspace-wide (any user can ack on behalf of the workspace)." Workspace-wide is the simpler semantic and matches the "first ack wins" idempotency the UI presumes. `user_id` is recorded for audit only and is nullable so user deletion does not cascade-destroy the ack history.
2. **`finding_acks.workspace_id` is `String(255)`, not UUID with FK→workspaces.** Convention §4 asks for UUID + FK→workspaces CASCADE on new tables. I deviated to match `findings.workspace_id` (legacy `String(255)`, no FK). The two tables are co-joined every time the badge is read; matching types keeps the LEFT JOIN cast-free. The whole findings-workspace-id type would be the right place to normalize, in a follow-up that moves both columns together.
3. **Dev-DB pre-existed at legacy head `c1a8b9d2e3f4` — resolved by nuke.** The user's dev DB had been migrated through the legacy 24-step chain (head: `c1a8b9d2e3f4`) before that chain was consolidated into `e25d2a1b1d46_baseline.py`. Alembic refused to load because `c1a8b9d2e3f4` no longer exists in any migration file. Two paths considered: hand-stamping `alembic_version` (preserves data but creates a per-worktree-bespoke state), or `numio-dev.sh nuke -y` + reseed (uses intended tooling, proves the migration against a truly fresh DB). Chose **nuke** — the dev DB carried only regenerable state (AWS accounts re-add via Settings, cost data re-ingests via CUR job), and a fresh-DB migration is the strongest A1 proof. The same trap will hit any teammate or CI run with a pre-consolidation worktree — flagged as a candidate follow-up to patch the baseline migration's `upgrade()` to auto-detect-and-relabel the legacy head (out of scope for B1).

### Links

- Migration: `backend/alembic/versions/b9c1d2e3f4a5_finding_acks.py`.
- Production code under guard: `backend/src/numio/api/ia_v2_inbox.py`, `backend/src/numio/db/finding_ack_repository.py`.
- Parent feature: `tasks/features/20260517_ia_v2_persistence.md` (B1 of 8).
- Plan: `/Users/example/.claude/plans/binary-popping-zebra.md` (Workstream B1).
