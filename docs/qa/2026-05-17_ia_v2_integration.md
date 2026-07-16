# IA v2 — Integration test report

**Date:** 2026-05-17
**Scope:** Numio IA v2 rollout — features `ia_v2_shell`, `ia_v2_understand`, `ia_v2_optimize`, `ia_v2_govern`, `ia_v2_backend_support` (20 tasks total).
**Result:** ✅ Pass. No regressions found.

## What was executed

### 1. Frontend unit + integration suite
```
cd frontend && npm test
```
- 35 test files, 357 tests, all passing.
- Includes 134 new tests across the IA v2 work (V2Sidebar, SystemPill, UsagePage, ResourcesPage, RecommendationsPage, SendToAutopilotModal, AutopilotPage, TagGovernancePage, BudgetsPage, PoliciesPage).

### 2. Frontend production build
```
cd frontend && npm run build
```
- Build succeeded; no type/bundler errors.
- New lazy-loaded chunks visible: `UsagePage`, `ResourcesPage`, `AutopilotPage`, `RecommendationsPage`, etc.

### 3. Backend full test suite
```
cd backend && PGPORT=50784 DATABASE_URL=…/numio_test VIRTUAL_ENV=.venv uv run --active pytest
```
- 648 tests passing (53 new IA v2 scaffolds + 595 pre-existing).
- No pre-existing tests regressed by the new routers, schemas, or `main.py` mount changes.

### 4. Live SPA route check
Frontend dev server at `http://localhost:50788`. Every IA v2 route returns 200 (SPA hands back `index.html`; client-side router handles the actual page):

| Path | HTTP | Notes |
|------|-----:|-------|
| `/` | 200 | Redirects to `/inbox` in-app |
| `/inbox` | 200 | Inbox page |
| `/usage` | 200 | Unified Usage |
| `/resources` | 200 | Dense resources table |
| `/recommendations` | 200 | Evidence cards |
| `/autopilot` | 200 | Rules + History |
| `/tag-governance` | 200 | Dense tag table |
| `/budgets` | 200 | Pacing cards |
| `/policies` | 200 | Mode-chip table |

### 5. Live backend endpoint check
Backend at `http://localhost:50786`. Every IA v2 backend route returns 200:

| Method | Path | HTTP |
|--------|------|-----:|
| GET | `/api/v1/saved-views?scope=usage` | 200 |
| GET | `/api/v1/usage` | 200 |
| GET | `/api/v1/usage/tag-keys` | 200 |
| GET | `/api/v1/inventory/columns/available` | 200 |
| GET | `/api/v1/inventory/resources` | 200 |
| GET | `/api/v1/recommendations-v2/r-201/evidence` | 200 |
| GET | `/api/v1/autopilot/rules` | 200 |
| GET | `/api/v1/budgets-v2` | 200 |
| GET | `/api/v1/policies` | 200 |
| GET | `/api/v1/inbox/badge` | 200 |

### 6. Response shape spot-checks
- `GET /usage` → `scope=cloud, range=30D, group_by=tag:cost-center`; 7 series, 7 breakdown rows; `untagged_spend=2840`. Matches the frontend's `UsagePage` contract.
- `GET /autopilot/rules` → 3 seeded rules, all `active`.
- `GET /policies` → 7 policies; mode distribution `{block: 4, warn: 2, auto: 1}`; 47 open violations aggregate.
- `GET /inbox/badge` → `{unread_count: 11, triage_count: 11, critical_count: 1, fetched_at: 2026-05-17T...}`.
- Mutation flow: `GET /inbox/badge` → 11 unread → `POST /inbox/findings/f-1/ack` → `new_unread_count: 10`. Round-trip works.

### 7. Health
- `GET /health` → `{"service":"numio","status":"ok","database":"connected"}`.

## Pass/fail per scenario

| # | Scenario | Result |
|---|----------|-------:|
| 1 | Frontend unit + integration tests | ✅ 357 / 357 |
| 2 | Frontend production build | ✅ |
| 3 | Backend pytest (all) | ✅ 648 / 648 |
| 4 | SPA serves all 9 IA v2 routes | ✅ 9 / 9 |
| 5 | Backend serves all 10 IA v2 endpoints | ✅ 10 / 10 |
| 6 | Response shapes match frontend contract | ✅ Spot-checked 5 |
| 7 | Mutation round-trip (inbox ack) | ✅ Counter decremented |
| 8 | `/health` reports database connected | ✅ |

## Regressions found

**None.** All 595 pre-existing backend tests continue to pass after the `main.py` import + `include_router` changes. All 223 pre-existing frontend tests continue to pass after the page-level rewrites.

## Open issues

1. **Frontend pages run on local mock data** — by design, per the scaffold-only decision for `ia_v2_backend_support`. The IA v2 frontend does not yet call the new backend endpoints. Each page consumes hardcoded fixtures (e.g. `usageMockData.js`, `autopilotMockData.js`). The next engagement should flip each page from mock import to API fetch.

2. **Backend scaffold state is in-memory** — `ia_v2_autopilot`, `ia_v2_policies`, and `ia_v2_inbox` keep state in module-level dicts. Restart clears it. Persistence (alembic migrations + SQLAlchemy models + repositories) is deferred.

3. **Legacy v1 surfaces still routed:**
   - `/ai-usage` and `/cloud-usage` continue to serve their v1 pages with a placeholder panel. They are no longer linked from the sidebar (sidebar Usage points to `/usage`). A future task can delete them once the v2 Usage page is signed off.

4. **Interim 404s by design (not regressions):**
   - The Send-to-Autopilot modal's `Open rule editor →` link navigates to `/autopilot?new=true&prefill=<id>`. This works (Autopilot page opens the New Rule modal on that query). Confirmed via Autopilot tests.
   - No remaining interim 404s — all sidebar destinations resolve.

5. **Manual visual diff vs design mocks** — not executed in this run. Each page's tests assert structure + data-binding; full pixel-perfect diff against `docs/design-mocks/numio-ia-v2/project/*.jsx` requires a human review.

6. **QA system test** — not performed. `/agn:qa-system-test` should run before any production cut to validate cross-feature integration (auth bypass mode, role gating on `/data-explorer`, etc.).

## Recommendation

The IA v2 rollout is feature-complete at the integration-test level. Frontend and backend test suites are both green; live endpoints respond; routes serve. **No release-blocking issues.**

Before promoting to production:
1. Run `/agn:qa-system-test` for full release readiness.
2. Execute the deferred follow-ups documented in each feature's `## Summary` (persistence layer, frontend mock-strip, legacy v1 cleanup).
3. Stakeholder sign-off on the visual diff vs the design mocks.
