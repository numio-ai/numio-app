---
status: done
phase: 5
task_id: P5.1
---

# Budget Management and Tracking

## Prerequisites

- **P3.3 — Cost attribution & cost views API:** Provides the spend-by-dimension data that budget tracking evaluates against.
- **P4.3 — Findings management:** Provides the findings system where budget alerts are created.
- **P2.2 — Background worker framework:** Provides the job scheduling infrastructure for budget evaluation.

## Problem Statement

Without budgets, cost governance is reactive — teams only learn about overruns after the fact. Numio needs to support budget definition, continuous spend tracking against budgets, burn rate projection, and early warning alerts when projected spend will exceed the budget before the period ends.

## Scope

**In scope:**
- **Budget creation:** Create budgets scoped to attribution dimensions (team, project, account, service). Each budget has: name, amount, currency, period (monthly or quarterly). Period boundaries use UTC by default. When workspace timezone is configured (P9.2), period boundaries shift to that timezone. Until P9.2 is built, UTC is used. Each budget also has alert thresholds (e.g., 50%, 80%, 100% of budget).
- **Budget tracking:** Evaluate current spend against each budget by querying the cost views API (P3.3). Budget evaluation runs as a scheduled background job (daily minimum, integrates with P2.2). More frequent evaluation is an implementation choice, not a requirement. Calculate: current spend, percentage of budget consumed, remaining budget.
- **Burn rate projection:** MVP uses simple linear extrapolation: `projected_spend = (current_spend / days_elapsed) × total_days_in_period`. Future iterations may incorporate trend weighting or historical patterns. Calculate the current burn rate and project end-of-period spend. Detect when projected spend will exceed the budget before the period ends. Identify the top cost drivers contributing to the overrun.
  - Top cost drivers: show the top 5 dimensions/services contributing most to the overrun (default 5, not configurable in MVP).
- **Budget alerts:** Generate findings/alerts when:
  - Spend crosses a configured threshold percentage (e.g., 80%)
  - Projected spend exceeds the budget (predictive alert)
  - Each alert includes: budget name, current spend, projected spend, affected dimension, and top cost drivers
- REST API endpoints for: create/update/delete budget, list budgets with current status, get budget detail with spend-vs-budget data, get budget alerts
- Alerts are created as findings (using findings management, P4.3)
- All data is workspace-scoped

**Out of scope:**
- Automated cost reduction actions when budgets are exceeded
- Multi-year budget planning
- Budget approval workflows
- Frontend budget pages (separate task P5.3)
- Non-cost budgets (e.g., resource count limits)

## Acceptance Criteria

1. Create a budget for a team dimension with monthly period and threshold alerts at 50%, 80%, 100%
2. Budget tracking correctly calculates current spend percentage against the budget amount
3. Burn rate projection (linear extrapolation) predicts budget overrun at least 5 days before period end in test scenario
4. Alert is generated as a finding when spend crosses the 80% threshold
5. Alert includes budget name, current spend, projected spend, and top 5 cost drivers
6. Budget evaluation runs as a scheduled job
7. Budget amount and thresholds can be updated via API; deleting a budget removes it from evaluation
8. List budgets API returns each budget with current status (on track / at risk / exceeded) based on spend and projection

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
