---
status: backlog
slug: ia_v2_persistence
title: IA v2 backend persistence + frontend mock-strip
---

# IA v2 backend persistence + frontend mock-strip

## Problem statement

Feature `ia_v2_backend_support` shipped 8 backend API scaffolds (Pydantic schemas + FastAPI routers + pytest) returning realistic fixture data. The features delivering the IA v2 frontend (`ia_v2_shell`, `ia_v2_understand`, `ia_v2_optimize`, `ia_v2_govern`) ship pages that consume local mock-data files (`*.mockData.js`). For the IA v2 release to be production-real, every scaffold must be backed by real persistence and every consuming page must call the real API.

## Objective

For each of the 8 IA v2 backend areas: an alembic migration creates the table(s), SQLAlchemy models + a repository replace the in-memory dict, the FastAPI endpoint persists via the repository, AuthZ is tightened to enforce workspace + ownership semantics, and the consuming frontend page is flipped from importing `*MockData.js` to fetching the live endpoint. After all 8 land, no IA v2 page reads from a local mock data file.

## Scope

In scope:
- 8 backend areas: saved views, tag-as-dimension usage, resources inventory, recommendations evidence + rescan, autopilot rules + history, budgets pacing, policies + bulk, inbox badge + ack.
- Per area: alembic migration; SQLAlchemy model(s); repository; tighten endpoint AuthZ (owner/workspace/role gating); rewire the consuming frontend page(s) from `*MockData.js` to API client; integration test (frontend + backend) covering the happy path of each consuming page.

Out of scope:
- New API capabilities beyond what the scaffolds already document — the schemas pinned in `backend/src/numio/schemas/ia_v2_*.py` are the contract.
- LLM-backed evidence generation for recommendations — keep rules-based.
- Real Autopilot execution against AWS — store and present; never act.
- Tag write-back to AWS — owned by `tasks/features/20260515_tag_management.md`. The TagGovernance page's wiring to the existing tag governance + compliance APIs is also tracked there, not here.

## Acceptance criteria

A1. For each of the 8 areas: an alembic migration creates the required tables, applied idempotently in dev (`./scripts/numio-dev.sh migrate`) and in CI.

A2. For each of the 8 areas: a pytest exists that asserts a CRUD round-trip persists across process restarts (uses the `db_session` fixture; no module-level state).

A3. For each of the 8 areas: AuthZ enforces workspace scoping (no cross-workspace reads) and ownership where applicable (e.g. saved views: only owner can delete).

A4. After all 8 tasks land: `git grep -F 'MockData' frontend/src/pages/` returns zero hits inside IA v2 page directories (Usage, Resources, Recommendations, Autopilot, Budgets, Policies, Inbox). `usageMockData.js`, `resourcesMockData.js`, `recommendationsMockData.js`, `autopilotMockData.js`, `tagGovernanceMockData.js` (kept by `tag_management`), are deleted or the only remaining consumer is tests.

A5. After all 8 tasks land: every IA v2 page renders identical (mocked) data when its API call is intercepted (network mocks in tests) AND renders real data from the backend in the running dev stack.

A6. The IA v2 SystemPill flips amber when a real Autopilot pause-all is persisted, not just the in-memory subscriber pattern.

A7. The IA v2 Inbox badge count reflects real per-finding ack state from the database (replacing `useInboxUnreadCount` stub).

## Tasks

Execute in order. Each task is self-contained (backend persistence + frontend mock-strip + integration test) so it can ship independently and revert independently:

1. `ia_v2_persist_inbox_badge` — smallest surface; validates the pattern (alembic + model + repo + auth + frontend hook flip).
2. `ia_v2_persist_saved_views` — needed by multiple pages; lands second so subsequent tasks can persist their saved views via this API.
3. `ia_v2_persist_budgets` — independent area.
4. `ia_v2_persist_policies` — independent area.
5. `ia_v2_persist_autopilot_rules` — replaces the module-level `_RULES`/`_PAUSED_ALL` dicts; wires `useAutopilotStatus` to real WebSocket or polling.
6. `ia_v2_persist_recommendations_evidence` — Rescan dedupe moves from in-memory dict to a durable lock.
7. `ia_v2_persist_inventory` — cursor pagination over real `cloud_resources`; bulk export job runs; bulk hibernate is still a stub (no AWS write).
8. `ia_v2_persist_usage` — most complex: cost_records group_by tag-key (JSONB extract); Untagged bucket.

## Linked design mocks

Backend contracts already pinned in `backend/src/numio/schemas/ia_v2_*.py`. Frontend page mocks at `docs/design-mocks/numio-ia-v2/project/*.jsx` are canonical for the consuming UI.

## Linked spec

The scaffolded FastAPI routes are themselves the contract: `backend/src/numio/api/ia_v2_*.py`. Any deviation must be agreed in this feature and reflected back into the schema files before persistence work begins.
