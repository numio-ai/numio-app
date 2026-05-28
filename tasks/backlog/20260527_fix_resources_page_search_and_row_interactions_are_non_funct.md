---
status: backlog
kind: bug
title: fix: resources page search and row interactions are non-functional in mock mode
---

# fix: resources page search and row interactions are non-functional in mock mode

## Problem statement

`/resources` page renders 1,284 mock resources but several controls are non-functional:

1. **Search input** ("Search by ID, name, ARN, or tag value...") — typing does not filter results. Result count "Showing 1–50 of 1,284" remains constant regardless of query.
2. **Resource row click** does nothing — user would expect a detail view or panel to open. No `onClick` handler on row.
3. **Per-row ⋯ overflow menu** has no click handler — looks interactive but does nothing.
4. **Share link button** has no `onClick`.
5. **Save as… button** has no `onClick`.
6. **Export CSV button** has no `onClick`.

Working controls (verified): View dropdown opens, Columns dropdown opens, Compact/Comfortable toggles density.

## Scope

In scope:
- Wire search input to filter the table rows by name/id/ARN substring.
- Wire row click to navigate to a resource detail route or open a side panel with the row's data.
- Wire ⋯ menu to a small action menu (Inspect, Suppress, Copy ID — at minimum).
- Wire Export CSV to download current rows as CSV.
- Either wire Share link / Save as… or hide them; consistency with `/usage` is acceptable.

Out of scope:
- Real backend wire-up (mock mode QA).
- Bulk-action checkboxes — separate concern.

## Acceptance criteria

1. Typing "payments" in search input reduces the visible rows to only those containing "payments" in name/id; "Showing N of 1,284" updates to reflect filtered count.
2. Clicking a resource row navigates to a route like `/resources/<id>` or opens a side panel displaying that resource's metadata (name, id, type, region, account, tags).
3. Clicking the ⋯ menu opens a popover with at least one functional action (e.g., "Copy ID" puts the resource id on the clipboard).
4. Export CSV button downloads `resources-<view>.csv` containing the currently visible/filtered rows.

## Quality gates

- Unit test for the search-filter predicate (name/id/ARN match).
- Manual smoke in mock mode: search, row click, ⋯ click, export.
- Test suite (`npm test`) passes.
