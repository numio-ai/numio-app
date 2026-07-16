---
status: backlog
kind: task
feature: ia_v2_persistence
title: Persist Budgets with pacing derivation from real cost data
---

# Persist Budgets with pacing derivation from real cost data

## Problem statement

`api/ia_v2_budgets.py` returns 6 hardcoded team budgets with status derived against a fixed `day 15 of 31`. Real implementation needs (a) a `budgets` table per workspace, (b) spend pulled from `cost_records` aggregated by team (via tag projection), and (c) pacing computed from `date.today()`.

## Scope

In scope:
- Alembic migration: `budgets_v2(id, workspace_id, team, budget_amount NUMERIC, alert_pct, period ENUM, created_at, updated_at)`. Distinct from any legacy v1 `budgets` table to avoid migration risk.
- SQLAlchemy model + `BudgetV2Repository`.
- Implement endpoints: `GET /budgets-v2`, `POST /budgets-v2`, `GET /budgets-v2/{id}/pacing` against real data.
- Spend per budget: query `cost_records` filtered by `tags->>'team' = budget.team` and the active period; sum `unblended_cost`.
- Pacing: compute `expected_pct_at_today` from real `date.today()` and the period length.
- AuthZ: workspace-scoped; admins create budgets.
- Frontend: `BudgetsPage` calls the real `/api/v1/budgets-v2`; the `BUDGETS` array in `BudgetsPage.jsx` is deleted.

Out of scope:
- Budget alerts / notification routing.
- Multi-cost-center per budget.
- Historical pacing series — per-budget pacing endpoint returns the by-day curve as today; no historical actuals yet.

## Acceptance criteria

A1. Migration applies; existing `cost_records` are queryable for spend; no v1 `/budgets` regressions (v1 routes already untouched).

A2. `GET /budgets-v2` returns rows whose `spent` matches `SUM(cost_records.unblended_cost) WHERE tags->>'team' = team AND billing_period in (current month)`.

A3. Pacing computed against the real current date (not 15/31 hardcoded). `expected_pct_at_today = round(current_day / total_days * 100)`.

A4. Pytest: status derivation edge cases (exactly 100%, exactly 85%); spend aggregation; create-and-list round-trip.

A5. Frontend BudgetsPage renders real budgets when the dev stack has cost_records; the local `BUDGETS` array is removed.

## Quality gates

- Backend pytest covers the spend aggregation against seeded cost_records.
- Frontend `npm test` + `npm run build` pass.
- `git grep -F 'const BUDGETS' frontend/src/pages/Budgets/` returns zero hits.
