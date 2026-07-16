---
status: done
phase: 3
task_id: P3.1
---

# Tag Policy Engine and Compliance Audit

## Prerequisites

- **P2.5 — Resource inventory sync:** Provides the resource metadata (resource ID, type, account, tags) that compliance audit evaluates against policies.
- **P2.3 or P2.4 — Cost Explorer or CUR ingestion:** Provides the cost data used to compute cost-weighted compliance scores. At least one cost data source must be available.
- **P2.2 — Background worker framework:** Provides the job scheduling and execution infrastructure used to run the compliance audit job.

## Problem Statement

Most organizations have 30-60% of cloud resources untagged or mistagged, making cost attribution unreliable. Numio's key differentiator is treating tag governance as a first-class capability. Customers need to define tagging policies, and Numio must continuously audit all resources against those policies, producing cost-weighted compliance scores that make the impact of tagging gaps tangible in dollar terms.

## Scope

**In scope:**
- **Tag policy definition:** Define tag policies with the following attributes per required tag: tag name, value type (string, numeric, enum, email, date), allowed values (for enum type), default value (optional), and applicability rules — which resource types and which accounts/environments the tag applies to
- **Multiple policies:** Support multiple coexisting policies (e.g., company-wide policy + team-specific policy). Policies are evaluated independently — each policy's rules stand on their own and are never merged across policies. A resource is "fully compliant" only when it satisfies every applicable policy. If Policy A requires `env ∈ {prod, staging}` and Policy B requires `env ∈ {dev, staging}`, a resource tagged `env=staging` is compliant with both, while `env=prod` satisfies A but violates B. Compliance is reported per-policy and in aggregate (compliant with all applicable policies). Policies may optionally carry a numeric priority used for display ordering and future exemption logic, but priority does not affect rule merging — there is no union or intersection of allowed values across policies.
- **Tag policy versioning:** Track policy changes over time — when a policy was created, modified, and by whom. Support comparing compliance before/after a policy change.
- **Tag compliance audit:** Evaluate all resources (from resource inventory, P2.5) across all registered accounts against active tag policies. Produce per-resource compliance status: compliant, missing tag, invalid value, and which specific policy rule is violated.
  - **Tag data source:** Compliance audit uses tags from the resource inventory (`CloudResource.tags`, populated by P2.5 via AWS service APIs like EC2 DescribeInstances, RDS DescribeDBInstances, etc.). These reflect the *current* tags on each resource. This is the correct source for compliance evaluation because the question is "does this resource have the required tags right now?" Note: P3.3 (cost attribution) uses a different tag source — `cost_records.tags` from CUR, which are cost allocation tags that must be separately activated in the AWS Billing console and may lag or differ from the resource API tags. A resource can be tag-compliant per P3.1 (resource has the tag) but unattributed per P3.3 (tag not activated as a cost allocation tag in AWS). This discrepancy is expected and is surfaced by showing both compliance status and attribution status to the user.
  - **Trigger mechanism:** The compliance audit runs as a separate background job (integrated with the worker framework, P2.2), triggered automatically after each resource inventory sync completes. It is also callable on-demand via the REST API (e.g., after a policy is created or modified, or for ad-hoc re-evaluation). The audit job is idempotent — re-running produces the same results without duplicating compliance records.
- **Cost-weighted compliance scoring:** Compliance score is weighted by resource cost, not just resource count. A $5,000/month untagged instance contributes more to non-compliance than a $2/month S3 bucket. Report compliance by tag, by account, and by resource type. Compliance "by team/owner" is available only when the cost attribution engine (P3.3) has been configured with attribution rules that map resources to teams/owners — this task provides the compliance data, and P3.3 provides the dimension mapping. Until P3.3 attribution rules exist, team/owner breakdowns return empty results rather than failing.
  - **Aggregate formula:** `cost_weighted_compliance = Σ(cost of fully compliant resources) / Σ(total cost of policy-applicable resources) × 100`. "Fully compliant" means the resource satisfies all required tags across all applicable policies — every required tag is present and has a valid value. The denominator includes only resources that are subject to at least one active policy (resources outside all policy scopes are excluded).
  - **Per-tag score:** In addition to the aggregate score, report a per-tag compliance score: `Σ(cost of resources where tag X is present and valid) / Σ(cost of resources where tag X is required) × 100`. This lets users identify which specific tags drag down overall compliance.
  - **Per-policy score:** Report the same cost-weighted formula scoped to each individual policy, so users can see which policy has the worst compliance.
  - **Resources with no cost data:** Resources in the inventory that have no matching cost record (e.g., newly created before next CUR delivery, free-tier, or IAM-only resources) are treated as $0 cost. They contribute zero weight to cost-weighted scores but are still evaluated for compliance and appear in resource-count metrics and non-compliant resource lists. This ensures cost-weighted scores reflect financial impact while resource-count metrics capture full governance coverage.
- **Tag gap analysis:** Total resources, compliant count, non-compliant count, untagged spend ($ amount), compliance trend over time. Identify which specific tags have the worst compliance. Rank non-compliant resources by cost impact.
- **Compliance trend storage:** Each audit run produces a snapshot of aggregate and per-dimension compliance scores (overall, per-tag, per-policy, per-account, per-resource-type). Snapshots are stored with a timestamp and audit run ID. Trend data is retained indefinitely in MVP; the schema should include a `snapshot_date` column to support future retention policies. The compliance trend API returns a time series of these snapshots for charting compliance improvement over time.
- **Policy preview (dry-run):** A dedicated preview endpoint (`POST /api/v1/tag-policies/preview`) accepts a policy definition (same schema as create, but not persisted) and returns the list of resources that would be affected, along with a simulated compliance summary. This allows the frontend (P3.4) to show which resources a policy would affect before the user commits to creating or activating it.
- REST API endpoints for: create/update/list tag policies, preview policy (dry-run), get compliance summary, get compliance by dimension, list non-compliant resources (sortable by cost impact), get compliance trend over time
- All data is workspace-scoped

**Out of scope:**
- Tag remediation campaigns (separate task P3.2)
- Frontend tag governance dashboard (separate task P3.4)
- Modifying tags on AWS resources (MVP outputs CLI commands only, handled in P3.2)

## Acceptance Criteria

1. Define a tag policy requiring "team" and "environment" tags on EC2 and RDS resources
2. Tag compliance audit correctly identifies all non-compliant resources across multiple accounts
3. Two policies with overlapping resource scopes produce correct per-resource results — each resource shows which specific policy rules it violates, and aggregate compliance reflects all applicable policies
4. Compliance score is cost-weighted: given a $1,000/month untagged instance and a $1/month compliant resource, the aggregate score reflects the cost ratio, not the 50/50 resource count
5. Per-tag compliance score correctly isolates the impact of each required tag independently
6. Resources with no cost record are excluded from cost-weighted scores (zero weight) but appear in resource-count compliance metrics and non-compliant resource lists
7. Tag gap analysis shows untagged spend in dollar terms, not just resource count
8. Compliance API returns results grouped by account and by resource type, each with cost-weighted percentages
9. Compliance audit runs automatically after resource inventory sync completes, and can be triggered on-demand via API
10. Compliance trend data is stored as a per-audit-run snapshot (one data point per audit execution). Snapshots are retained indefinitely — retention policy is not enforced in MVP but the schema should support future retention limits
11. Policy versioning tracks when policies were created and modified, and compliance can be compared before vs. after a policy change by querying trend snapshots from before and after the policy's `updated_at` timestamp
12. Policy preview (dry-run) endpoint accepts a policy definition and returns the list of affected resources and simulated compliance summary without persisting the policy

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
