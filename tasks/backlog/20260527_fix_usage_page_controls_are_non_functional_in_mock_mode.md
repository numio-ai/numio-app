---
status: backlog
kind: bug
title: fix: usage page controls are non-functional in mock mode
---

# fix: usage page controls are non-functional in mock mode

## Problem statement

`/usage` page has multiple controls that are visible to the user but produce no functional change. Per QA standard for mock mode, every visible control must affect what the user sees. Findings:

1. **Time range selector (7D/30D/MTD/QTD/YTD)** only updates the period label ("LAST 7 DAYS", "vs previous 7 days"). Total ($274,229), chart shape, and breakdown rows do not change. Selecting 7D shows 30 days of data with a "LAST 7 DAYS" caption — misleading.
2. **Group by selector** only updates the chart title and breakdown header column name. Chart legend, breakdown row names (e.g. CC-PAY/CC-ML), and shares stay tied to the original scenario. Selecting "Service" shows cost-center values in breakdown.
3. **Y-axis labels show "$0k"** on every gridline when AI scope is selected. Daily values are under $1000 so `Math.round(max/1000)` rounds to 0. `UsagePage.jsx:62` — y-axis ticks formula doesn't handle sub-$1k values.
4. **Inspect → button** in each breakdown row does nothing (no onClick).
5. **+ Filter button** does nothing (no onClick).
6. **Save as… button** does nothing (no onClick).
7. **Export CSV button** does nothing (no onClick).
8. **Granularity control** rendered as a `<span>` not a button, has no click handler — user can't change granularity though dropdown chevron suggests they can.
9. **Untagged callout** is rendered for platform dimensions and says "$X has no service tag" even when grouping by `service` (a platform dimension, not a tag). Callout should only render for tag dimensions.

## Scope

In scope:
- Make controls either functional (preferred for the mock demo) or remove them.
- Fix Y-axis tick formula to handle sub-$1k values.
- Suppress untagged callout when groupBy.kind === "platform".

Minimum viable fix: make controls produce visible, plausible change in mock — they need not affect every datum, but selecting a different time range or group by must visibly change something more than a label.

Out of scope:
- Real backend wire-up (this is mock-mode QA).
- Designing CSV export schema; a click-to-download stub of the current breakdown is acceptable.

## Acceptance criteria

1. Clicking 7D/MTD/QTD/YTD changes the chart's X-axis density and total spend visibly versus 30D. (Different scenario data set per range, or scaling existing series, both acceptable.)
2. Selecting different "Group by" option produces a different legend AND different breakdown rows (names, shares, totals).
3. Y-axis labels in AI scope show non-$0 values across the chart. Sub-$1k daily maxes should show in dollars (e.g. "$800"), not "$0k".
4. Inspect → button navigates to a drill-down screen or opens a panel with the row's details — at minimum, route changes.
5. + Filter button opens a filter picker (single dimension select is sufficient for mock).
6. Save as… opens a name prompt and adds a new entry to the views list.
7. Export CSV downloads a CSV with the current breakdown rows (filename: `usage-<range>-<groupby>.csv`).
8. Granularity control becomes a real button/select. Two options minimum (Daily, Weekly), and changing it produces a visible chart change.
9. Untagged callout does not render when `groupBy.kind === "platform"`.

## Quality gates

- Vitest unit test for the Y-axis formula edge case (max < 1000).
- Puppeteer/integration test asserts: clicking 7D changes the total `data-testid="usage-delta-caption"` text differently than 30D would.
- Manual smoke: load `/usage`, click each control, verify visible change.
