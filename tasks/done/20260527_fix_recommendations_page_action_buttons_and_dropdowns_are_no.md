---
status: done
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

## Summary

### Steps completed
1. Wired Dismiss → adds rec id to a `hiddenIds` set, hides the row, shows confirmation toast.
2. Wired Snooze 7 days → same hide behavior with a different toast message.
3. Replaced the inert `<span>` placeholders for Sort and Status with a reusable `MenuButton` component that opens a listbox-style popover.
   - Sort options: Highest savings (default), Newest.
   - Status options: Open (default), All — Status=All re-reveals dismissed/snoozed recs.
4. Wired Rescan → switches caption to "· scanning…", flips to "· just now" after 800ms.
5. Added 6 new Vitest tests covering each new behavior.
6. Verified in live browser: Dismiss on the first card drops open count from 7 to 6 and reorders the list.

### Changes made
- `frontend/src/pages/Recommendations/RecommendationsPage.jsx`: new MenuButton, state, handlers; RecCard accepts onDismiss/onSnooze.
- `frontend/src/pages/Recommendations/RecommendationsPage.test.jsx`: 6 new tests.

### Deviations
- Share link / Save as left untouched (cosmetic, out of urgent set).
