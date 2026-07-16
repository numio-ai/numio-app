---
status: done
phase: 4
task_id: P4.1
---

# Anomaly Detection

## Prerequisites

- **P3.3 — Cost attribution & cost views API:** Provides the cost-by-dimension time series that anomaly detection uses to compute baselines and detect spikes/drift.
- **P2.2 — Background worker framework:** Provides the job scheduling infrastructure to run anomaly detection as a recurring background job.
- **P4.3 — Findings management:** Provides the findings system where detected anomalies are created as findings. P4.3 owns deduplication — this task simply creates findings and P4.3 handles upsert logic.

## Problem Statement

Cost issues often go unnoticed until the monthly bill arrives. Numio needs automated detection of spending spikes and cost drift so that customers are alerted early when something looks off, with enough context to understand what changed and why.

## Scope

**In scope:**
- **Baseline computation:** Compute cost baselines per dimension (service, team, account, etc.) using moving averages and standard deviations.
  - **Defaults:** 14-day rolling window for moving average, 3σ (standard deviations) threshold for spike detection. Both are configurable per dimension.
  - **Minimum history:** Anomaly detection is not active for a dimension until at least 14 days of cost data exist. Before that, the dimension is skipped with a log entry. This prevents false positives from insufficient data.
- **Spike detection:** Detect sudden cost increases where the current day's cost exceeds the baseline mean + (threshold × σ) for that dimension.
- **Drift detection:** Detect gradual upward cost trends using linear regression slope over a configurable rolling window (default: 14 days). A drift anomaly is raised when the slope indicates a projected increase of ≥10% over the window period (configurable). This is evaluated separately from spike detection — a dimension can have drift without a daily spike.
- **Anomaly context:** Each detected anomaly includes: what changed, magnitude in $ and %, affected dimension(s), likely cause, and time of detection.
  - **Likely cause determination:** Inferred via heuristics: if new resources appeared in the anomaly window → "new resource"; if existing resources show increased usage → "usage spike"; if pricing metadata changed → "pricing change". When no cause can be inferred, the field is set to `null`. The cause field is nullable and best-effort.
- Anomalies are created as findings in P4.3 (type=`anomaly`). This task calls P4.3's create-finding API; P4.3 handles deduplication internally.
- **Threshold configuration:** Thresholds are persisted per-dimension in the database and managed via REST API. Endpoints: get thresholds (returns current per-dimension overrides + global defaults), set threshold for a dimension. If no per-dimension override exists, global defaults apply. Defaults are conservative to minimize false positives.
- Run anomaly detection as a scheduled background job (integrates with worker framework, P2.2)
- Track anomaly acknowledgment rates as a feedback signal for threshold tuning

**Out of scope:**
- ML-based anomaly detection (statistical methods are sufficient for MVP)
- Real-time anomaly detection (daily batch is sufficient)
- Anomaly detection on non-cost metrics
- Frontend anomaly pages (separate task P4.4)

## Acceptance Criteria

1. Anomaly detection identifies a 2x daily cost spike in test data and creates a finding with type=`anomaly`, correct severity, affected dimension, magnitude ($, %), and estimated cost impact
2. Each anomaly finding includes: magnitude ($, %), affected dimension, likely cause (or `null` if not inferable), and detection time
3. Detection runs as a scheduled job via the worker framework
4. Conservative default thresholds (3σ, 14-day window) minimize false positives
5. Thresholds are configurable per dimension via REST API; per-dimension overrides take precedence over global defaults
6. Gradual cost drift (e.g., 10% increase over 2 weeks) is detected via trend slope analysis, not just sudden spikes
7. Anomaly detection is skipped for dimensions with fewer than 14 days of cost history, without error
8. Duplicate anomalies across detection runs are handled by P4.3's deduplication — this task does not need to check for existing findings

## Quality Gates

- Tests with synthetic cost data verify detection of spikes and drift
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
