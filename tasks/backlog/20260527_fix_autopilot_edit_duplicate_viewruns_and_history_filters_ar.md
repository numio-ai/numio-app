---
status: backlog
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
