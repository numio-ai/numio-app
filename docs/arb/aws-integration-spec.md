---
Date: 2026-04-26
Status: Final
Description: AWS integration — what the Add Account flow does, how it works across the three methods (Guided, Advanced, Chat), and how to test it. Validated against backend/src/numio/onboarding/, backend/src/numio/api/onboarding.py, backend/src/numio/core/aws_service.py, frontend/src/components/onboarding/, and frontend/src/pages/Settings/Integrations.jsx.
type: spec
---

# AWS integration

A Numio customer connects an AWS account so Numio can read CUR (Cost and Usage Report) data and resource inventory. The customer picks one of three onboarding methods from the **Add Account** hub. All three converge on the same backend endpoint and run the same verification.

## 1. Functionality

Entry: **Settings → Integrations → Add Account**. The button opens an **Add-account hub** that offers three methods:

| Method | When to use | Default |
|---|---|---|
| **Guided** | First-time AWS admins. Numio generates a CloudFormation template that creates IAM resources end-to-end, named per a per-instance **label** so multiple Numio instances can coexist in one AWS account without collisions. | Primary card, "Recommended" badge |
| **Advanced** | The customer **already has** an IAM user, role, ExternalId, and (usually) a CUR export configured outside Numio. They paste the values directly. | Secondary text link below a divider |
| **Chat** | Same CFN flow as Guided, surfaced as a scripted chat bubble UI. v0; intentionally minimal. | Hidden unless `ONBOARDING_CHAT_ENABLED=true` ("Beta" badge) |

Hub component: `frontend/src/components/onboarding/OnboardingMethodHub.jsx`. Method routing in `frontend/src/pages/Settings/Integrations.jsx`.

The wizard does not create or configure a CUR export. Enabling CUR delivery to S3 is a customer prerequisite (**Billing → Data Exports** for CUR 2.0, or **Billing → Cost & Usage Reports** for legacy). Numio reads what's already there.

## 2. Design

### 2.1 Trust model (shared by all methods)

A Numio-side identity assumes a customer-account role gated by an `ExternalId`. ExternalId blocks the confused-deputy attack: a third party who learns the role ARN cannot assume it without the matching ExternalId.

```
Numio service identity  ─ sts:AssumeRole + ExternalId ─>  customer's reader role
                                                                │
                                            inline read-only policy on the role
                                                                │
                                            S3 (CUR bucket only), Cost Explorer,
                                            EC2/RDS/ELB/Lambda/S3/IAM describe+list+tag
```

For Guided and Chat, Numio embeds `Workspace.external_id` (a server-generated UUID — `backend/src/numio/models/workspace.py:25`) into the CFN template so the trust policy auto-aligns. For Advanced, the customer brings whatever ExternalId their existing role's trust policy uses; Numio stores that value verbatim and replays it on AssumeRole.

### 2.2 Method: Guided (CloudFormation wizard)

Six steps (`frontend/src/components/onboarding/GuidedOnboarding.jsx`):

1. **Intro** — overview.
2. **Customize** — collects a mandatory per-instance label (default: current local time as `DDMMYYHHMM`), display name, AWS region, and CUR location.
3. **Apply** — backend renders a CloudFormation template; UI offers a one-click launch URL into the customer's AWS console (quick-create) or a download fallback. The downloaded file is named `NumioConnect-<label>.yaml`.
4. **Waiting** — operator waits for the stack to reach `CREATE_COMPLETE`.
5. **Verify** — operator pastes four stack outputs back into Numio; backend runs the four checks of §2.5 and registers the account.
6. **Success** — done.

**Customize fields** — `label` is validated by the backend before the template is rendered (HTTP 422 if missing or malformed). The other fields are free-form text whose CFN parameter constraints in `backend/src/numio/onboarding/cfn_template.py` reject malformed values at stack-launch time:

| Field | Default | Pattern |
|---|---|---|
| **Label** (mandatory) | current local time as `DDMMYYHHMM` (e.g. `2604261950`) | `^[a-z0-9][a-z0-9-]{0,31}$` (1–32 chars, lowercase + digits + hyphen, must start with a letter or digit). Backend-enforced. |
| Display name (alias) | — | (no pattern; checked by `POST /api/v1/accounts`) |
| AWS region | `us-east-1` | `^[a-z]{2}-[a-z]+-\d$` |
| CUR S3 bucket name | — | `^$\|^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$` |
| CUR path prefix | `cur` | `^[A-Za-z0-9._/-]{0,512}$` |
| CUR report name | — | `^[A-Za-z0-9_-]{0,128}$` |
| Workspace external id | (workspace UUID) | `^[A-Za-z0-9._:/-]{8,256}$` (NoEcho) |

**In-progress persistence and cancellation** — once the operator submits Customize (i.e. clicks **Generate template →**), Numio writes a workspace-scoped row to `onboarding_in_progress` capturing only `label`, `step`, and timestamps. The wizard updates this row on every step transition into `customize | apply | waiting | verify`. On the next visit to **Settings → Integrations** (any browser, any device) the page calls `GET /api/v1/onboarding/in-progress` and auto-restores the wizard at the saved step with the same label. Paste-back fields (AccessKeyId, SecretAccessKey, RoleArn, ExternalId, AwsAccountId) and the rendered template body are intentionally **not** persisted — the operator re-pastes the values on resume.

The wizard has no silent side exits once Customize has been submitted. The top-right **Back to methods** button is removed from Customize, Apply, Waiting, and Verify; the only ways out of an in-progress wizard are:

1. **Successful registration** — when the four-check verification reaches `connected`, the backend returns the account row and the wizard issues `DELETE /api/v1/onboarding/in-progress` before transitioning to Success.
2. **Explicit cancel** — a *Cancel onboarding* button is visible from Customize onward (and the Intro step's *Back to methods* button routes through the same modal once a record exists). The modal requires the operator to tick *I have deleted the CFN stack in AWS Console* before the Cancel action enables. Confirming deletes the `onboarding_in_progress` row and dismisses the wizard.

In-step **Back** buttons still walk one step backward through the chain (Verify → Waiting → Apply → Customize → Intro). On the Intro step, the in-step Back button is labelled *Back to methods* and exits the wizard (directly when no persistence has been written, via the cancel modal otherwise). Reaching Intro from a later step does not delete persistence — the row retains its last persisted step, so a subsequent refresh resumes there.

**What the CFN template creates** — all in the customer's AWS account. IAM names embed the label, so the stack requires `CAPABILITY_NAMED_IAM`. The label is what lets multiple Numio instances coexist in one AWS account, and what lets an AWS admin tell from the IAM console which instance owns each resource (the manual / Advanced flow uses the same brand prefixes without the `-Cfn-<label>` suffix).

| Resource | Name | Purpose |
|---|---|---|
| `AWS::IAM::User` | `NumioServiceUser-Cfn-<label>` | Identity Numio uses to call AssumeRole |
| `AWS::IAM::AccessKey` | (attached to the user) | Returned in stack outputs |
| `AWS::IAM::Role` | `NumioCurReaderRole-Cfn-<label>` | Trust policy gated by the user + `ExternalId` |
| Inline policy on role | `NumioReadOnly` | Read-only S3 (the CUR bucket only), Cost Explorer + `cur:DescribeReportDefinitions`, and resource-inventory describe/list/tag across EC2, RDS, ELB, Lambda, S3, IAM |
| `AWS::IAM::Role` (conditional) | `NumioTagWriterRole-Cfn-<label>` | Provisioned only when the `EnableTagWrites` parameter is `true`. Same trust model as the reader role (same `NumioServiceUser` principal + `ExternalId`). Inline policy `NumioTagWriter` grants tag write (`tag:TagResources`/`UntagResources`, plus per-service `ec2`/`rds`/`s3`/`lambda` tagging) and AWS Organizations policy read. |

Both the IAM user and the IAM role carry four ownership tags: `ManagedBy=Numio`, `numio:managed-by=CloudFormation`, `numio:stack=<stack name>` (resolved at deploy time via `!Ref AWS::StackName`), `numio:instance-label=<label>`. Each carries a `Description` that contains the verbatim sentence "Managed by Numio CloudFormation. Do not modify manually — changes will be overwritten on stack update or lost on stack delete."

**Stack outputs**: `RoleArn`, `AccessKeyId`, `SecretAccessKey`, `ExternalId`, `AwsAccountId`, plus echoed `CurBucketNameOut`, `CurPathPrefixOut`, `CurReportNameOut`, and — only when `EnableTagWrites=true` — `TagWriterRoleArn`. Default stack name: `NumioConnect-<label>` (the AWS console operator may override during creation).

The `EnableTagWrites` parameter (default `false`) is surfaced in the Guided wizard's Customize step as an opt-in checkbox; the quick-create launch URL and the downloaded template carry the chosen value. See `docs/tag-management/tag-management-spec.md` §6 for the role's full permission set.

The template does **not** create an S3 bucket or `AWS::CUR::ReportDefinition`. CUR setup is the customer's responsibility.

### 2.3 Method: Advanced (raw form)

For users with existing IAM and CUR resources. Component: `AccountFormDialog` in `frontend/src/pages/Settings/Integrations.jsx:107` — also reused for inline edit of an already-registered account. Subtitle: *"For users comfortable with IAM roles, S3 bucket policies, and CUR exports. Every field maps 1:1 to AWS — no auto-setup."* A **← Back to Guided** button returns to the hub.

| Section | Field | Required | Source |
|---|---|---|---|
| Numio Service Credentials | AWS Access Key ID | yes | An access key on the customer-account IAM user that will assume the role |
|  | AWS Secret Access Key (masked) | yes | Pair with the access key above |
| Account Details | AWS Account ID (12 digits) | yes | Customer account |
|  | Role ARN | yes | The customer-account role Numio will assume (e.g. `arn:aws:iam::…:role/NumioCurReaderRole`) |
|  | External ID | yes | The `sts:ExternalId` value the role's trust policy already uses |
|  | Display Name (alias) | no | Shown in Numio |
| CUR Configuration (collapsible) | S3 Bucket | no | Existing CUR bucket |
|  | S3 Prefix | no | Existing CUR prefix (e.g. `daily/MyCostExport/data`) |
|  | Report Name | no | Existing CUR report |

CUR fields are optional in Advanced — if omitted, the verify-step S3 checks (§2.5) skip rather than fail. The account registers, but CUR-backed views stay empty until the customer fills them in later.

Submit calls the same `registerAccount()` API as Guided/Chat.

### 2.4 Method: Chat (flagged)

Component: `frontend/src/components/onboarding/ChatOnboarding.jsx`. Flag-gated; off in production by default.

A scripted finite-state machine (greet → region → bucket → apply → waiting → outputs → verify → success) wrapping the same CFN template generation and `registerAccount()` call as Guided. Standalone from `ChatPanel` by design — Chat v1 (LLM-grounded) is a separate follow-up that will migrate the flow into the real chat panel.

Backend: `GET /api/v1/onboarding/features` returns `{ chat_enabled: bool }`, sourced from `settings.onboarding_chat_enabled` (`backend/src/numio/core/config.py:32`). Frontend reads it on mount and conditionally renders the Chat card in the hub.

### 2.5 Verify — what the backend checks (shared)

`POST /api/v1/accounts` runs the reader-path checks (1–4) sequentially via `backend/src/numio/core/aws_service.py`, then an additive tag-writer check (5). Steps 1–4 determine the account's `overall_status`; step 5 is optional and never changes it.

| # | Step | AWS call | Skip condition |
|---|---|---|---|
| 1 | `verify_credentials` | `sts:GetCallerIdentity` with provided access key/secret | never |
| 2 | `assume_role` | `sts:AssumeRole` with `RoleArn` and `ExternalId` | never |
| 3 | `s3_list` | `s3:ListObjectsV2` on `s3://<bucket>/<prefix>/` | CUR fields empty |
| 4 | `s3_read` | `s3:HeadObject` on the first listed object | listing returned 0 objects |
| 5 | `tag_writer_assume_role` | `sts:AssumeRole` with `TagWriterRoleArn` and `ExternalId` | no `TagWriterRoleArn` provided, or step 1 failed |

Step 5 is additive: a failure does not downgrade `overall_status` (tag writes layer on top of a working read connection). `aws_accounts.tag_writer_role_arn` is persisted only when step 5 passes — the column doubles as the "tag writes enabled" flag (`docs/tag-management/tag-management-spec.md` §5.5, §6.2).

The frontend renders per-step pass/fail/skip inline via the shared `ValidationSteps` component (`frontend/src/components/onboarding/ValidationSteps.jsx`), used by both Guided and Advanced. Visual rendering — row layout, icons, colors, `Overall` footer, `remediation` hints — is identical in both flows.

In Guided, the Verify step also renders the five paste-back fields (`AwsAccountId`, `RoleArn`, `AccessKeyId`, `SecretAccessKey`, `ExternalId`) inline so the user can edit values and re-validate without leaving the step. When tag writes were enabled in Customize, a sixth field (`TagWriterRoleArn`) appears for pasting that stack output. While a validation request is in flight, the submit button shows `Validating…` and `aria-busy=true`, the fields are `disabled`, and four `pending` rows render immediately with the canonical labels above. Auto-scroll brings the Verify panel into view on transition so the state change is visible.

Retry semantics: the Verify step's submit calls `POST /api/v1/accounts` (registerAccount) on the first attempt, and `PUT /api/v1/accounts/{id}` (updateAccount) thereafter — this re-runs all four checks server-side. If `POST` returns 409 because an account with the same `aws_account_id` already exists from a previous attempt, the wizard transparently looks up the existing record and falls back to `PUT`, so the operator does not need to remove a stale `disconnected` row before retrying.

### 2.6 Endpoints

- `GET /api/v1/onboarding/cfn-template?label=&region=&cur_bucket_name=&cur_report_name=&cur_path_prefix=` — returns `{template_body, launch_url, download_url, launch_mode, stack_name, label, ...}`. `label` is mandatory; missing or malformed values produce HTTP 422 with the project's standard `ErrorResponse` shape (regex, example, and a plain-English explanation in `message`; field-level breakdown in `details[0]`). `launch_mode` is `quickcreate` when `PUBLIC_BASE_URL` is set (template is hosted and pre-loaded into the AWS console), otherwise `upload`. Used by Guided and Chat.
- `GET /api/v1/onboarding/features` — `{ chat_enabled: bool }`. Drives Chat-card visibility in the hub.
- `GET /api/v1/onboarding/in-progress` — returns the workspace's saved Guided wizard state (`{ label, step, created_at, updated_at }`) or HTTP 204 when none exists. Drives auto-restore on Settings → Integrations mount. Admin-only.
- `PUT /api/v1/onboarding/in-progress` — body `{ label, step }`. Idempotent upsert; a single in-progress record is enforced per workspace by a UNIQUE constraint on `workspace_id`. `step` must be one of `customize`, `apply`, `waiting`, `verify` (intro and success are not persisted). Invalid label or step → HTTP 422. Admin-only.
- `DELETE /api/v1/onboarding/in-progress` — removes the workspace's record. Idempotent (HTTP 204 whether or not a row existed). Called by the wizard on successful registration and on confirmed cancel. Admin-only.
- `POST /api/v1/accounts` — registers the account and runs §2.5 inline. Used by all three methods on first submit. Returns 409 if the `aws_account_id` already exists.
- `PUT /api/v1/accounts/{id}` — updates account fields and re-runs §2.5. Used by Guided's Verify-step retry, Advanced's Edit dialog, and the Guided wizard's transparent 409 fallback.
- `POST /api/v1/accounts/{id}/validate` — re-runs §2.5 against an existing record without changing fields. Used by the Validate button on the accounts list.

### 2.7 Production deployment note

In production, replace the `Principal` in `NumioCurReaderRole`'s trust policy with the ECS task role ARN running Numio. The rest of the trust policy (ExternalId condition) is unchanged.

## 3. Testing

### 3.1 Pre-flight cleanup checklist

A fresh test run requires a clean slate. The Guided and Chat methods name IAM resources from a per-instance label, so two runs with **different** labels can coexist in the same AWS account. Re-running with the **same** label still fails with `EntityAlreadyExists` until the prior stack is dropped — typically the case when an operator accepts the auto-default twice in the same minute. Advanced does not create AWS resources, so its pre-flight is Numio-side only.

The repo ships an automated audit + cleanup-command generator at [`tasks/features/20260419-01_feature_aws-onboarding/scripts/pre-flight-check.sh`](../../../tasks/features/20260419-01_feature_aws-onboarding/scripts/pre-flight-check.sh). Run it before every Guided/Chat test:

```bash
./tasks/features/20260419-01_feature_aws-onboarding/scripts/pre-flight-check.sh \
  --profile <your-aws-profile>
```

It exits `0` if clean, `1` if it found leftovers (and prints the `aws ...` commands to drop them).

**Customer AWS account** (Guided / Chat only — Advanced creates nothing):

- [ ] **Delete the CloudFormation stack** `NumioConnect-<label>` for the label(s) under test (CFN console → Delete). Cascades to the IAM user, access key, role, and inline policy. To list every CFN-managed Numio stack in the account, filter the CloudFormation console for stacks beginning with `NumioConnect-`, or query the IAM console for resources tagged `numio:managed-by=CloudFormation`.
- [ ] If stack delete failed and left orphans:
  - [ ] IAM user `NumioServiceUser-Cfn-<label>` — deactivate + delete its access keys, then delete the user.
  - [ ] IAM role `NumioCurReaderRole-Cfn-<label>` — delete its inline `NumioReadOnly` policy, then the role.
- [ ] **Do not delete the CUR export or its S3 bucket.** CUR is a prerequisite, not a Numio-managed resource. Recreating it costs ~24 h before fresh data lands.

**Numio (local install)** — applies to all three methods:

- [ ] **Account row** — `DELETE FROM aws_accounts WHERE aws_account_id = '<12-digit id>';`
- [ ] **Ingestion checkpoint** (forces full reload on next ingestion) — `DELETE FROM ingestion_statuses WHERE data_source = 'cur_ingestion';`
- [ ] **Cost data** — usually unnecessary; the next ingestion upserts on `(data_source, line_item_id)`. Drop only if you need a clean snapshot.

### 3.2 Prerequisites

- A customer AWS account with a working CUR export. Note its bucket, path prefix, and report name (find at **Billing → Data Exports** or **Billing → Cost & Usage Reports**).
- For Guided/Chat: an **administrator** session in that account (AWS root, SSO `AdministratorAccess`, or an IAM identity with the IAM and STS writes the template needs). **Common blocker**: SSO `PowerUserAccess` denies IAM mutations by design — symptom is `AccessDenied … iam:CreateUser …`. Switch to admin and retry.
- For Advanced: the customer-side IAM user, role, ExternalId, and (optionally) CUR export are already in place.
- Numio running locally per `docs/dev-runbook.md`. To enable Chat, set `ONBOARDING_CHAT_ENABLED=true` in the backend env and restart.

### 3.3 Run the test — Guided

1. Open Numio → **Settings → Integrations → Add Account → Guided**.
2. **Customize**: accept the auto-filled timestamp label or override it with something more meaningful (worktree name, deploy tag, initials + date); enter display name; keep region `us-east-1`; enter CUR bucket / prefix / report name.
3. **Apply**: click the launch URL (opens AWS console with the template pre-loaded), or download the template (`NumioConnect-<label>.yaml`) and upload it to **CloudFormation → Create stack → With new resources**. Region must match step 2.
4. In the CFN console: tick **I acknowledge that AWS CloudFormation might create IAM resources with custom names** (this is `CAPABILITY_NAMED_IAM`). Submit. Wait ~60 s for `CREATE_COMPLETE`.
5. Open the stack's **Outputs** tab. Copy `RoleArn`, `AccessKeyId`, `SecretAccessKey` (shown only once), `ExternalId`.
6. Back in Numio's **Verify** step: paste all four. Submit. The four checks (§2.5) run inline; if all pass, the account appears under Settings → Integrations.

### 3.4 Run the test — Advanced

1. Open Numio → **Settings → Integrations → Add Account → "Use the Advanced form instead"**.
2. Fill the three sections (§2.3) with values you already have:
   - Numio Service Credentials: access key id + secret of the IAM user that will assume the customer role.
   - Account Details: 12-digit account id, role ARN, External ID (whatever value your trust policy uses), optional alias.
   - CUR Configuration (expand): bucket, prefix, report name.
3. Submit. The same four checks (§2.5) run; pass/fail/skip is shown inline. If all pass, the account registers.

### 3.5 Run the test — Chat

Identical end-to-end behaviour to Guided. Step through the chat bubbles (region → bucket → apply → outputs → verify); the launch URL, stack interaction, and Verify step are the same as §3.3 steps 3–6.

### 3.6 Common failures

| Symptom | Cause / fix |
|---|---|
| `AccessDenied … iam:*` at stack launch | Session lacks IAM write (usually SSO PowerUserAccess). Re-login as admin. |
| `EntityAlreadyExists` on `NumioServiceUser-Cfn-<label>` / `NumioCurReaderRole-Cfn-<label>` | The same `<label>` was used twice. Either drop the prior `NumioConnect-<label>` stack, or override the label with a different value before re-running. |
| Submitting the Customize step yields HTTP 422 with a `VALIDATION_ERROR` body about the `label` field | The label is empty or fails `^[a-z0-9][a-z0-9-]{0,31}$`. Use lowercase letters, digits, and hyphens; start with a letter or digit; keep length 1–32. |
| Verify: `verify_credentials` fails | Wrong `AccessKeyId` / `SecretAccessKey`. Re-copy from stack outputs (Guided/Chat) or re-check the IAM user (Advanced). |
| Verify: `assume_role` fails with `AccessDenied` | `ExternalId` mismatch with the role's trust policy, or wrong `RoleArn`. |
| Verify: `s3_list` fails with `AccessDenied` | CUR bucket name doesn't match a real bucket the role can read. |
| Verify: `s3_list` succeeds but returns 0 objects | CUR not yet delivered (wait 24 h after enabling), or wrong path prefix. |
| Quick-create launch URL missing (download-only) | `PUBLIC_BASE_URL` env var not set; template hosting unavailable. Use the manual upload path. |
| Chat card not visible in hub | `ONBOARDING_CHAT_ENABLED=false` (the default). Set to `true` and restart the backend. |
