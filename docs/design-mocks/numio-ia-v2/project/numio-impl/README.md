# Numio · Tag Governance — Implementation Drop

These files implement the v5 Tag Governance design. Copy them into your repo at the paths shown — they target the existing Numio frontend structure.

## Files & targets

| File in this drop | Target path in `numio-app/frontend/src/` |
|---|---|
| `mocks/mockTagManagement.js` | `mocks/mockTagManagement.js` (replace) |
| `pages/TagGovernance/TagGovernancePage.jsx` | `pages/TagGovernance/TagGovernancePage.jsx` (replace) |
| `pages/TagGovernance/components/*.jsx` | `pages/TagGovernance/components/*.jsx` (new folder) |
| `pages/TagGovernance/styles.js` | `pages/TagGovernance/styles.js` (new) |

The old `TagGovernancePage.jsx` (Dashboard / Policies / Campaigns tabs) is preserved at `_reference/TagGovernancePage.legacy.jsx`. The `PolicyEditorModal.jsx`, `CampaignDetailModal.jsx`, and `CreateCampaignModal.jsx` files in the existing folder are **left alone** — they're still wired to backend endpoints and remain reachable if you want to keep the policy/campaign flows alongside.

## What stays the same

- Routing: `/tag-governance` route in `App.jsx` already points at `TagGovernancePage.jsx` — no router change needed.
- Sidebar: `OverviewSidebar.jsx` already has a "Tag Governance" item — no nav change.
- Shell: page renders inside the existing `OverviewLayout` (SlimTopBar + sidebar + chat rail) automatically.
- Data: extends `mockTagManagement.js` (already there) with `source` field and AWS Org helpers. All existing exports preserved.
- Audit: the inline "Recent changes" strip links out to the existing `/govern/audit` page — no new audit UX.

## What's new on the backend (assumptions)

These are spelled out in the design's Decision Log artboard. The mock layer fakes them today; backend should wire to real endpoints later.

1. **Dry-run preview** — `POST /api/v1/tags/preview { resource_ids, changes }` → `{ affected, prod_count, total_spend, validation_errors }`
2. **Bulk apply** — `POST /api/v1/tags/apply` → `{ succeeded: [], failed: [{ resource_id, reason }] }` for the partial-failure toast
3. **Auto-seed scan** — `POST /api/v1/tags/scan` → discovered keys + AWS Org policies + coverage stats
4. **AWS Org sync** — `GET /api/v1/tags/org-policies` and conflict detection server-side
5. **Audit entries with previous value** — every `tag.set` event needs prev value so undo has a target
6. **Confidence score** per AI suggestion (0–1), used to gate auto-fix

## Quick smoke test BEFORE dropping into your repo

Open `numio-impl/preview.html` in a browser. It loads the same `.jsx` files via Babel and renders the page with stubbed-out `useChat` / `useAuth` / `useNavigate`. If the preview renders cleanly there, the same code will render cleanly in your repo after you drop it in.

This is **not** a substitute for `npm run dev` — the real shell (SlimTopBar + OverviewSidebar + ChatPanel) only appears once routed through `OverviewLayout`. The preview just verifies the page-internal components work.

## Quick smoke test AFTER dropping in

```bash
cd numio-app/frontend
npm run dev
# open http://localhost:5173/tag-governance
```

You should see the Resources tab as the default landing, with the heatmap, KPIs across the top, and the legend below. Clicking any cell opens the value picker; clicking the resource cell expands the row inline.

Tabs: **Resources** | **Schema** (Audit links out to `/govern/audit`).

## Wiring the agent (Ask Numio)

The page uses `useChat()` from `components/ChatProvider` — already wired in your app. The page's "Ask Numio to fix" buttons call `openChat(prefilledText)` which opens the right-side chat rail with the prompt pre-filled. The user can edit and send.

## What's still TODO before production

- Replace the mock data calls with real API endpoints (see assumptions above).
- Wire `user.role === "admin"` gates on edit/apply actions (the components accept a `readOnly` prop; the page reads it from `AuthContext`).
- Add the mobile redirect screen behind `useIsMobile()` — components are responsive but the design specs a dedicated mobile screen.
- Keyboard nav (`j/k/↵`) — components are structured for it but handlers not wired.
- Auto-seed onboarding flow — gated on "first load with no schema defined" which the backend reports.
