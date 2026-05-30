---
status: done
kind: task
feature: mock_backend_switch
title: Synthetic cost and budget data for mock mode
---

# Synthetic cost and budget data for mock mode

# Synthetic cost and budget data for mock mode

## Problem statement

The `mock_backend_switch` feature runs the full Numio UI from synthetic data with no backend, for customer demos. Cost and budget screens are the demo centerpiece: cost totals, time-series, breakdowns by dimension, trends, forecast, and budgets with alerts. These screens have no demo-ready synthetic dataset that matches the live frontend response shapes and reconciles across views. Without one, demo numbers contradict each other — a period total that does not equal the sum of its by-service breakdown destroys credibility in front of a customer.

## Scope

In scope — produce a synthetic cost, usage, and budget dataset under `frontend/src/mocks/` that:

- Covers every cost and budget response shape consumed by the frontend (enumerated in Acceptance criteria).
- Is built on the canonical AWS accounts, services, regions, and demo time window defined by the `synthetic_data_core` task. No parallel entity set.
- Reconciles across views: period totals equal the sum of their breakdowns, and time-series buckets sum to reported totals.
- Is deterministic, inheriting the core's seeded generator.

Out of scope:

- The mock/live switch and request seam — sibling task `switch_dispatch_seam`.
- The shared canonical entities, seeded generator, and consistency harness — the `synthetic_data_core` task. This task depends on it; it does not rebuild it.
- The governance and platform domain datasets — sibling domain tasks.
- Wiring this dataset into API modules under `frontend/src/api/`. This task does not edit `frontend/src/api/` — that is the `endpoint_coverage` task.
- Tests and documentation — separate tasks.

## Acceptance criteria

Data shape authority is the current response shapes in `frontend/src/api/dashboard.js`. Each criterion is verifiable against those shapes or via the core's consistency harness.

1. The dataset supports the cost-views surface: total, time-series, by-dimension, and trends. Each returns data in the shape the corresponding `dashboard.js` function expects.
2. The dataset supports the service-level cost breakdown (cost-by-service).
3. The dataset supports the budgets surface: budget list, budget detail, and budget alerts. Forecast fields render on the budget screens.
4. Reconciliation invariants hold, checked by the core's harness:
   - Sum of time-series buckets over a period equals the total for that period.
   - Sum of the by-service breakdown for a period equals the period total.
   - Sum of the by-account breakdown for a period equals the period total.
   - Sum of by-region and by-tag breakdowns for a period each equals the period total.
   - Month-over-month figures used by trends are internally consistent with the per-period totals.
5. Plausibility conditions hold:
   - Service names are drawn from the core's canonical AWS service set; no hardcoded service strings local to this dataset.
   - Region codes are drawn from the core's canonical region set; no hardcoded region strings local to this dataset.
   - Usage line items carry positive costs; at least one credit line item carries a negative cost.
   - The covered date window matches the core's demo time window.
6. Core dependency: every account, service, region, and date in this dataset is sourced from `synthetic_data_core`. A grep of the cost dataset finds no parallel definitions of accounts, services, regions, or the demo window.
7. Determinism: two consecutive generator runs produce byte-identical cost and budget output.

## Quality gates

- `cd frontend && npm test` passes.
- `cd frontend && npm run build` succeeds.
- Reconciliation check: the core's consistency harness confirms all invariants in Acceptance criterion 4 (period total equals sum of every breakdown; time-series buckets sum to totals).
- Determinism check: two generator runs produce identical output (Acceptance criterion 7).
- No lint gate — the frontend has no lint script.

## Constraints and assumptions

- Depends on the `synthetic_data_core` task. That task must define the canonical accounts, services, regions, demo time window, seeded generator, and consistency harness before this task can complete. This task consumes those entities and does not redefine them.
- Data shape authority is the current response shapes in `frontend/src/api/dashboard.js`. Where an existing mock file under `frontend/src/mocks/` (for example `mockBudgets.js`) uses a different ad-hoc shape, the live `dashboard.js` shape wins. The implementer decides per file whether to reuse, extend, or replace; this plan does not prescribe which.
- The `numio-demo` repository and its data files are reference-only. No runtime dependency on `numio-demo` is introduced.
- Output lives under `frontend/src/mocks/`, reusing the existing mock infrastructure.

## Summary

### Steps completed
1. Cataloged the exact backend response shapes for all 8 cost/budget endpoints via a read-only sub-agent — confirming Decimal-as-string fields, the `metadata` envelope for cost-views vs the flat envelope for cost-explorer/budgets, and the `{budgets,count}`/`{findings,count}` wrappers.
2. Built `frontend/src/mocks/synthetic/cost.js` on the canonical entities + seeded generator: a single fact table (amount per account × service × month, rounded to cents once, with one negative Savings-Plan credit on a canonical service), then every view derived as an aggregation of that one table.
3. Exported view builders matching each real shape: `costTotal`, `costTimeSeries` (monthly + daily buckets, optional nested `by_dimension`), `costByDimension` (service/account/region/environment), `costTrends`, `costByService` (flat envelope, uppercase granularity), `budgetsList`/`budgetById`/`budgetAlerts`.

### Changes made
- New: `frontend/src/mocks/synthetic/cost.js` + `cost.test.js` (14 tests). Imports only from `synthetic/entities` + `synthetic/seed`. No `frontend/src/api/` edits (wiring is `endpoint_coverage`). Legacy `mockBudgets.js` left untouched.

### Verification (all quality gates pass)
- `npm test`: 418 passed / 42 files (+14 cost tests; no regressions).
- `npm run build`: succeeds.
- Reconciliation (AC4): monthly + daily time-series, by-service, by-account, by-region, by-environment, and nested `by_dimension` time-series each sum to the period total (exact via `allocate`); trends current-period total matches the fact-table current month.
- Determinism (AC7): combined cost output byte-identical across two runs.
- Plausibility (AC5): service names + region codes from the canonical set only; positive usage + ≥1 negative credit; window = demo window.

### Notable decisions / deviations
- Single-fact-table design makes reconciliation exact (epsilon 0) and trivially deterministic.
- Budgets defined against canonical dimension values so budget spend matches the cost charts for the same dimension.
- The credit line uses a canonical service name (EC2) to satisfy "no service strings invented locally" while carrying a negative amount.

### Links
- Spec: `docs/frontend/mock-backend-spec.md` §5.2. Branch: `feature/mock_backend_switch`. Depends on: `synthetic_data_core` (done).
