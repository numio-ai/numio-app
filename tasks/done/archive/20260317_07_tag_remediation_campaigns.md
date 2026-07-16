---
status: done
phase: 3
task_id: P3.2
---

# Tag Remediation Campaigns

## Prerequisites

- **P3.1 — Tag policy engine & compliance audit:** Provides the compliance audit results (per-resource compliance status, violated policy rules) that campaigns target for remediation.

## Problem Statement

Identifying non-compliant resources is only half the problem. Customers need a structured workflow to drive tag compliance from identification through resolution. Remediation campaigns organize non-compliant resources, infer likely owners, track per-resource remediation progress, and provide the AWS CLI commands operators need to fix tagging issues.

## Scope

**In scope:**
- **Campaign creation:** Create remediation campaigns targeting a set of non-compliant resources from compliance audit results (P3.1). Resources can be selected by passing an explicit list of resource IDs, by passing filter criteria (e.g., "all resources missing the 'team' tag in account X"), or both — filters resolve to a concrete resource set at campaign creation time. A campaign has a name, a deadline (optional), a target compliance goal, and the resolved set of target resources.
  - **Target compliance goal:** Expressed as a percentage of campaign resources in "fixed" status (e.g., "80% of campaign resources fixed within 30 days"). This is a resource-count metric, not a cost-weighted score — it measures remediation progress, not financial compliance. The cost-weighted compliance impact is visible via P3.1's trend snapshots.
- **Owner inference:** Infer likely resource owners from available metadata: account ownership, creator tags (`aws:createdBy`), related resource tags, naming conventions. Surface inferred owner to help route remediation to the right person. When no metadata is available to infer an owner, the field is set to `null` (not "unknown") — the API must distinguish "no owner inferred" from an explicit owner value. Owner inference is best-effort; not all resources will have inferable owners.
- **Per-resource remediation status:** Each resource in a campaign tracks its own status. Valid states and transitions:
  - **pending** — initial state when a resource is added to a campaign.
  - **notified** — operator has manually marked the resource as "owner notified." In MVP, this is a manual status toggle via API (no automated notification delivery). Automated email/Slack notification is Phase 8 scope.
  - **fixed** — resource passes compliance re-check (verified by the next audit run from P3.1) or is manually marked as fixed by the operator.
  - **escalated** — operator marks the resource as requiring management attention.
  - **excluded** — resource was terminated/deleted after campaign creation, or explicitly excluded by the operator. Terminal state.
  - Allowed transitions: `pending → notified → fixed`, `pending → notified → escalated → fixed`, `pending → fixed` (direct fix without notification), `any non-terminal → excluded`. Backward transitions (e.g., `fixed → pending`) are not allowed via the API; if a subsequent audit run detects that a previously-fixed resource is non-compliant again, the resource's status remains "fixed" in the current campaign but it becomes eligible for inclusion in a new campaign.
- **Self-service tag fixing:** Generate valid AWS CLI commands to apply missing tags to specific resources. Commands are displayed for operators to review and execute — not auto-executed. Use `aws resourcegroupstaggingapi tag-resources` as the default for all resource types that support it (EC2, RDS, S3, EBS, EIP, Lambda all support the Resource Groups Tagging API). If a resource type does not support the generic API, generate a service-specific tag command (e.g., `aws ec2 create-tags`). The implementation must cover all six resource types from P2.5 (EC2, RDS, S3, EBS, EIP, Lambda).
- **Remediation tracking:** Track remediation progress per campaign. Campaign progress is measured as the percentage of campaign resources in each status (pending, notified, fixed, escalated, excluded) relative to total campaign resources.
  - **Before/after compliance:** "Before" compliance is captured at campaign creation time as a snapshot of the cost-weighted compliance score (from P3.1) for the campaign's resource set. "After" compliance is the current score for the same resource set, updated after each audit run. The delta shows the compliance impact of the campaign's remediation work.
- REST API endpoints for: create campaign, list campaigns, get campaign details with per-resource status, update resource status, get campaign progress metrics
- All data is workspace-scoped

**Out of scope:**
- Automated execution of tag commands on AWS (MVP is suggest-only)
- Email or Slack notifications to resource owners (Phase 8)
- Frontend campaign management UI (separate task P3.4)
- Direct tag writing via AWS API

## Acceptance Criteria

1. Create a remediation campaign from an explicit list of resource IDs and from filter criteria (e.g., "all resources missing tag X in account Y"), and verify the resolved resource set is correct
2. Owner inference produces a likely owner for resources that have creator tags or account ownership metadata; resources with no available metadata have `null` as the inferred owner
3. Per-resource status transitions work: `pending → notified → fixed`, `pending → fixed`, `notified → escalated → fixed`, `any → excluded`. Backward transitions are rejected by the API
4. "Notified" status is a manual toggle via API — no automated notification delivery in MVP
5. Generated AWS CLI tag commands are syntactically valid for all six P2.5 resource types (EC2, RDS, S3, EBS, EIP, Lambda)
6. Campaign progress metrics show the count and percentage of resources in each status (pending, notified, fixed, escalated, excluded)
7. Campaign compliance metrics show before (snapshot at creation) and after (current) cost-weighted compliance for the campaign's resource set
8. List campaigns API returns campaigns with summary progress, supporting pagination
9. A resource that is terminated/deleted after campaign creation can be marked as "excluded" and does not block campaign progress

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- Generated CLI commands are validated for syntax in tests
- API endpoints documented in OpenAPI
