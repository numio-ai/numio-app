---
status: backlog
kind: task
feature: ia_v2_persistence
title: Persist Autopilot rules + history + undo + atomic pause-all
---

# Persist Autopilot rules + history + undo + atomic pause-all

## Problem statement

`api/ia_v2_autopilot.py` keeps rules + paused-all state in module-level dicts `_RULES`/`_PAUSED_ALL`. The frontend hook `useAutopilotStatus` uses a module-level subscriber pattern for the global System pill. Real implementation needs persistent rules, an audited history table, atomic pause-all, and a real signal for the System pill.

## Scope

In scope:
- Alembic migration: `autopilot_rules`, `autopilot_actions` (history), `autopilot_pause_state` (one row per workspace).
- SQLAlchemy models + `AutopilotRuleRepository`, `AutopilotActionRepository`, `AutopilotPauseStateRepository`.
- Implement all 9 endpoints with persistence: list (filters archived), create, patch, archive, delete (archived-only with 409 otherwise), dry-run, history (with cursor + `rule_id` filter), undo, pause-all/resume-all (snapshot all active rule states, flip atomically, restore on resume).
- Undo: within configured window (default 24h, stored as `expires_at` on `autopilot_actions`), `POST /history/{id}/undo` reverses the recorded outcome (mock side effect — no AWS write — but persists `undone_at`).
- Frontend: `useAutopilotStatus` polls `/autopilot/pause-state` every 30s and exposes `{ pausedAll, activeRuleCount }`. Module-level setters `setAutopilotPausedAll` / `setActiveRuleCount` removed.

Out of scope:
- Real AWS execution of any rule action.
- Real-time push (SSE/WebSocket) — 30s polling acceptable.
- Notification on action — covered separately.

## Acceptance criteria

A1. Alembic migration applies; all 3 tables exist with appropriate indexes.

A2. `POST /pause-all` atomically flips every active rule for the workspace; `affected_rule_count` matches the row count.

A3. `POST /resume-all` restores only the rules that were active at pause-all time (snapshot semantics).

A4. `POST /history/{id}/undo` within window succeeds and writes `undone_at`; after window expires returns 409.

A5. Pytest covers: CRUD; archive-required-before-delete (existing); pause-snapshot-restore correctness; undo idempotency.

A6. Frontend SystemPill flips amber on a real pause-all (verified via puppeteer: navigate to /autopilot, pause-all, verify System pill amber within 30s polling window).

## Quality gates

- Backend pytest covers snapshot/restore + undo window.
- Frontend `npm test` passes with the polling hook.
- `git grep -F 'setAutopilotPausedAll' frontend/src/` returns only the `useAutopilotStatus.js` definition (consumers gone).
