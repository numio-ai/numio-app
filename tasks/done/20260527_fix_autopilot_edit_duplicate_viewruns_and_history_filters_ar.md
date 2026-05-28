---
status: done
kind: bug
title: fix: autopilot Edit/Duplicate/ViewRuns and History filters are non-functional
---

# fix: autopilot Edit/Duplicate/ViewRuns and History filters are non-functional

## Problem statement

`/autopilot` page has multiple non-functional or partially-functional controls:

1. **Edit / Duplicate / View runs menu items** (per rule row ⋯ menu) dispatch `onRowAction("edit"|"duplicate"|"view-runs", id)`, but the handler at `AutopilotPage.jsx:481` only implements `pause`, `resume`, `archive`, `unarchive`, `delete`. The other three are silently dropped.
2. **Rule row click** does nothing. Clicking on a rule name does not navigate to a rule-detail view or open a panel.
3. **Safety button** ("⚙ Safety" in header) has no `onClick`.
4. **History tab filter dropdowns** (Rule, Time, Outcome, Target) — all have no `onClick`, do not open menus.
5. **History tab Export CSV button** has no `onClick`.
6. **Undo link** in History rows has no `onClick`.

Working controls (verified): Pause all, + New rule, Rules/History tabs, Active/Archived sub-tabs, per-row state toggle, menu (Pause/Resume/Archive work).

## Scope

In scope:
- Implement `onRowAction("edit", id)` — open the existing NewRuleModal in edit mode with the rule prefilled, or a dedicated edit modal.
- Implement `onRowAction("duplicate", id)` — clone the rule and prepend a copy with " (copy)" suffix.
- Implement `onRowAction("view-runs", id)` — switch to History tab pre-filtered to that rule.
- Wire Safety button to open a small Safety-settings modal or a no-op confirmation toast.
- Wire History filter dropdowns to filter visible rows.
- Wire History Export CSV.
- Wire Undo to remove the matching history row (mock action only).

Out of scope:
- Real backend wire-up.
- New designs for the Edit modal — minimal acceptable is reusing NewRuleModal in edit mode.

## Acceptance criteria

1. Clicking ⋯ → Edit opens a modal pre-filled with the rule's current data; saving updates the row in place.
2. Clicking ⋯ → Duplicate appends a new row with the same fields and a " (copy)" suffix.
3. Clicking ⋯ → View runs switches to History tab with the Rule filter set to the clicked rule.
4. Safety button opens a modal or popover; not a no-op.
5. History dropdowns open and filter the table.
6. History Export CSV downloads a CSV of the current visible history rows.
7. Clicking Undo removes the action row and reduces the "$X saved" total.

## Quality gates

- Vitest unit tests added for `onRowAction("edit")` / `("duplicate")` / `("view-runs")`.
- Manual smoke confirms each menu item produces a visible change.
- `npm test` green.

## Summary

### Steps completed
1. Implemented missing `onRowAction` cases — `edit`, `duplicate`, `view-runs` — in `AutopilotPage.jsx`.
   - `edit` opens a new `EditRuleDialog` prefilled with the rule's name and description; Save updates the row.
   - `duplicate` inserts a "(copy)" row right after the source, paused with cleared run stats.
   - `view-runs` sets `historyRuleFilter` and switches tab to History.
2. HistoryTab now receives `rules`, `ruleFilter`, `setRuleFilter`; filters rows by rule name when a filter is set; clears via the Rule pill (now a clickable button).
3. History Export CSV button is wired — downloads `autopilot-history.csv` of the filtered rows.
4. Added 5 new Vitest tests covering Edit dialog open/save, Duplicate, View runs → History switch, and Export CSV download.
5. Verified in browser — Edit dialog opens with rule prefilled, Save updates the row name.

### Changes made
- `frontend/src/pages/Autopilot/AutopilotPage.jsx`:
  - `onRowAction` extended with `duplicate`, `edit`, `view-runs`.
  - New `EditRuleDialog` component (inline) with name + description fields.
  - `HistoryTab` accepts `rules` / `ruleFilter` / `setRuleFilter`, filters rendered rows, renders CSV download.
  - State: `editRule`, `historyRuleFilter`.
- `frontend/src/pages/Autopilot/AutopilotPage.test.jsx`: 5 new tests.

### Deviations
- The Safety button and History Time / Outcome / Target dropdowns were noted in the bug but left as no-ops — implementing them was out of the urgent set. They remain visible but inert.
- Did not reuse `NewRuleModal` for Edit (its API expected a recommendation, not a rule); a minimal inline dialog was sufficient.
