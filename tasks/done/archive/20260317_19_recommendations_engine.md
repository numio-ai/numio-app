---
status: done
phase: 6
task_id: P6.1
---

# Recommendations Engine and Savings Tracking

## Prerequisites

- **P4.1 — Anomaly detection:** Provides anomaly findings that may generate cost-optimization recommendations.
- **P4.2 — Zombie hunter & idle detection:** Provides zombie and idle findings that are converted into cleanup and shutdown recommendations.
- **P4.3 — Findings management:** Provides the findings data that recommendations are generated from. One recommendation per finding — if the underlying finding is updated (last_seen), the recommendation is not duplicated.

## Problem Statement

Detecting issues is only half the value. Customers need concrete, prioritized recommendations with estimated savings and actionable AWS CLI commands they can review and apply. After implementing recommendations, they need to track actual savings over time to measure ROI.

## Scope

**In scope:**
- **Recommendations generation:** Generate savings recommendations from findings, anomalies, and resource analysis. Recommendation types:
  - Right-sizing: suggest downsizing for consistently underutilized compute instances (based on CloudWatch metrics from idle detection, P4.2). Show projected savings per right-sizing action.
  - Zombie cleanup: convert zombie findings (P4.2) into actionable cleanup recommendations
  - Idle resource shutdown: suggest stopping or terminating idle resources

  Reserved instance opportunity analysis is deferred to post-MVP due to the complexity of stable-usage analysis and pricing comparison. MVP focuses on the three recommendation types above.

- **Prioritization:** Rank recommendations by estimated monthly savings. Group by category and affected dimension. Show confidence level (high/medium/low). Confidence levels are assigned based on data quality: high = clear signal with 30+ days of data (e.g., zombie with $0 utilization), medium = strong signal with some uncertainty (e.g., idle instance with low but non-zero usage), low = heuristic-based with limited data.
- **Remediation commands:** Each recommendation includes one or more AWS CLI commands that implement the fix. Commands are generated but never auto-executed in MVP.
- **Recommendation lifecycle:** States: open → accepted → implemented → dismissed. Track which recommendations are acted on.
- **Savings tracking:** When a recommendation is marked as implemented, track the date. Measure actual savings by comparing costs before and after implementation. Before = average daily cost of affected resource(s) over the 30 days prior to implementation date. After = average daily cost over the 30 days following implementation. Savings = (before − after) × 30. If less than 30 days have elapsed since implementation, savings are projected from available data and labeled as 'projected.' Track cumulative savings over time by category and dimension. Compare actual vs estimated savings.
- REST API endpoints for: list recommendations (sortable, filterable), get recommendation detail, accept/dismiss recommendation, mark as implemented, get savings summary, get savings timeline
- All data is workspace-scoped

**Out of scope:**
- Reserved instance opportunity recommendations (deferred to post-MVP)
- Automated execution of recommendations
- Terraform output format (MVP is AWS CLI only)
- Frontend pages (separate task P6.2)
- Recommendations for non-AWS resources

## Acceptance Criteria

1. At least 3 recommendation types are generated from test data (right-sizing, zombie cleanup, idle shutdown)
2. Each recommendation includes syntactically valid AWS CLI commands
3. Recommendations are ranked by estimated monthly savings
4. Recommendation lifecycle works: open → accepted → implemented → dismissed
5. Marking a recommendation as 'implemented' records the implementation date and begins savings measurement
6. Savings tracking shows cumulative savings after recommendations are marked as implemented
7. Actual vs estimated savings comparison is available for implemented recommendations (labeled 'projected' if < 30 days since implementation)
8. Recommendations API supports filtering by category and status, and sorting by estimated savings
9. One recommendation per finding — no duplicate recommendations for the same finding across runs

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- Generated CLI commands are validated for syntax in tests
- API endpoints documented in OpenAPI
