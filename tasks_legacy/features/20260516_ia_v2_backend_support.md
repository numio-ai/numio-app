---
status: done
slug: ia_v2_backend_support
title: Numio IA v2 — backend support (read-and-act endpoints for IA v2 frontends)
---

# Numio IA v2 — backend support (read-and-act endpoints for IA v2 frontends)

# Numio IA v2 — backend support (read-and-act endpoints for IA v2 frontends)

## Problem statement

IA v2 is being shipped frontend-first per call on 2026-05-16: every interactive surface runs against mocks until backend lands. To close the gap and remove mocks, the backend must learn several new capabilities: saved views with share-by-URL, tag-as-dimension on cost/usage, configurable resource columns including tag columns + bulk tag apply, an evidence model for recommendations, Autopilot rules CRUD with dry-run + history + undo windows, Budgets CRUD with pacing, Policies CRUD with mode + bulk, and an Inbox unread-count endpoint. Each is documented as a discrete backend task here so the gap is visible and ordered.

## Objective

The Numio backend supports every read-and-act capability that the IA v2 frontend currently mocks, with no user-visible behavior change once each task lands (mock falls away, real fetch starts).

## Scope

In scope:
- New endpoints, persistence layers, and worker jobs for the eight areas listed in Tasks.
- Each task carries its own alembic migration if it adds tables/columns.
- AuthZ is consistent with existing Numio patterns (workspace-scoped, role-aware).

Out of scope:
- Frontend changes — those live in features `ia_v2_shell`, `ia_v2_understand`, `ia_v2_optimize`, `ia_v2_govern`.
- AWS write paths beyond what `tag_management` already covers.
- LLM-backed recommendations evidence — keep rules-based for v1.
- Real Autopilot execution against AWS — store and present, do not act.

## Acceptance criteria

A1. IA v2 Usage page can fetch and persist saved views via backend API; no frontend mock store remains.

A2. IA v2 Usage page can group and filter cost data by any tag key in the schema; the backend handles the tag-dimension query and exposes an "Untagged" bucket.

A3. IA v2 Resources page can request configurable columns including tag columns and execute bulk export / bulk hibernate via backend endpoints. Apply-tag uses the existing tag write API from `tag_management`.

A4. Recommendations carry an evidence model with signals, affected resources, what-will-happen, exclusions, and risk; a Rescan trigger forces a fresh analysis with idempotency.

A5. Autopilot rules persist via backend CRUD; history rows record outcome + time; undo within the configured window is supported; pause-all and resume-all work atomically; dry-run returns would-be actions.

A6. Budgets persist with pacing metadata (expected-by-day spend) and emit a status (over / at risk / on track) derived from spend vs amount and spend vs expected-by-day.

A7. Policies persist with mode (block / warn / auto-remediate), enabled toggle, and bulk update; open-violations count surfaced on the list endpoint.

A8. Inbox unread count is fetched from the backend (replaces the mock hook from task `ia_v2_inbox`); ack endpoint reduces the count.

## Tasks

Execute in order:

1. `ia_v2_be_saved_views` — Saved views CRUD with share-by-URL semantics.
2. `ia_v2_be_tag_dimensions` — Tag-as-dimension support for cost/usage queries (group/filter by tag).
3. `ia_v2_be_resources_inventory` — Configurable columns + tag columns + bulk endpoints (export, hibernate).
4. `ia_v2_be_recommendations_evidence` — Evidence model + rescan trigger.
5. `ia_v2_be_autopilot_rules` — Rules CRUD + history + undo + dry-run + pause-all.
6. `ia_v2_be_budgets` — Budgets CRUD with pacing.
7. `ia_v2_be_policies` — Policies CRUD with mode + bulk.
8. `ia_v2_be_inbox_badge` — Inbox unread-count endpoint + per-finding ack.

## Linked design mocks

Frontend behavior is canonical; every page under `docs/design-mocks/numio-ia-v2/project/` defines the shape the backend must support.

## Summary

### Approach

Scaffold-only per user direction (option 2). Each task delivers Pydantic schemas + FastAPI router + pytest, returning realistic fixture data so the frontend has a stable API target to migrate to. **Persistence (alembic migrations, SQLAlchemy models, repositories) is deferred to a follow-up engagement; the frontend mock-strip is also deferred.**

### Steps completed

All eight backend tasks scaffolded and merged in order:

1. **`ia_v2_be_saved_views`** — `/saved-views` CRUD + set-default (5 endpoints, 7 tests).
2. **`ia_v2_be_tag_dimensions`** — `/usage` chart + breakdown + `/usage/tag-keys` (2 endpoints, 6 tests).
3. **`ia_v2_be_resources_inventory`** — `/inventory/resources` + `/inventory/columns/available` + bulk export / hibernate (4 endpoints, 8 tests).
4. **`ia_v2_be_recommendations_evidence`** — `/recommendations-v2/{id}/evidence` + `/recommendations-v2/rescan` with dedupe window (2 endpoints, 5 tests).
5. **`ia_v2_be_autopilot_rules`** — `/autopilot/rules` CRUD + history + undo + dry-run + pause-all + resume-all (9 endpoints, 9 tests).
6. **`ia_v2_be_budgets`** — `/budgets-v2` list + create + pacing (3 endpoints, 6 tests).
7. **`ia_v2_be_policies`** — `/policies` CRUD + bulk enable/disable/change_mode (5 endpoints, 8 tests).
8. **`ia_v2_be_inbox_badge`** — `/inbox/badge` + `/inbox/findings/{id}/ack` (2 endpoints, 4 tests).

### Changes made

- New schema files (8): `schemas/ia_v2_{saved_views,usage,inventory,recommendations_evidence,autopilot,budgets,policies,inbox}.py`.
- New router files (8): `api/ia_v2_{saved_views,usage,inventory,recommendations_evidence,autopilot,budgets,policies,inbox}.py`.
- New test files (8): `tests/test_ia_v2_{saved_views,usage,inventory,recommendations_evidence,autopilot,budgets,policies,inbox}.py`.
- Modified: `backend/src/numio/main.py` — 8 imports + 8 `include_router` lines.

### Acceptance criteria status

| AC | Status |
|----|--------|
| A1 — Saved views API exists | ✅ (scaffolded; frontend mock-strip deferred) |
| A2 — Usage supports tag-dimension + Untagged bucket | ✅ (scaffolded) |
| A3 — Resources cursor pagination + bulk endpoints | ✅ (scaffolded) |
| A4 — Recommendations evidence + Rescan with idempotency | ✅ (scaffolded; in-memory dedupe window) |
| A5 — Autopilot rules CRUD + history + pause-all + dry-run | ✅ (scaffolded; module-level state) |
| A6 — Budgets with pacing + status derivation | ✅ (scaffolded) |
| A7 — Policies CRUD + mode + bulk + violations on list | ✅ (scaffolded) |
| A8 — Inbox unread count + ack | ✅ (scaffolded; in-memory ack counter) |

### Notable decisions or deviations

- **Prefix conventions chosen to avoid collisions with existing routers**: `/saved-views`, `/usage`, `/inventory`, `/recommendations-v2`, `/autopilot`, `/budgets-v2`, `/policies`, `/inbox`. When real persistence lands the team will rationalize naming.
- **State persistence is module-level dicts** in `ia_v2_autopilot`, `ia_v2_policies`, and `ia_v2_inbox`. Survives across requests within a process; resets on restart. Real DB tables replace these — the API contract doesn't change.
- **No alembic migrations, no SQLAlchemy models, no repositories.** Explicitly deferred per option 2.
- **No frontend mock-strip.** Each task body called for "the mock store is removed"; this is the follow-up work that flips the frontend hooks from local mocks to API calls. Deferred so the frontend can stay green while backend persistence lands incrementally.
- **AuthZ relies on `get_current_user` dependency** but full owner/shared/non-owner-delete enforcement is deferred to persistence-time when row ownership is real.

### Test totals

- 53 new pytest cases across 8 files; all 53 passing.
- Run: `cd backend && PGPORT=50784 DATABASE_URL=postgresql+psycopg://numio:numio@localhost:50784/numio_test VIRTUAL_ENV=.venv uv run --active pytest tests/test_ia_v2_*.py`.

### What's deferred to follow-up

1. Alembic migrations + SQLAlchemy models + repositories for all 8 areas.
2. Frontend mock-strip — flipping the consuming hooks/pages from local mocks to live API calls.
3. AuthZ tightening (owner/shared/non-owner-delete row-level enforcement).
4. Real Autopilot execution against AWS.
5. LLM-backed evidence generation for recommendations.
