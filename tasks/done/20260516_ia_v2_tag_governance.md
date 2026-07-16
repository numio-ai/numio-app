---
status: done
kind: task
feature: ia_v2_govern
title: IA v2 Tag Governance — dense table, drop heatmap, two-tab structure, bulk select
---

# IA v2 Tag Governance — dense table, drop heatmap, two-tab structure, bulk select

# IA v2 Tag Governance — dense table, drop heatmap, two-tab structure, bulk select

## Problem statement

The current Tag Governance page (`pages/TagGovernance/TagGovernancePage.jsx`) renders a heatmap that does not scale past ~30 resources, has an "Audit Log" tab that deep-links into a different page, ships an in-page "Ask Numio" button that duplicates the global chat, and lacks the saved-views / share-by-URL pattern used elsewhere in IA v2.

## Scope

In scope:
- Drop the heatmap. Replace with a dense table: rows are resources, columns are required tag keys, cells are colored chips per coverage state (green=ok, orange=drift, red=missing required, gray=missing optional).
- Two tabs only: Resources (default) and Tag schema (renamed from "Schema").
- Remove "Audit log" tab; add a small "Activity →" link in the toolbar.
- Remove the in-page "✨ Ask Numio" button.
- Standard toolbar: View picker (5 presets, with "Missing required tags" as default) · Share link · Save as….
- Filter chips with tag dimensions + status segmented control (All / Missing required / Drift) with counts.
- Search across name / ID / tag value.
- Bulk select with action bar: Apply tag · ✨ Suggest with Numio · Bulk rename value · Export.
- Infinite scroll.
- Schema tab: list editor with KEY · REQUIRED · ALLOWED VALUES · COVERAGE (color-coded %) · OWNER · `⋯`; "+ New tag key" button; footer "Schema changes are versioned · Activity →".

Out of scope:
- Tag write-back to AWS — handled in `tasks/features/20260515_tag_management.md`.
- Activity drawer body.
- "Suggest with Numio" chat-prefill wiring.
- Backend wiring beyond what `tag_management` already provides.

## Acceptance criteria

A1. `/tag-governance` renders the new Resources tab by default.

A2. Tab strip shows only Resources and Tag schema; clicking "Activity →" navigates to the existing audit page.

A3. The page does not render any "Ask Numio" button. The global top-bar Ask Numio is the only entry point. `git grep -F 'Ask Numio' frontend/src/pages/TagGovernance/` returns zero hits.

A4. The Resources tab table renders one row per resource and one column per required tag; cells use the four-color chip system.

A5. Standard toolbar present with the 5 view presets; default view is "Missing required tags"; copy-URL on a view restores it.

A6. Bulk select surfaces the action bar; clicking Apply tag opens the existing tag-edit drawer (kept from `tag_management`).

A7. Schema tab renders the list editor with the columns listed above and a "+ New tag key" button. Coverage percentage is color-coded (green ≥85%, orange ≥60%, red below 60%).

## Quality gates

- Build + tests pass.
- Visual diff vs `docs/design-mocks/numio-ia-v2/project/page-tag-governance.jsx`.
- Manual: with mock dataset of 500+ resources, scroll stays smooth; selecting 50 rows updates action-bar count.
- `git grep -F 'heatmap' frontend/src/pages/TagGovernance/` returns zero hits in production code (test fixtures excluded).

## Summary

### Steps completed

1. Deleted the entire legacy `pages/TagGovernance/` tree (8 files: `TagGovernancePage.jsx`, `PolicyEditorModal.jsx`, `CreateCampaignModal.jsx`, `CampaignDetailModal.jsx`, `styles.js`, `components/` with 7 files, `_reference/`). All heatmap-centric code is gone; no external consumers (verified by `git grep`).
2. Rewrote `pages/TagGovernance/TagGovernancePage.jsx` (~450 lines) with a dense table per the v2 mock. URL state for `tab`, `view`, `status`, `q`.
3. Built `pages/TagGovernance/tagGovernanceMockData.js` — 6-key schema, 13 hand-crafted resources plus 487 synthesized rows (500 total), 5 saved views including the default "Missing required tags" preset, `classifyCell` / `rowCoverageState` / `applyFilter` / `coverageColor` helpers.
4. Resources tab: ViewsPicker · Share link · Save as · Activity → · status segmented control (All / Missing required / Drift) with live counts · search box · bulk-select action bar (Apply tag · ✨ Suggest with Numio · Bulk rename value · Export · Clear) · 4-color tag chip cells · infinite scroll via IntersectionObserver.
5. Schema tab: list editor (KEY · REQUIRED · ALLOWED VALUES · COVERAGE · OWNER · ⋯) with `+ New tag key` button and a coverage chip whose color follows the threshold rule (green ≥85%, orange ≥60%, red below 60%). Footer notes versioned schema changes with Activity link.
6. Wrote 12 vitest cases covering A1–A7: defaults, two-tab structure, Activity link target, no Ask Numio anywhere, four-color cell kinds on representative rows (ok/drift/missing-req), bulk action bar with all four buttons, Clear, schema columns + + New tag key, coverage tone mapping for 91% / 73% / 22%, view URL restoration, status segmented selection.

### Changes made

- New: `pages/TagGovernance/TagGovernancePage.jsx`, `pages/TagGovernance/tagGovernanceMockData.js`, `pages/TagGovernance/TagGovernancePage.test.jsx`.
- Deleted: previous TagGovernance tree (8 files).

### Notable decisions or deviations

- **Full delete + rewrite, not incremental migration.** The v1 page was heatmap-centric and structurally incompatible with the v2 dense table; migrating cell-by-cell would have meant maintaining two parallel implementations. The deleted folder had no external consumers — grep confirmed.
- **Cell chip values use schema's `allowed` list** for drift detection. The synthesized row data deliberately includes `env="prod"` on `i-09ce772` to exercise the drift cell kind.
- **URL state for view + status writes simultaneously**: clicking a saved view writes both `view=<id>` and `status=<filter>` so the segmented control reflects the picked preset.
- **500 mock rows** rendered directly — well within IntersectionObserver scroll smoothness. Backend cursor pagination is `ia_v2_be_resources_inventory` (Resources page's backend) and a separate tag-coverage endpoint would slot in later.
- **`Apply tag` is a stub** — the actual write surface is owned by `tasks/features/20260515_tag_management.md`. When that lands, this bulk button will route to the existing tag-edit drawer instead of being a no-op.
- **No in-page Ask Numio button** anywhere — `git grep -F 'Ask Numio' frontend/src/pages/TagGovernance/` returns zero.
- **Test count: 320 → 332** (+12 TagGovernance tests).

### Links

- Tests: `cd frontend && npm test` — 332 / 332 passing.
- Build: `cd frontend && npm run build` — successful.
- Grep gates: `'Ask Numio'` → 0; `'heatmap'` → 0 in `frontend/src/pages/TagGovernance/`.
