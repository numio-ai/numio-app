---
status: done
slug: mock_backend_switch
title: Frontend mock/real backend switch
---

# Frontend mock/real backend switch

## Problem statement

Numio needs a realistic customer demo of the full React UI as soon as possible, run standalone with no backend, no database, and no AWS connectivity. The current frontend reaches the backend through 9 modules in `frontend/src/api/` (~112 async functions, each wrapping a per-module `request()` fetch helper). An existing mock library in `frontend/src/mocks/` is imported directly by pages as static data — it does not flow through the API layer, so the app cannot run end-to-end without a backend. Components, pages, and hooks call the API functions directly; there is no React Query, SWR, or service abstraction, so the API modules are the single natural seam.

The same need recurs twice more. When the backend is ready, the team wants the identical UI code to talk to it by flipping one config, with zero call-site changes. The same mock layer must back deterministic UI tests (Vitest component tests and Puppeteer E2E).

## Objective

One build-time switch selects mock or real data for the whole app. In mock mode the app runs end-to-end against generated synthetic data with no backend reachable. In real mode the identical source talks to the backend. No application source file changes between modes. Both Vitest and Puppeteer run the app in mock mode for deterministic results.

## Scope

In scope:

- A single build-time switch (`VITE_API_MODE=mock|real`) selecting the data source for the whole app.
- A single shared API client (`src/api/client.js`) consolidating the 9 duplicated `request()` helpers, with the mock/real decision inside its one `request()` function, selected at build time by `VITE_API_MODE` behind unchanged call sites. This retires the fragile `stripMocksInProd` Vite plugin, whose job (keeping fake data out of production) is subsumed by build-mode selection.
- A synthetic data layer built on the existing `frontend/src/mocks/` infrastructure, generating plausible, cross-screen-consistent data for every UI domain.
- Mock coverage of every endpoint the UI calls across all 9 API modules, including write handling.
- Artificial latency on mock responses so loading spinners and skeletons render.
- Reuse of the mock layer by Vitest component tests and a Puppeteer E2E harness.
- Documentation of the switch in `docs/dev-runbook.md` and the env var in `frontend/.env.example`.

Out of scope:

- Building real backend endpoints.
- A runtime in-app toggle. The switch is build-time only.
- Demo scripting or narration beyond plausible-looking data.
- Refreshing the sibling `numio-demo` repo. That is a separate follow-up the team runs after this feature.
- Forced error-state simulation in mock responses.

## Acceptance criteria

1. Setting `VITE_API_MODE=mock` makes the dev server render the entire app from synthetic data with no backend reachable. Setting `VITE_API_MODE=real` makes the identical source talk to the backend. No build other than the env var differs.
2. Components, pages, and hooks import and call the same API functions in both modes. No application source file outside the API layer and mock layer changes between modes.
3. Every endpoint the UI calls is served in mock mode. The app navigates end-to-end across all screens with no backend and no unhandled request error.
4. Synthetic data is programmatically generated and plausible for a customer demo: reasonable cost figures, valid-shaped AWS account IDs, real AWS service names, and coherent time trends. The same entity reads consistently across every screen that shows it.
5. The mock layer lives in the production `frontend/` codebase and reuses the existing `frontend/src/mocks/` infrastructure. It is not a clean rebuild and does not depend on `numio-demo`.
6. The mock layer is organized to mirror the real API-module structure, so a change to one API module maps to one mock unit.
7. Vitest component tests and a committed Puppeteer E2E harness run the app or components in mock mode and pass deterministically across repeated runs.
8. Mock responses include a small artificial delay, so loading spinners and skeletons render during the demo.

## Tasks

1. `switch_dispatch_seam` — consolidate the 9 duplicated `request()` helpers into a shared `src/api/client.js`, put the mock/real decision inside its `request()` (selected by `VITE_API_MODE`), add the latency hook, and prove it on a thin vertical slice (acceptance criteria 1, 2, 6, 8).
2. `synthetic_data_core` — seeded deterministic generator, shared canonical entities (accounts, services, regions, demo time window), and the cross-screen consistency + determinism harness the domain datasets build on (acceptance criteria 4, 5).
3. `synthetic_data_cost` — cost/usage/budget data (totals, time-series, by-dimension, trends, budgets and alerts), reconciling against the canonical entities (acceptance criterion 4).
4. `synthetic_data_governance` — tag governance, compliance, findings, recommendations, infra policies, and resource inventory data, consistent with the canonical entities (acceptance criterion 4).
5. `synthetic_data_platform` — workspace/users/API keys/automation, accounts/onboarding/auth, and ops data (jobs, audit, inbox, chat, data explorer), consistent with the canonical accounts (acceptance criterion 4).
6. `endpoint_coverage` — wire all 9 API modules / ~112 functions to mock mode using that data, including write handling, so the app runs end-to-end with no backend (acceptance criterion 3).
7. `test_integration` — run Vitest component tests and a Puppeteer E2E harness against the app in mock mode for deterministic results (acceptance criterion 7).
8. `docs_env_example` — document the switch in `docs/dev-runbook.md` and add `VITE_API_MODE` to `frontend/.env.example`.

## Linked spec

`docs/frontend/mock-backend-spec.md` — the implementation contract. It holds the dispatch architecture, mock module contract, and synthetic data model. It resolves the three previously-deferred decisions: (1) the mock/real choice is a single branch inside the consolidated shared `request()` client (`src/api/client.js`) selected at build time by `VITE_API_MODE` — no MSW, no runtime dependency — and the legacy `stripMocksInProd` plugin is retired; (2) mock writes mutate an in-memory, session-scoped store, not no-op stubs; (3) only the selected branch is bundled, the other is tree-shaken out via the statically-replaced flag.

## Summary

All 8 tasks delivered, each validated and committed on branch `feature/mock_backend_switch`.

### What shipped
- **Switch + seam** (`switch_dispatch_seam`): `frontend/src/api/client.js` — one `ApiError`, one `request()`, with the mock/real decision a single `VITE_API_MODE` branch using a gated dynamic import. All 9 API modules consolidated onto it; `dashboard.js`'s 14 inline-fetch writes routed through it; `DataExplorerError` kept as an `ApiError` subclass. `vite.config.js`: `stripMocksInProd` removed, `define` added.
- **Synthetic data** (`synthetic_data_core/cost/governance/platform`): `frontend/src/mocks/synthetic/` — seeded mulberry32 generator + `allocate()`, canonical entities (accounts/services/regions/fixed demo window), and a reconciliation/determinism harness; cost (single fact table → all views reconcile), governance (one resource inventory → findings/recs/policies/non-compliant cross-reference; rec savings reconcile to summary), and platform (workspace/users/keys/automation/accounts/onboarding/auth/jobs/ingestion/inbox/notifications/audit/chat/data-explorer; integration list = canonical accounts).
- **Coverage** (`endpoint_coverage`): per-domain handler files under `frontend/src/api/mock/` covering all 102 endpoints, a mutable session store (writes reflect in reads), registry with coverage instrumentation.
- **Tests** (`test_integration`): `src/test/mockMode.js` opt-in Vitest helper + mock-seam test; Puppeteer `e2e/run.mjs` + `npm run test:e2e`.
- **Docs** (`docs_env_example`): `VITE_API_MODE` in `frontend/.env.example`, "Frontend mock mode" section in `docs/dev-runbook.md`, spec listed in `CLAUDE.md`.

### Acceptance criteria — met
1–8 all satisfied. Verified at feature level: `npm test` 453 passed / 46 files; `VITE_API_MODE=mock npm run build` and the default real build both succeed; **real-build dist audit shows zero synthetic/mock code** (generator, dispatch, canonical ids all tree-shaken out); `npm run test:e2e` exits 0 with no backend, deterministic across runs; browser walk renders 13 routes with no missing-handler and no error boundary; the consolidated client retired `stripMocksInProd` and the 9 duplicate helpers.

### Notable decisions
- DCE via gated dynamic import (not `sideEffects:false`), proven by the dist audit.
- Resources are owned by the governance dataset (core defines only accounts/services/regions/window per spec §5.1), built from canonical entities.
- Vitest mock mode is opt-in via `vi.stubEnv` (not a global define), so real-mode unit tests are unaffected.
- A few low-traffic writes (infra-policy/campaign CRUD) return shaped echoes rather than persisting; the major write flows reflect via the store.

### Commits
`73fd125` (seam) · `6dd058b` (core) · `f93fb83` (cost) · `ba6f8b2` (governance) · `32547a0` (platform) · `419f01c` (coverage) · `d45f490` (tests) · `8ef9064` (docs).

### Follow-ups (out of scope, already backlogged)
- `api_client_dry_refactor` — centralize query/body construction across call sites.
- Refresh the sibling `numio-demo` repo (separate team follow-up).
