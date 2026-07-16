# IA v2 — System test report

**Date:** 2026-05-17
**Scope:** IA v2 release (option 2 — release-scoped, not vision-level).
**Verdict:** ✅ Ready for release within the stated IA-v2 scope. **NOT** ready as a full product release until deferred follow-ups land (see §6).

---

## 1. Coverage summary

Verified surfaces (live, against the running worktree dev stack):

| Layer | Surface | Method | Outcome |
|---|---|---|---|
| **Automated** | Frontend unit + integration | `npm test` | 357 / 357 ✅ |
| **Automated** | Backend pytest (full, incl. 53 new IA v2) | `pytest` | 648 / 648 ✅ |
| **Live API** | Health / DB / Auth bypass | `curl` | 3 / 3 ✅ |
| **Live API** | IA v2 backend endpoints | `curl` × 10 | 10 / 10 ✅ |
| **Live UI** | IA v2 pages render | Puppeteer | 9 / 9 ✅ |
| **Live UI** | Cross-feature flow (Pause-all → System pill amber) | Puppeteer | ✅ |
| **Live UI** | Legacy URLs 404 | Puppeteer × 5 | 5 / 5 ✅ |
| **Live UI** | `/govern` redirects to `/budgets` | Puppeteer | ✅ |
| **Live UI** | Pre-existing routes still work | Puppeteer × 2 | 2 / 2 ✅ |

---

## 2. End-to-end scenarios exercised

### 2.1 IA v2 shell (feature A)
| Scenario | Result |
|---|---|
| Default landing: `/` redirects to `/inbox` | ✅ |
| Sidebar shows 4 labeled groups + admin; Inbox badge = 11 | ✅ |
| Top bar shows 6 controls right of breadcrumb (Ask Numio, Chat, Theme, Bell, Role, System pill) | ✅ |
| SystemPill renders with green dot in default-healthy state | ✅ |

### 2.2 Understand surfaces (feature B)
| Scenario | Result |
|---|---|
| `/usage` — Cloud tab + 30D + tag:cost-center default; chart title reads "SPEND OVER TIME · LAST 30 DAYS · BY tag:cost-center" | ✅ |
| `/usage` — Untagged callout visible | ✅ |
| `/usage` — UNDERSTAND sidebar group auto-expanded on active route | ✅ |
| `/resources` — 50 rows in first chunk; row height 36px (compact density); infinite-scroll sentinel present | ✅ |
| `/resources` — Default view "All resources" | ✅ |

### 2.3 Optimize surfaces (feature C)
| Scenario | Result |
|---|---|
| `/recommendations` — 7 cards rendered; first card (r-201) pre-expanded; all 6 evidence sections present (signals, affected, what, exclusions, risk, manual) | ✅ |
| `/recommendations` — Single ⟳ Rescan button with "last 2h ago" annotation | ✅ |
| `/autopilot` — Rules tab default active; 5 rule rows; ⏸ Pause all + + New rule buttons present | ✅ |
| **Cross-feature:** Click Pause-all → confirm → page banner appears + page status pill flips to "paused" + global SystemPill in top bar flips to "degraded" (amber) | ✅ |
| **Cross-feature:** Click Resume-all → page pill returns "active" + global SystemPill returns "ok" (green) | ✅ |

### 2.4 Govern surfaces (feature D)
| Scenario | Result |
|---|---|
| `/tag-governance` — Two tabs only (Resources, Tag schema); 50 rows; default view "Missing required tags" | ✅ |
| `/tag-governance` — Activity → link points at `/govern/audit` | ✅ |
| `/tag-governance` — No in-page Ask Numio button (only the global ChatPanel trigger pill survives, by design) | ✅ |
| `/tag-governance` — Cells render `ok` and `missing-req` kinds in the default-filtered view | ✅ |
| `/budgets` — 8 team cards; statuses `{on-track: 5, at-risk: 2, over: 1}`; 8 pacing ticks at expected-pct=48% (day 15/31) | ✅ |
| `/policies` — 7 policies; mode chips render all 3 variants (block / warn / auto); 7 toggles + 7 ⋯ menus; **zero "Edit" buttons in rows** | ✅ |

### 2.5 Backend (feature E)
| Endpoint | HTTP | Shape match |
|---|---|---|
| `GET /api/v1/saved-views?scope=usage` | 200 | ✅ |
| `GET /api/v1/usage` | 200 | scope=cloud, range=30D, 7 series, 7 breakdown, untagged_spend=2840 ✅ |
| `GET /api/v1/usage/tag-keys` | 200 | ✅ |
| `GET /api/v1/inventory/columns/available` | 200 | 3 sections ✅ |
| `GET /api/v1/inventory/resources` | 200 | ✅ |
| `GET /api/v1/recommendations-v2/r-201/evidence` | 200 | ✅ |
| `GET /api/v1/autopilot/rules` | 200 | 3 seeded rules, all `active` ✅ |
| `GET /api/v1/budgets-v2` | 200 | ✅ |
| `GET /api/v1/policies` | 200 | 7 policies; 47 violations aggregate ✅ |
| `GET /api/v1/inbox/badge` → `POST /inbox/findings/{id}/ack` → `GET /inbox/badge` | 200/200/200 | Counter decremented 11 → 10 ✅ |

### 2.6 Regression checks (pre-existing surfaces)
| Scenario | Result |
|---|---|
| `/settings` — renders v1 SettingsPage; H1 "Settings"; sidebar present | ✅ |
| `/ingestion` — renders IngestionPage; H1 "Data Ingestion" | ✅ |
| `GET /health` → DB connected | ✅ |
| `GET /api/v1/auth/me` → bypass admin (`admin@localhost`, role=admin) | ✅ |

### 2.7 Legacy URL handling
Every deleted v1 URL renders the inline `<NotFound>` 404 page (H1 "404 — Page not found"):

| Path | Expected | Actual |
|---|---|---|
| `/overview` | 404 | ✅ 404 |
| `/zombie-hunter` | 404 | ✅ 404 |
| `/feed` | 404 | ✅ 404 |
| `/govern/budgets` | 404 (legacy) | ✅ 404 |
| `/govern/policies` | 404 (legacy) | ✅ 404 |
| `/govern` (no sub-path) | redirect to `/budgets` | ✅ redirected |

---

## 3. Issues found

### Critical
**None.**

### Major
**None.**

### Minor

1. **Frontend pages run on local mock data.** Every IA v2 page imports its data from `mockData.js` files. No page yet calls the new backend endpoints. **By design** per option 2 of the backend feature; flagged here for transparency. Promotion path: flip each page from mock import to fetch over the new endpoints. Tracked under `ia_v2_backend_support` follow-up.
2. **Backend scaffolds keep state in module-level dicts.** `ia_v2_autopilot`, `ia_v2_policies`, and `ia_v2_inbox` survive across requests within a single process but reset on restart. Real persistence is deferred to a separate engagement.
3. **Legacy `/ai-usage` and `/cloud-usage` routes survive.** No sidebar link points to them; reachable only by direct URL. Their v1 pages render with a `<PendingRedesignPanel>` placeholder where they used to embed deleted v1 components. Cleanup is one route deletion + page-file deletion when stakeholders sign off the new `/usage`.
4. **Visual pixel-diff vs design mocks not executed.** Each page's tests assert structure + data binding; full visual diff against `docs/design-mocks/numio-ia-v2/project/*.jsx` is a human-eye review.
5. **AuthZ on the backend scaffolds is bypass-admin-only.** Owner/shared/non-owner-delete row-level enforcement is deferred to persistence time.

### Not in scope

This was a **release-scoped** system test (option 2). The following were **not** exercised; they belong to a vision-level system test that should run after the deferred work lands:
- CUR ingestion against a real AWS account.
- AWS onboarding wizard (CFN template, IAM trust validation).
- Tag write-back to AWS (covered by the separate `tasks/features/20260515_tag_management.md` feature).
- Autopilot real execution against AWS (explicitly out-of-scope across the IA v2 feature plan).
- LLM-backed recommendations evidence.

---

## 4. What was fixed vs escalated

**Fixed:** Nothing required in-flight. All scenarios passed first execution.

**Escalated:** The 5 minor items above are existing project-plan decisions (mocks, scaffolds, legacy cleanup). They are not bugs to fix; they are work items for the next engagement.

---

## 5. Sign-off recommendation

✅ **Ready for IA v2 release** within the option-2 scope:
- UI restructure is complete and stable.
- Every IA v2 surface renders, navigates, and exercises its mock data end-to-end.
- Backend API contracts are pinned in code and respond against the live stack.
- No regressions in the existing 648-test backend suite.
- Auth bypass + health + database flow remain intact.

❌ **Not ready for a full IA-v2 production cut** until these land:
1. Backend persistence (alembic migrations + SQLAlchemy models + repositories) for all 8 IA v2 areas.
2. Frontend mock-strip — each page flips from `mockData.js` import to fetch over the API.
3. AuthZ tightening on the backend scaffolds.
4. Legacy v1 cleanup of `/ai-usage` and `/cloud-usage`.
5. Visual pixel-diff sign-off by a human reviewer against the design mocks.
6. A vision-level `/agn:qa-system-test` after the above land.

---

## 6. Next steps

1. Stakeholder review of this report.
2. Schedule the follow-up engagement to land items 1–4 in §5.
3. After follow-up: run `/agn:qa-system-test` again, vision-level scope.
