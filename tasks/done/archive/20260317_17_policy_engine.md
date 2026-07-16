---
status: done
phase: 5
task_id: P5.2
---

# Infrastructure Policy Engine

## Prerequisites

- **P2.5 — Resource inventory sync:** Provides resource metadata for instance type and environment constraint evaluation.
- **P4.3 — Findings management:** Provides the findings system where policy violations are created as findings. P4.3 owns deduplication.
- **P3.3 — Cost attribution & cost views API:** Provides the cost-by-dimension data required for spending limit policy evaluation.
- **P2.2 — Background worker framework:** Provides the job scheduling infrastructure for policy evaluation.

## Problem Statement

Beyond tag governance (Phase 3), customers need to enforce infrastructure policies that prevent cost and compliance issues: restricting instance types, enforcing environment constraints, and limiting resource counts. Policy violations need to be detected automatically and surfaced as findings.

Note: Tag-related policies are handled by the tag governance engine (P3.1). This task covers non-tag infrastructure policies only.

## Scope

**In scope:**
- **Policy definition:** Define policies as rules evaluated against resources and costs. Policy types:
  - Instance type restrictions (e.g., "no GPU instances in staging environment")
  - Spending limits per dimension (e.g., "team X cannot exceed $10,000/month on compute")
  - Resource count limits (e.g., "no more than 5 RDS instances per environment")
  - Environment constraints (e.g., "production resources must be in us-east-1 or us-west-2")
- **Policy rule structure:** Each policy has a `type` (instance_restriction, spending_limit, resource_count_limit, environment_constraint), a `rule` object whose schema depends on the type, an `applicability` filter (which accounts, environments, or resource types the policy applies to), and an `is_guardrail` boolean flag. When `is_guardrail` is true, the policy is evaluated immediately on every resource inventory sync in addition to the regular schedule. The developer designs the specific rule schemas per type.
- **Policy evaluation:** Scheduled evaluation of all resources against active policies (integrates with worker framework, P2.2). Generate violations as findings (using findings management, P4.3). This task calls P4.3's create-finding API; P4.3 handles deduplication internally. Track compliance percentage per policy.
- **Guardrail policies:** Guardrail-designated policies are evaluated on every resource inventory sync (not just on schedule). Immediate violation detection for critical policies.
- REST API endpoints for: create/update/delete policy, list policies with compliance status, get policy detail with current violations, get compliance percentage per policy
- All data is workspace-scoped

**Out of scope:**
- Tag policies (handled by P3.1)
- Automated remediation of policy violations
- Policy-as-code via Git (future scope per core spec)
- Frontend policy pages (separate task P5.3)

## Acceptance Criteria

1. Define an instance type restriction policy and detect a violation when a resource uses an unapproved type
2. Define a spending limit policy and detect a violation when spend exceeds the threshold
3. Define a resource count limit policy and detect a violation when the count exceeds the limit
4. Define an environment constraint policy and detect a violation when a resource is in a disallowed region
5. Policy evaluation runs as a scheduled job and creates violation findings via P4.3
6. Guardrail policies (is_guardrail=true) are evaluated immediately on resource inventory sync
7. Compliance percentage per policy is calculated and updated after each evaluation run
8. Policy violations appear in the findings system with type=policy_violation and correct severity
9. Policies can be updated and deleted via API; deleting a policy removes its violations from active findings

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
