---
status: backlog
kind: bug
title: Overview tile - pending is misleading: surface usage and credits separately
---

# Overview tile - pending is misleading: surface usage and credits separately

# Overview tile -$2 pending is misleading: surface usage and credits separately

## Problem statement

The Overview "Total spend" tile sums `unblended_cost` from `cost_records`, which includes line items where `line_item_type = 'Credit'` with negative amounts. In low-usage accounts (e.g. development, the dev worktree as of 2026-05-04), AWS Free Tier credits exceed actual usage, so the headline number goes negative — for May 2026, the tile reads "-$2.96" against $0.02 of real usage and -$2.99 of credits.

This was the motivating example for the Data Explorer feature (`tasks/done/20260503_data_explorer_validate_motivating_bug.md`). The Data Explorer has now confirmed: the data is correct, the value is real, but the UI presentation is misleading. A non-engineer reader sees a negative dollar amount with the label "pending" and reasonably suspects a bug.

## Scope

**In**

- Decide on the right product behaviour for the Total Spend tile when credits exceed usage (e.g. show usage and credits as separate lines; clip the headline at $0; or add an explanatory tooltip).
- Implement the chosen behaviour and update related views (Spend Trend, MTD banner) for consistency.
- Write a regression test that covers a fixture where credits exceed usage.

**Out**

- Changing the underlying CUR ingestion or cost-record schema. The data is correct.
- Reworking the Cost Reporting section. This is scoped to Overview tiles.

## Acceptance criteria

1. With the fixture from the worked example (53 rows of Usage + 165 rows of Credit for May 2026), the Overview Total Spend tile no longer reads "-$2.96 pending" with no further context.
2. An admin can still discover the real net cost (including credits) without leaving the Overview page.
3. The chosen treatment is captured in `docs/data-explorer/data-explorer-spec.md` section 10 (Worked example) as the resolution of the motivating bug.

## Quality gates

- Unit / component test for the chosen presentation, using the same shape of fixture data.
- Manual check: open Overview with the dev worktree's existing data; the tile no longer presents a confusing negative.
- Spec section 10 references this task as the chosen resolution.
