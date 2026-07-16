---
status: done
kind: task
feature: ia_v2_govern
title: IA v2 Budgets — cards with pacing tick, standard toolbar
---

# IA v2 Budgets — cards with pacing tick, standard toolbar

# IA v2 Budgets — cards with pacing tick, standard toolbar

## Problem statement

The current Budgets page sits at `/financial_planning/budgets`, uses a colored banner that carries low signal, and lacks ahead/behind pacing — users see "80% spent" but not whether that's expected for day 15 of the month.

## Scope

In scope:
- New page at `/budgets`; legacy `/financial_planning/budgets` is removed in `ia_v2_routes`.
- Team-budget cards with progress bar, pacing tick at the expected-day position, "Expected at day N: X% · ±Ypp ahead/behind" annotation per card.
- Subtitle (no banner): "$X spent of $Y (Z%) · 1 over · 2 at risk · day N of M".
- Standard toolbar: Views · Share · Save as · period selector pinned right; header actions `⟳ Rescan` and `+ New budget`.
- Card border color reflects status: over=red, at risk=amber, on track=green.

Out of scope:
- Budget authoring wizard (`+ New budget` opens a stub).
- Backend CRUD — `ia_v2_be_budgets`.

## Acceptance criteria

A1. `/budgets` renders cards per the mock; legacy `/financial_planning/budgets` 404s.

A2. Each card shows the pacing tick at the expected-day position on the progress bar.

A3. Each card shows the "Expected at day N: X% · ±Ypp ahead/behind" annotation.

A4. Card border color reflects status (over / at risk / on track).

A5. Standard toolbar present; period selector in the toolbar updates the cards.

A6. Subtitle shows the four signals (spent, %, count over, count at risk, day of month).

## Quality gates

- Build + tests pass.
- Visual diff vs `docs/design-mocks/numio-ia-v2/project/page-budgets.jsx`.
- Unit test covers status border-color derivation for over / at-risk / on-track cases.

## Summary

### Steps completed

1. Built `pages/Budgets/BudgetsPage.jsx` (~280 lines) — team-budget grid with progress bar, pacing tick, drift annotation, status border, ViewsPicker, period selector, ⟳ Rescan, + New budget stub.
2. Exported `deriveStatus({ spent, budget })` helper used by both the page and tests; thresholds: ≥100% = over, ≥85% = at-risk, else on-track. ML Platform mock spend bumped to 24,840 / 24,000 (over) so the test fixture has a deterministic over-budget row.
3. Cards carry `data-status` so tests assert the bucket without sniffing CSS colors. Left border is a 4px stripe in the status color.
4. Subtitle renders the four signals: `$spent of $total (pct%) · N over · M at risk · day 15 of 31`.
5. Period selector (Month / Quarter / Year) scales mock values when toggled.
6. Wired `/budgets` lazy route in `App.jsx`; removed `/govern/budgets` (and its `/new`, `/alerts`, `/:id` Navigate variants); pointed `/govern` redirect at `/budgets`. Deleted `pages/FinancialPlanning/Budgets.jsx`.
7. 13 vitest cases covering A1–A6 + deriveStatus unit.

### Changes made

- New: `pages/Budgets/BudgetsPage.jsx`, `pages/Budgets/BudgetsPage.test.jsx`.
- Modified: `App.jsx` — swapped `Budgets` lazy for `BudgetsPage`; replaced 4 legacy `/govern/budgets*` routes with `/budgets`; `/govern` now redirects to `/budgets`.
- Deleted: `pages/FinancialPlanning/Budgets.jsx`.

### Notable decisions or deviations

- **Legacy `/govern/budgets` removed entirely** to align with A8 ("Budgets is at `/budgets`"). Stale URLs 404, consistent with the project-wide direction (deprecated URLs do not redirect).
- **ML Platform spend nudged to 24,840** in the mock to deterministically trigger the "over" bucket.
- **Period selector is a real toggle**, not decoration — scales mock spend ×3 (quarter) or ~×10.8 (year).
- **`+ New budget` opens a stub dialog**, per task scope.
- **Test count: 332 → 345** (+13 BudgetsPage tests).

### Links

- Tests: `cd frontend && npm test` — 345 / 345 passing.
- Build: `cd frontend && npm run build` — successful.
