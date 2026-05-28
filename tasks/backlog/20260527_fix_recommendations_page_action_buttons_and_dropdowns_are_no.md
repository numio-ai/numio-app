---
status: backlog
kind: bug
title: fix: recommendations page action buttons and dropdowns are non-functional
---

# fix: recommendations page action buttons and dropdowns are non-functional

## Problem statement

`/recommendations` page has several visible controls that do nothing in mock mode:

1. **Dismiss button** (per recommendation) — no `onClick` handler. Verified at `RecommendationsPage.jsx:197`.
2. **Snooze 7 days button** — no `onClick`. `RecommendationsPage.jsx:198`.
3. **Sort dropdown** ("Sort: Highest savings ▾") — no `onClick`, doesn't open a menu.
4. **Status dropdown** ("Status: Open ▾") — no `onClick`, doesn't open a menu.
5. **Rescan button** ("⟳ Rescan · last 2h ago") — no `onClick`. Should at minimum show a brief loading state or update the "last Xh ago" caption.
6. **Share link button** — no `onClick`.
7. **Save as… button** — no `onClick`.

Working controls (verified): Category filter chips (All, Idle resource, Rightsizing, ...), View dropdown, Apply once button, Send to Autopilot → button (opens modal).

## Scope

In scope:
- Wire Dismiss to remove the recommendation from view (mock mutation via store.transitionRecommendation already exists for backend; for mock the UI should hide/strike-through).
- Wire Snooze 7 days similarly — at minimum visually hide the row with a tooltip.
- Make Sort and Status dropdowns open a menu and re-order/filter visible list.
- Rescan: show "Rescanning…" for ~800ms then refresh.

Out of scope:
- Real backend wire-up.

## Acceptance criteria

1. Clicking Dismiss on a recommendation hides it from the list and decrements the "N open" count.
2. Clicking Snooze 7 days hides the recommendation and (optionally) tags it as snoozed in mock store.
3. Sort dropdown opens with at least 2 options (Highest savings, Newest); selecting changes the list order.
4. Status dropdown opens with at least 2 options (Open, All); changes filter.
5. Rescan shows a brief loading state, then updates "last Xh ago" to "just now".

## Quality gates

- Unit test for Dismiss/Snooze handlers updating recommendation list state.
- Manual smoke: click each previously non-functional control and confirm visible change.
- `npm test` green.
