---
status: done
kind: task
feature: ia_v2_optimize
title: IA v2 Recommendations — evidence-backed cards, Rescan, Zombie Hunter saved view
---

# IA v2 Recommendations — evidence-backed cards, Rescan, Zombie Hunter saved view

# IA v2 Recommendations — evidence-backed cards, Rescan, Zombie Hunter saved view

## Problem statement

The existing Recommendations page (`pages/Optimize/Recommendations.jsx`) is a flat list with no evidence model — a user cannot inspect why a recommendation was made before acting. Zombie Hunter duplicates 90% of the same chrome at `/zombie-hunter`. "Generate new" and "Refresh" buttons overlap and confuse. The page has no saved-views model.

## Scope

In scope:
- New page at `/recommendations` matching `docs/design-mocks/numio-ia-v2/project/page-recommendations.jsx`.
- Card list (collapsed by default), click to expand inline; first card pre-expanded for first-time render.
- Each expanded card has five evidence sections in order: Signals detected (bullet list of trigger conditions), Affected resources (mini-table top 5 by spend + footer "… {N-5} more · ${combined}/mo combined" + "View all {N} in Resources →" deep link), What will happen (plain text + reversibility), Exclusions (plain text), Risk box (color-coded low/med/high with rationale).
- Manual remediation slot (terminal-style dark code block) rendered when the recommendation exposes a CLI alternative. Pattern shown in mock for the Hibernate recommendation.
- Single header button: `⟳ Rescan · last {N} ago`. No separate Refresh, no Generate new.
- Views picker with presets: All recommendations (default), Zombie Hunter (filters category in {Idle resource, Orphan reclaim}), …; standard Share link + Save as….
- Action row per card: Dismiss · Snooze 7 days · View full audit trail · Apply once · Send to Autopilot.

Out of scope:
- Send-to-Autopilot confirmation modal — task `ia_v2_send_to_autopilot`.
- Audit-trail destination surface — link out to existing audit page.
- Resources page banner state confirming "filtered to recommendation X" — follow-up if needed.
- Evidence backend — `ia_v2_be_recommendations_evidence`.

## Acceptance criteria

A1. `/recommendations` renders the card list with the first card expanded on initial load.

A2. Clicking a collapsed card expands it; clicking again collapses. Multiple cards may be expanded simultaneously.

A3. Expanded card shows all five evidence sections in order. "View all {N} in Resources →" navigates to `/resources?rec={id}` (the Resources page's handling of the query is out of scope for this task; only assert the link target).

A4. Header has exactly one rescan button labeled `⟳ Rescan · last {N} ago`; no Refresh, no Generate new.

A5. Selecting the "Zombie Hunter" view preset filters the list to category in {Idle resource, Orphan reclaim}.

A6. Apply once → toast "Applied · $X saved · reversible for 7 days" (mock handler).

A7. Send to Autopilot → opens the modal from `ia_v2_send_to_autopilot`.

A8. Manual remediation code block renders when the recommendation has a CLI snippet; absent otherwise.

## Quality gates

- Build + tests pass.
- Unit test covers Zombie Hunter saved-view filter.
- Visual diff vs `docs/design-mocks/numio-ia-v2/project/page-recommendations.jsx`.
- Manual: click every action; no console errors.

## Summary

### Steps completed

1. Built `pages/Recommendations/RecommendationsPage.jsx` (~430 lines) and `recommendationsMockData.js` — 7 recommendations including the fully-evidenced `r-201` Hibernate scenario, 6 saved views (with the `zombie` preset filtering Idle resource + Orphan reclaim).
2. Evidence sections render in order: Signals · Affected resources · What will happen · Exclusions · Risk. Manual remediation slot renders only when `r.manualRemediation` is present (`r-201` Hibernate + `r-192` EBS reclaim).
3. Affected-resources "View all N in Resources →" links to `/resources?rec={id}` (target only; Resources-side filter handling is out of scope).
4. Single `⟳ Rescan · last 2h ago` button in header — no Refresh, no Generate new.
5. Views picker mirrors Usage / Resources pattern, with `?view=` URL state. The `zombie` preset carries a "preset" pill annotation.
6. Apply once → ephemeral toast at the bottom of the viewport, auto-dismisses after 3s.
7. Send to Autopilot → opens a stub modal (replaced by task 2). Stub explicitly cites `ia_v2_send_to_autopilot` so a future reader doesn't think the modal is missing.
8. Category filter chips + Sort/Status selectors render but the latter two are decorative (open-state picker designs deferred).
9. Wrote 13 vitest cases: initial render with first card pre-expanded (A1), evidence sections present (A1), expand/collapse + multi-expand (A2), View all link href (A3), single Rescan button + no Refresh/Generate (A4), Zombie Hunter view filters correctly + URL restoration (A5), Apply-once toast (A6), Send-to-Autopilot stub modal opens (A7), manual remediation conditional render (A8).

### Changes made

- New: `pages/Recommendations/RecommendationsPage.jsx`, `pages/Recommendations/recommendationsMockData.js`, `pages/Recommendations/RecommendationsPage.test.jsx`.
- Modified: `App.jsx` — `/recommendations` lazy import + route.

### Notable decisions or deviations

- **Multi-expand allowed.** Each card has independent expansion state (Set of expanded ids). Matches A2 verbatim ("Multiple cards may be expanded simultaneously").
- **`Send to Autopilot` is a stub** — task 2 (`ia_v2_send_to_autopilot`) will replace `<SendToAutopilotStub>` with the real `<SendToAutopilotModal>`. Recommendations imports the stub locally; task 2 swaps the import.
- **`/zombie-hunter` is gone** (removed in task 3 of feature A). The Zombie Hunter saved view is the only way to reach the filtered list. `?view=zombie` URL works as a shareable link.
- **Apply-once toast** is hand-rolled — no toast library was already in the codebase. Auto-dismiss 3s. Could be promoted to a shared component if other pages need toasts.
- **Sort / Status selectors are decorative** matching the mock; full open-state pickers are out of scope per chat 2026-05-16.
- **`Dismiss` / `Snooze 7 days` / `Save as…` / `Share link` / `+ Save current` / `🔗 copy` / `⋯` row menu** all render but are no-ops. Backend tracking issue: `ia_v2_be_recommendations_evidence` for the data model.
- **Test count: 279 → 292** (+13 RecommendationsPage tests).

### Links

- Tests: `cd frontend && npm test` — 292 / 292 passing.
- Build: `cd frontend && npm run build` — successful.
