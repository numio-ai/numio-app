---
status: done
phase: 4
task_id: P4.3
---

# Findings Management

## Prerequisites

- **P1.2 — Database setup:** Provides the PostgreSQL database and Alembic migration framework for the findings table.
- **P1.3 — API foundation:** Provides the REST API scaffolding, error handling, and response format conventions.

## Problem Statement

Anomaly detection, zombie hunter, idle detection, and policy evaluation all produce findings — issues that need attention. These findings need a unified lifecycle, deduplication across detection runs, and an API that consumers (frontend, notifications, MCP) can use to list, filter, and manage them.

## Scope

**In scope:**
- **Findings data model:** Each finding has: type (anomaly, zombie, idle, policy_violation, tag_violation), severity (critical, high, medium, low, info), title, description, affected resource(s), estimated cost impact, suggested action, detection source, and timestamps (detected, last seen, acknowledged, resolved).
  - **Estimated cost impact:** Nullable field. Required for zombie and anomaly findings (dollar estimate of waste or spike magnitude). Optional for tag_violation and policy_violation findings where cost impact may not be directly calculable. When null, the UI should display "N/A" rather than $0.
- **Findings lifecycle:** open → acknowledged → resolved / suppressed. State transitions are recorded with who made the change and when.
- **Deduplication:** P4.3 owns deduplication internally. When a detection job (P4.1, P4.2, or any future detector) creates a finding, P4.3 deduplicates by a natural key (`type + resource_id + detection_source`). If an open or acknowledged finding with the same key exists, the existing finding's `last_seen` timestamp is updated rather than creating a duplicate. Callers (P4.1, P4.2, etc.) simply call the create-finding API — they do not need to check for existing findings.
  - **Suppression durability:** A suppressed finding remains suppressed across detection runs. Deduplication updates `last_seen` but does not change status from `suppressed`. If the underlying issue is no longer detected, the `last_seen` timestamp simply stops updating, but the suppressed finding is not automatically resolved — it remains suppressed until manually resolved or the suppression is removed.
- **Findings API:** REST API endpoints for:
  - List findings with filtering by: type, severity, status, dimension, account, date range
  - Get finding details
  - Acknowledge a finding
  - Resolve a finding
  - Suppress a finding (with reason)
  - Bulk operations: acknowledge or resolve multiple findings at once
- All findings are workspace-scoped

**Out of scope:**
- Detection logic (anomaly detection P4.1, zombie hunter P4.2 — they create findings via this system)
- Notification routing (Phase 8)
- Frontend findings pages (separate task P4.4)
- Suppression semantics beyond basic suppress-with-reason (advanced time-based/scope-based suppression deferred per open decisions)

## Acceptance Criteria

1. Findings lifecycle works end-to-end: open → acknowledged → resolved
2. Findings can be suppressed with a reason
3. A suppressed finding remains suppressed when the same detection job runs again — `last_seen` is updated but status stays `suppressed`
4. Deduplication by natural key (`type + resource_id + detection_source`) prevents duplicate findings across detection runs
5. Findings API supports filtering by type, severity, status, and account
6. Bulk acknowledge/resolve operations work correctly
7. Each state transition records who made the change and when
8. Findings from different sources (anomaly, zombie, policy) coexist in the same system with correct type attribution
9. Estimated cost impact is nullable — findings without cost impact (e.g., tag violations) can be created with `null` cost impact

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
