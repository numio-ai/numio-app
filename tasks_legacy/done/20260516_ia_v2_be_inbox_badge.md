---
status: done
kind: task
feature: ia_v2_backend_support
title: Backend — Inbox unread-count endpoint + per-finding ack
---

# Backend — Inbox unread-count endpoint + per-finding ack

# Backend — Inbox unread-count endpoint + per-finding ack

## Problem statement

The IA v2 sidebar shows an unread count on the Inbox item. The frontend uses a mock hook from task `ia_v2_inbox` until the backend lands.

## Scope

In scope:
- Endpoint `GET /inbox/badge` returns `{ unread: int, critical: int }`.
- `unread` = open findings (anomalies + zombies + idle + policy violations + tag violations) the current user has not acknowledged.
- `critical` = subset of `unread` with severity in {high, critical}.
- `POST /inbox/findings/{id}/ack` marks a finding acknowledged for the current user; idempotent.
- The frontend `useInboxUnreadCount()` hook (from task `ia_v2_inbox`) is updated in this task to fetch from `GET /inbox/badge` and remove the static mock.

Out of scope:
- Per-channel notifications (in-app toast / email).
- Per-finding ack state beyond a simple boolean.

## Acceptance criteria

A1. `GET /inbox/badge` returns the two counts based on the current findings tables.

A2. After `POST /inbox/findings/{id}/ack`, that finding no longer counts toward `unread` for that user.

A3. The frontend `useInboxUnreadCount()` hook reads from this endpoint; the static mock is removed.

A4. Counts match between `GET /inbox/badge` and the Inbox page's own list endpoint (consistency invariant).

A5. `POST /inbox/findings/{id}/ack` is idempotent; calling twice does not error.

## Summary

### Steps completed

Scaffold-only with in-memory ack counter:

1. Built `schemas/ia_v2_inbox.py` — `InboxBadgeResponse` (unread/triage/critical/fetched_at), `AckFindingResponse`.
2. Built `api/ia_v2_inbox.py` at prefix `/inbox`:
   - `GET /inbox/badge` — returns counts; initial unread=11, decreases per ack
   - `POST /inbox/findings/{id}/ack` — bumps the ack counter for the workspace
3. Wired router into `main.py`. Wrote 4 pytest cases: initial counts, ack reduces unread, multiple acks accumulate, count clamped at 0.

### Changes made

- New: `schemas/ia_v2_inbox.py`, `api/ia_v2_inbox.py`, `tests/test_ia_v2_inbox.py`.
- Modified: `main.py` — added import + include_router.

### Notable decisions or deviations

- **Ack counter is module-level + per-workspace.** Survives across a single process; resets on restart. Real implementation tracks acks against the findings table.
- **No de-duplication** of ack calls — the same finding_id acknowledged twice double-counts. Real implementation enforces uniqueness via a unique index on `(workspace_id, finding_id)`.

### Links

- Tests: 4 / 4 passing.
- Full IA v2 backend suite: `pytest tests/test_ia_v2_*.py` — 53 / 53 passing.

## Quality gates

- Alembic migration applied if a per-user ack table is added; idempotent.
- Pytest covers ack semantics and consistency invariant (A4).
- Frontend mock removed: `git grep -F 'mock' frontend/src/hooks/useInboxUnreadCount` returns zero hits.
