---
Date: 2026-05-15
Status: Implemented (2026-05-26)
Description: Backend contract for AWS tag management — write tags back to AWS, sync AWS Organizations Tag Policies, detect value drift, split the audit log into config and action streams.
type: spec
---

# Tag management

This spec defines the backend changes that let Numio manage AWS tags as a first-class governance surface — read, evaluate, write, and audit — across all connected accounts.

> **Implemented 2026-05-26.** All sections below are delivered. Where the
> implementation departed from the original draft, the relevant section carries
> an inline note (§5.5 equivalence-group persistence, §6.4 tag-writer-role
> coupling for Org calls, §9.1 inline conflicts vs modal). The feature plan and
> per-task records live in `tasks/features/20260515_tag_management.md` and
> `tasks/done/20260525_*.md`.

## 1. Problem

Numio reads tags from AWS resources daily (`resource_inventory_service`) and evaluates them against `tag_policies` (`compliance_service`). Three gaps block the "Guardian of Transparency" capability from the vision doc:

1. **No write path.** The TagGovernance UI (`frontend/src/pages/TagGovernance/`) has an Apply / Bulk Apply flow built on `mockTagManagement.js`. No backend endpoint exists. Customers cannot fix tagging issues from inside Numio.
2. **No AWS Organizations awareness.** Customers who use AWS Org Tag Policies expect Numio to reflect those rules and surface schema conflicts. Today Numio is unaware of them.
3. **No drift detection.** Compliance evaluator flags `missing_tag` and `invalid_value`, but treats `prod` and `production` as two valid values when both appear under an enum rule. Real environments accumulate drift; Numio cannot reduce it.

The MVP target from the vision doc is "tag compliance from 61% to 91% in 30 days". Reaching that needs a closed loop: detect → recommend → write → audit.

## 2. Objective

A workspace admin can do four things from Numio against AWS resources:

1. Edit a tag on a single resource, or apply one tag change to up to 100 resources at once. Numio writes the change via `resourcegroupstaggingapi:TagResources` after explicit user approval. Every change is recorded with before / after state.
2. View AWS Organizations Tag Policy rules alongside Numio's own `tag_policies`, with conflicts highlighted.
3. Declare equivalence groups (e.g. `prod` ↔ `production`) on a tag-policy rule. The compliance evaluator flags non-canonical values as `drift`.
4. Audit every Numio-initiated change to AWS (today: tag writes; later: zombie cleanups, recommendation actions). Audit is split from Numio's own configuration audit log so the two streams query independently.

## 3. Scope

**In scope**

- Tag write to AWS (single + bulk, cap 100 resources per operation)
- New `NumioTagWriterRole` provisioned by the existing Guided CFN flow via an opt-in checkbox
- AWS Organizations Tag Policy ingestion (read-only) with auto-detect of the management account
- Drift detection via per-rule equivalence groups, surfaced as `drift` status in compliance results
- Audit split: rename `audit_events` (A record of a significant action performed in the system) to `audit_config_events` (setup actions performed on Numio); new `audit_action_events` (actions performed by the Numio on customer accounts) + `audit_action_event_items` two-level table for ongoing operations
- Risky-write detection (production or aggregate cost > $1000) gated by explicit user approval
- MCP tools for tag operations
- Frontend audit page split into Setup and Operations tabs

**Out of scope (deferred, named here so future readers know why)**

- Multi-cloud tags (GCP, Azure). Phase 2 in the vision doc.
- Tag value suggestions / peer inference. Q7 from the design discussion on 2026-05-15.
- Two-way Numio → AWS Organizations reconciliation (Numio pushing schema upstream). Q3.
- Credential encryption at rest. Tracked separately on the roadmap.
- Tag history UI timeline. Backend captures it via audit; UI work is a follow-on.
- Per-service IAM permission narrowing for the writer role. Tracked as follow-on after MVP.

## 4. Cross-cutting dependencies

Two in-flight workstreams interact with this spec. Neither blocks the spec, but sequencing matters.

- **Alembic migration squash** (per current memory: planned to collapse 22 migrations into one `initial_schema`). Migrations added by this spec land after the squash, or get folded into it if the squash arrives first.
- **`BillingDataSource` entity refactor**. Splits CUR / billing fields off `aws_accounts`. The `tag_writer_role_arn` column added here is per-account write capability, not billing, so it stays on `aws_accounts` regardless of the refactor outcome.

## 5. Data model

### 5.1 Rename `audit_events` → `audit_config_events`

Single table rename. No column changes. The current contents (account registrations, policy CRUD, threshold edits) keep the same shape.

| Item | Before | After |
| --- | --- | --- |
| Table | `audit_events` | `audit_config_events` |
| Indexes | `ix_audit_events_*` | `ix_audit_config_events_*` |
| Model | `AuditEvent` | `AuditConfigEvent` |
| Repository | `AuditEventRepository` | `AuditConfigEventRepository` |
| Schema | `AuditEventResponse`, `AuditEventListResponse` | `AuditConfigEventResponse`, `AuditConfigEventListResponse` |
| API route | `/api/v1/audit-events` | `/api/v1/audit-config-events` |
| Decorator | `@audit_trail` (writes to renamed table) | unchanged signature; rebound internally |

### 5.2 New `audit_action_events`

One row per logical operation Numio performs against an external system. The first consumer is tag writes; future consumers are zombie cleanups, recommendation actions, and notifications sent.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `workspace_id` | string | scoped, indexed |
| `actor` | string | user email or `"system"` |
| `operation_type` | string | enum: `tag_apply`, `tag_remove`, future others |
| `status` | string | `pending`, `in_progress`, `success`, `partial_failure`, `failure` |
| `rationale` | text, nullable | optional free text the user supplied |
| `summary` | JSONB | `{item_count, success_count, failure_count}` |
| `requested_at` | timestamp | row creation |
| `completed_at` | timestamp, nullable | set when status reaches a terminal value |

Indexes: `(workspace_id, requested_at desc)`, `(workspace_id, operation_type, requested_at desc)`.

### 5.3 New `audit_action_event_items`

One row per leaf change inside an operation. For a tag-apply operation that touches N resources × M keys, this table gets N×M rows.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `event_id` | UUID FK → `audit_action_events.id` | cascade delete |
| `target_type` | string | `aws_resource` for tag operations |
| `target_id` | string | resource ARN |
| `change_key` | string | tag key |
| `before_value` | string, nullable | null = tag did not exist before |
| `after_value` | string, nullable | null = tag removed |
| `status` | string | `success`, `failure`, `skipped` |
| `error_code` | string, nullable | AWS error code (e.g. `InvalidParameterException`) |
| `error_message` | text, nullable | AWS error message |
| `aws_request_id` | string, nullable | AWS RequestId for support escalation |
| `attempted_at` | timestamp | |
| `completed_at` | timestamp | |

Indexes: `(event_id)`, `(target_id, attempted_at desc)`.

### 5.4 New `aws_org_tag_policy`

Captures the effective AWS Organizations tag policy for the workspace's management account. One row per (workspace, tag_key).

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `workspace_id` | string | scoped, indexed |
| `tag_key` | string | the tag this rule covers |
| `required` | bool | from the AWS policy `enforced_for` list |
| `allowed_values` | JSONB, nullable | enum values when the policy declares them |
| `case_sensitive` | bool | from the AWS policy |
| `source_policy_id` | string | AWS Organizations policy ID |
| `source_policy_arn` | string | full ARN |
| `raw` | JSONB | full AWS policy fragment, kept verbatim for fields Numio does not normalize |
| `synced_at` | timestamp | last successful sync |

Unique index on `(workspace_id, tag_key)`.

### 5.5 Column additions

| Table | New column | Type | Purpose |
| --- | --- | --- | --- |
| `aws_accounts` | `tag_writer_role_arn` | string, nullable | Customer-side ARN of `NumioTagWriterRole`. Null = tag writes disabled for this account. |
| `tag_policy_rules` | `equivalence_groups` | JSONB, nullable | Shape: `[["production","prod"],["ml-platform","ml"]]`. First entry in each group is canonical. |

`equivalence_groups` round-trip through the existing tag-policy create/update API (`POST`/`PUT /tag-policies`). MVP ships no dedicated UI control for them — they are configured via the API or seed data.

### 5.6 Compliance status extension

`ComplianceResult.status` enum gains `drift`. Final set: `compliant`, `missing_tag`, `invalid_value`, `drift`.

A value is `drift` when:
- The rule defines `equivalence_groups`, AND
- The resource's tag value appears in a group but is not the canonical (first) entry.

`drift` resources are not blocked from cost attribution but appear in non-compliant lists for remediation.

## 6. AWS contract

### 6.1 New IAM role: `NumioTagWriterRole`

Provisioned by the customer in their AWS account via the Guided CFN flow extension (§6.2). Trust policy reuses the same `NumioServiceUser-Cfn-<label>` principal and `ExternalId` as `NumioCurReaderRole` — same trust model, separate permissions surface.

Inline policy `NumioTagWriter` grants:

| Sid | Actions | Resource |
| --- | --- | --- |
| `RGTApi` | `tag:TagResources`, `tag:UntagResources`, `tag:GetResources` | `*` |
| `Ec2Tagging` | `ec2:CreateTags`, `ec2:DeleteTags` | `*` |
| `RdsTagging` | `rds:AddTagsToResource`, `rds:RemoveTagsFromResource` | `*` |
| `S3Tagging` | `s3:PutBucketTagging`, `s3:DeleteBucketTagging`, `s3:GetBucketTagging` | `*` |
| `LambdaTagging` | `lambda:TagResource`, `lambda:UntagResource`, `lambda:ListTags` | `*` |
| `OrgPolicyRead` | `organizations:DescribeOrganization`, `organizations:DescribeEffectivePolicy`, `organizations:ListPolicies` | `*` |

Per-service permissions are required even when calling `resourcegroupstaggingapi:TagResources` because the unified API delegates to underlying services.

Resource scope is `*` for MVP. Per-service narrowing is a follow-on task.

### 6.2 CFN template extension

`backend/src/numio/onboarding/cfn_template.py` gains one optional parameter and one conditional resource block.

| Parameter | Default | Effect |
| --- | --- | --- |
| `EnableTagWrites` | `"false"` | When `"true"`, the template provisions `NumioTagWriterRole` alongside `NumioCurReaderRole` |

New stack output (emitted only when `EnableTagWrites=true`): `TagWriterRoleArn` — value of `Fn::GetAtt: NumioTagWriterRole.Arn`.

Wizard UI delta (`frontend/src/components/onboarding/GuidedOnboarding.jsx`, step `customize`): one checkbox "Enable tag writes (lets Numio update tags on resources in this account)". Default unchecked. Tooltip explains the additional IAM scope.

Verify step (§2.5 of the AWS integration spec) gains one extra check when `EnableTagWrites=true`:

| # | Step | AWS call | Skip condition |
| --- | --- | --- | --- |
| 5 | `tag_writer_assume_role` | `sts:AssumeRole` against `TagWriterRoleArn` | `EnableTagWrites=false` |

The verify-step response stores `TagWriterRoleArn` on `aws_accounts.tag_writer_role_arn` when step 5 passes.

### 6.3 Tag write API choice

`resourcegroupstaggingapi:TagResources` and `:UntagResources`. Single code path. Up to 20 resource ARNs per call (AWS limit). One Numio operation of up to 100 resources translates to at most 5 sequential calls per tag key being changed.

The response includes `FailedResourcesMap` keyed by ARN with an error code per failure. Numio parses this and writes one `audit_action_event_items` row per resource: success rows reflect the AWS RequestId; failure rows carry the error code and message verbatim.

### 6.4 AWS Organizations management account detection

`organizations:DescribeOrganization` returns `MasterAccountId`. The management account is the connected account whose own `aws_account_id` equals the returned `MasterAccountId`. Algorithm:

1. Iterate connected accounts in `aws_accounts` (status = `connected`).
2. For each, assume the role and call `organizations:DescribeOrganization`.
3. If the call fails with `AWSOrganizationsNotInUseException`, the customer is not on AWS Org. Mark the workspace as non-org; sync ends.
4. If the call succeeds and `MasterAccountId == this account's aws_account_id`, this is the management account. Proceed to sync.
5. Otherwise, continue.
6. If no connected account matches, log a warning and end. The customer must connect the management account for Org Tag Policy sync to work.

Customers do not designate which account is the management account. Numio finds it.

The `organizations:*` permissions (§6.1) live on the `NumioTagWriterRole` inline policy, so detection and sync assume each account's `tag_writer_role_arn`. An account without a tag-writer role is not eligible for Org sync — it is skipped without an AWS call. Org Tag Policy sync therefore requires tag writes to be enabled on the management account.

## 7. Services

### 7.1 `core/tag_write_service.py`

Public method:

```
async def apply_tag_changes(
    session, workspace_id, changes: list[TagChange],
    actor: str, rationale: str | None
) -> ActionEventResult
```

`TagChange` shape: `{ resource_id (CloudResource.id), tag_key, value | None }`. `value=None` means remove the tag.

Internal flow:

1. Validate `len(changes) <= 100`. Raise if exceeded.
2. Load all referenced `CloudResource` rows. Group by `account_id`.
3. For each account: confirm `tag_writer_role_arn` is set. Assume that role.
4. Create `audit_action_events` row with `status='in_progress'`, `requested_at=now`.
5. Per account, group changes by ARN. Issue `tag_resources` and `untag_resources` calls in batches of ≤20 ARNs.
6. For each resource × tag-key change, write an `audit_action_event_items` row carrying before / after / status / error / `aws_request_id`.
7. After all calls complete, recompute summary counts. Set parent `status` to `success`, `partial_failure`, or `failure`. Set `completed_at`.
8. Return `ActionEventResult` = `{ event_id, status, summary }`.

Failure of one resource never blocks others. Failures are recorded and surfaced; they do not raise.

### 7.2 `core/aws_org_tag_policy_service.py`

Public method:

```
async def sync(session, workspace_id) -> int  # rows upserted
```

Internal flow:

1. Run management-account detection (§6.4).
2. From the management account, call `organizations:ListPolicies(Filter='TAG_POLICY')`.
3. For each policy, call `organizations:DescribeEffectivePolicy(PolicyType='TAG_POLICY', TargetId=<management_account_id>)`.
4. Parse the policy JSON. AWS tag policy structure documented at https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies-syntax.html.
5. For each tag key in the effective policy, upsert one row in `aws_org_tag_policy`. Tag keys no longer present in the effective policy are deleted.
6. Return rows-upserted count.

Registered as a daily worker job `aws_org_tag_policy_sync` (24-hour interval). The job runner fans out per connected account, so the service also exposes `sync_for_account(session, workspace_id, aws_account_id)`: each per-account invocation runs the §6.4 check for that one account and syncs only when it is the management account (a no-op with zero AWS calls otherwise). `sync()` keeps the workspace-level §6.4 loop for the on-demand `POST /aws-org-tag-policy/sync` endpoint.

### 7.3 Compliance evaluator update

`core/compliance_service.py` function `_evaluate_rule` extended:

- If `rule.equivalence_groups` is set, look up the tag value across all groups.
- If found in a group at position 0 → `compliant`.
- If found in a group at any other position → `drift`. `current_value` records the actual value found.
- If not found in any group and `value_type='enum'` → fall through to existing `invalid_value` check.

`drift` status counts as non-compliant in cost-weighted scoring.

### 7.4 Conflict detection helper

`core/aws_org_tag_policy_service.py` exposes:

```
async def detect_schema_conflicts(session, workspace_id) -> list[ConflictDescriptor]
```

For each Numio `tag_policy_rule.tag_name` that has a matching `aws_org_tag_policy.tag_key`, emit a `ConflictDescriptor` when any of:

- `required` flag differs
- `allowed_values` set difference is non-empty (in either direction)
- AWS marks the key case-sensitive but Numio's allowed values include casing variants

For each AWS Org key not present in any Numio rule, emit a `missing_in_numio` conflict.

## 8. API surface

All endpoints under `/api/v1`. Authentication and role gates inherit project conventions (`admin`, `editor`, viewer).

### 8.1 Tag write endpoints

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/tags/apply/preview` | viewer+ | Returns `{ risky: bool, reasons: [], affected_resources: [...] }`. Does not write. |
| `POST` | `/tags/apply` | admin / editor | Applies changes. Body: `{ changes: [...], rationale?, confirm_risky?: bool }`. Returns `ActionEventResult`. |

Risky-write rule (matches the frontend's `isRiskyWrite` in `mockTagManagement.js`):

- Any affected resource has tag `env` in `("prod", "production")`, OR
- Aggregate monthly cost across affected resources (latest billing period) > $1000.

If preview returns `risky=true`, `apply` requires `confirm_risky=true` in the body or rejects with HTTP 400 and `code=RISKY_WRITE_NOT_CONFIRMED`.

### 8.2 Action audit endpoints

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `GET` | `/audit-action-events` | viewer+ | Paginated list. Filters: `operation_type`, `actor`, `status`, date range. |
| `GET` | `/audit-action-events/{event_id}` | viewer+ | Parent event + all child items. |

### 8.3 AWS Organizations endpoints

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `GET` | `/aws-org-tag-policy` | viewer+ | Synced AWS Org tag policy rules for the workspace. |
| `POST` | `/aws-org-tag-policy/sync` | admin | On-demand sync trigger. Out of band of the daily job. |
| `GET` | `/tags/schema/conflicts` | viewer+ | List of `ConflictDescriptor` from §7.4. |

### 8.4 Renamed config audit endpoint

`/api/v1/audit-events` → `/api/v1/audit-config-events`. Same query parameters and response shape. The frontend audit page (§9) updates simultaneously; no redirect or alias is provided.

## 9. Frontend

### 9.1 TagGovernance page

Wire the Resources tab's bulk **Apply tag…** action to the write endpoints. The resource list stays on the IA v2 mock dataset; backing it with live `/resources` data is tracked separately. The page has no in-memory `overrides` map — that legacy state was removed when `ia_v2_govern` rebuilt the page.

- Every apply (single or bulk) calls `POST /tags/apply/preview` first, so a risky single-resource write triggers the same gate as a bulk one.
- If `risky=true`, `RiskyWriteModal` (driven by the preview response) requires confirmation; on confirm, the apply submits with `confirm_risky=true`. Otherwise the apply submits directly.
- Partial failures (`status=partial_failure`) list the failed resources with their AWS error codes, read from `GET /audit-action-events/{event_id}`.

Schema tab gets a "Conflicts" indicator (count badge on the tab label) wired to `GET /tags/schema/conflicts`. Conflicts render as a read-only inline section at the top of the Schema tab — they are displayed, not resolved (two-way reconciliation is out of scope for MVP). The `AwsOrgConflictModal` named in earlier drafts was removed when `ia_v2_govern` rebuilt the TagGovernance page; the inline section replaces it and matches the rebuilt page's density.

### 9.2 Audit page

Today's `/govern/audit` page reads from `/audit-events`. After this change:

- Two tabs at the top: **Setup** (default) and **Operations**.
- **Setup** reads from `/audit-config-events`. Same filters as today.
- **Operations** reads from `/audit-action-events`. Same filter set plus `operation_type` (initial values: `tag_apply`, `tag_remove`).
- Clicking a row in Operations opens a drawer showing the parent event + child items via `/audit-action-events/{event_id}`.

## 10. MCP tools

Add five tools to `backend/src/numio/mcp/server.py`:

| Tool | Purpose | Notes |
| --- | --- | --- |
| `list_tag_keys()` | All known tag keys with `source` (`numio` or `aws-org`) and required flag | Joins `tag_policies.rules` and `aws_org_tag_policy` |
| `get_resource_tags(resource_arn)` | Current tags from `cloud_resources.tags` | Read-only |
| `apply_tags(resource_arn, tags, rationale?)` | Single-resource tag apply | Wraps `tag_write_service`. MCP intentionally single-resource; chat-driven bulk routes through a Campaign instead. |
| `list_tag_conflicts()` | Same as `GET /tags/schema/conflicts` | |
| `get_tag_coverage()` | Same as existing `/compliance/summary` | Convenience |

MCP `apply_tags` enforces the same risky-write rule. If risky, the tool requires an explicit `confirm_risky=True` argument; otherwise it returns `{ status: 'rejected', reason: 'risky_write_not_confirmed', preview: {...} }`.

## 11. Audit refactor migration plan

**Status: all steps delivered (2026-05-26).** Alembic head advanced through the audit rename, the action-event tables, and the tag-management columns/tables; the latest revisions added are `983dae207764` (`tag_policy_rules.equivalence_groups`) and `5d7b8211c709` (`aws_org_tag_policy`).

Sequenced. Each step is one alembic revision or one PR. Each must be reversible.

1. **Alembic revision M1** — rename table `audit_events` → `audit_config_events`. Rename indexes. Use `op.rename_table()` and `op.execute("ALTER INDEX ... RENAME TO ...")`. Downgrade reverses.
2. **Alembic revision M2** — create tables `audit_action_events`, `audit_action_event_items`, `aws_org_tag_policy`. Add columns `aws_accounts.tag_writer_role_arn`, `tag_policy_rules.equivalence_groups`. Downgrade drops them.
3. **Backend code PR** — rename `AuditEvent` → `AuditConfigEvent`, repository, schemas, decorator imports, API route. All endpoint decorators (~10 sites) recompile against the renamed entity. Tests updated.
4. **Frontend PR** — replace single audit page with two-tab layout (§9.2). Update API client.
5. **Tag-write backend PR** — `tag_write_service`, `audit_action_event` repository + schemas + endpoints, MCP tool registration.
6. **Tag-write frontend PR** — TagGovernance live wiring (§9.1).
7. **AWS Org sync PR** — `aws_org_tag_policy_service`, repository, schemas, endpoints, daily job registration.
8. **Drift detection PR** — equivalence-group field, compliance evaluator update, UI surface in compliance views.

Steps 1 and 2 land in the same migration release. Steps 3 and 4 must land together (renamed endpoint requires updated client). Steps 5–8 are independent and parallelizable.

## 12. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Customer enables tag writes; an operator mass-applies a wrong tag value; many resources mis-tagged. | Risky-write modal forces explicit confirmation. 100-resource cap per op. Every change recorded with before / after for one-by-one rollback via audit. |
| `resourcegroupstaggingapi:TagResources` returns partial failure (`FailedResourcesMap` non-empty). | Each failed resource produces a child audit row with AWS error code and message. Parent status = `partial_failure`. UI surfaces the failure list. |
| Management-account auto-detection fails (assumed role lacks `organizations:DescribeOrganization`). | Daily sync logs failure per account, continues with the next. UI shows "AWS Org policy not available" instead of stale data. Customer can fix by granting the permission or connecting the management account. |
| `audit_action_event_items` table grows fast. | At 10 bulk ops/day × 100 items = 1000 child rows/day = 365k/year. Indexed on `event_id` and `target_id`. No retention policy in MVP. Documented as a follow-on. |
| Rename of `audit_events` breaks any consumer outside the repo (e.g. a script that queries the table directly). | Numio is single-host, single-image today. No external consumers known. Migration runs offline during deploy. Documented in release notes. |
| Squash of alembic migrations lands after M1/M2 and discards them. | M1 + M2 are folded into the post-squash baseline. The squash owner re-emits the rename and new tables as part of the consolidated `initial_schema` migration. |

## 13. Open implementation notes (no decision pending)

- AWS Org tag policies use JSON keys like `@@assign`, `@@operators_allowed_for_child_policies` that Numio does not map. The full policy fragment is preserved in `aws_org_tag_policy.raw` so future versions can use it without re-fetching.
- The MCP `apply_tags` single-resource cap exists because chat-driven bulk operations bypass the risky-write UX. Chat-driven bulk should route through a Campaign (already modeled) instead of a direct call.
- IAM permissions for the writer role (§6.1) are `Resource: *`. Per-service narrowing (e.g. limit `s3:PutBucketTagging` to bucket ARN patterns) is a follow-on task once we have data on how customers configure scopes.
- For S3 buckets specifically, `PutBucketTagging` replaces the entire tag set, not individual keys. The tag-write service reads current tags first and merges, so single-key edits behave as expected.

## 14. References

- `docs/Numio vision.md` — "Guardian of Transparency" capability and the 61% → 91% tag compliance target.
- `docs/arb/aws-integration-spec.md` — Guided CFN flow, verify steps, four-check validation.
- `frontend/src/pages/TagGovernance/TagGovernancePage.jsx` — UI consumer of the write endpoints.
- `frontend/src/mocks/mockTagManagement.js` — mock model used by the UI today, defines `isRiskyWrite` rule mirrored in §8.1.
- AWS docs: `resourcegroupstaggingapi:TagResources` https://docs.aws.amazon.com/resourcegroupstagging/latest/APIReference/API_TagResources.html
- AWS docs: Organizations tag policy syntax https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies-syntax.html
