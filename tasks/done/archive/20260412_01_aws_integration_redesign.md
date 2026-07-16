---
status: done
kind: task
---

# Redesign AWS Account Integration

Date: 2026-04-12

## Context

Numio connects to customer AWS accounts to read Cost and Usage Reports (CUR) from S3. The current implementation was built on incorrect design assumptions and has never worked end-to-end — no tester has successfully added an AWS account through the UI. The design document [aws-integration-design.md](../../docs/design/aws-integration-design.md) and working prototype [aws-connectivity-example.py](../../docs/examples/aws-connectivity-example.py) describe the correct connectivity model. This task replaces the broken implementation with one that follows the design doc.

## Problem

Three failures in the current implementation:

**P1: Connectivity model is wrong.** The backend assumes Numio has a pre-configured AWS identity (container IAM role or mounted `~/.aws`). The design doc specifies a dedicated `numio-service` IAM user with static access keys (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY) that are provided per account through the UI. The current code has no mechanism to accept, store, or use per-account credentials.

**P2: "Add Account" dialog is incomplete.** The dialog asks for role ARN and CUR config but not the credentials Numio needs to connect. Users must configure credentials externally (env vars, `.aws` mount) — a separate step that the UI never explains. The dialog is not self-contained.

**P3: Error reporting is useless.** Testers reported that validation failures produce generic messages ("connectivity check failed") with no diagnostic detail. The example script produces step-by-step pass/fail output with specific error codes and remediation hints. The UI shows none of this.

## Goals

G1: A user can add an AWS account entirely through the "Add Account" dialog — no external credential configuration required.

G2: Each account stores its own AWS credentials (access key ID + secret access key), role ARN, external ID, and optional CUR config. All fields are editable after creation.

G3: Validation follows the flow in the example script: verify credentials (STS GetCallerIdentity) -> AssumeRole -> S3 ListObjects -> S3 HeadObject (when CUR config is provided). Each step reports pass/fail with a specific error message and remediation hint.

G4: CUR configuration (bucket, prefix, report name) is optional at account creation. Users can add or edit CUR config later and re-validate.

G5: The UI displays validation results as a step-by-step checklist with clear pass/fail/skip status, error details, and remediation text for each step.

## Non-goals

- Encrypting credentials at rest (separate backlog task — plaintext in DB is acceptable during development).
- Session token support for SSO temporary credentials (permanent keys only for now).
- Cost Explorer validation (out of scope).
- Multi-workspace support (single workspace assumed).
- CUR data ingestion or parsing (this task covers connectivity and validation only).
- Moving credentials to workspace level (current scope: per-account storage; workspace-level deduplication is a future optimization).

## Constraints and Assumptions

- PostgreSQL is the only secret store. Credentials are stored as plaintext columns. This is acceptable for development; a follow-up task will add encryption.
- The existing `external_id` field on the workspace model remains. Per-account external ID is a new field on the account record, entered by the user in the dialog (the customer sets this value in their trust policy, so Numio must accept it as input).
- The working prototype (`aws-connectivity-example.py`) is the reference for the correct boto3 call sequence.
- Backend validation must produce structured results (not just a boolean) so the frontend can render step-by-step feedback.
- All existing API consumers (if any) will break — this is acceptable since the current API never worked.

## Requirements

### Data Model

R1: Add columns to `aws_accounts` table:
- `aws_access_key_id` (String, nullable) — Numio service user access key for this account
- `aws_secret_access_key` (String, nullable) — Numio service user secret key for this account
- `external_id` (String, nullable) — ExternalId for STS AssumeRole (entered by user, from their trust policy)

R2: Columns `cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name` remain nullable. Remove any backend enforcement that makes them required at registration time.

R3: Create an Alembic migration for the schema change.

### Backend API

R4: `POST /api/v1/accounts` — register a new account. Required fields: `aws_account_id`, `role_arn`, `aws_access_key_id`, `aws_secret_access_key`, `external_id`. Optional fields: `alias`, `environment_label`, `cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name`. On success, run validation and return the account with step-by-step validation results.

R5: `PUT /api/v1/accounts/{id}` — update any account field (including credentials and CUR config). Re-run validation after update. Return updated account with validation results.

R6: `POST /api/v1/accounts/{id}/validate` — re-run validation for an existing account without changing any fields. Return validation results.

R7: Validation response structure (returned by R4, R5, R6):
```
{
  "account": { ... },
  "validation": {
    "steps": [
      {
        "name": "verify_credentials",
        "label": "Verify AWS credentials",
        "status": "pass" | "fail" | "skip",
        "detail": "Authenticated as arn:aws:iam::123:user/numio-service",
        "error": null | "InvalidClientTokenId: The security token ...",
        "remediation": null | "Check that the Access Key ID and Secret match an active key on the numio-service IAM user."
      },
      {
        "name": "assume_role",
        "label": "Assume customer role",
        "status": "pass" | "fail" | "skip",
        ...
      },
      {
        "name": "s3_list",
        "label": "List CUR objects in S3",
        "status": "pass" | "fail" | "skip",
        ...
      },
      {
        "name": "s3_read",
        "label": "Read CUR file from S3",
        "status": "pass" | "fail" | "skip",
        ...
      }
    ],
    "overall_status": "pass" | "partial" | "fail"
  }
}
```
- `skip`: step was not executed because a prerequisite step failed or required input (CUR config) was not provided.
- `partial`: credentials and AssumeRole passed, but CUR checks failed or were skipped.
- Steps execute sequentially; if a step fails, subsequent steps are skipped.

R8: Validation step logic (mirrors the example script):
1. **verify_credentials**: Create boto3 session with account's `aws_access_key_id` + `aws_secret_access_key`. Call `sts.get_caller_identity()`. On success, report the caller ARN. On failure, report the boto3 error code and message.
2. **assume_role**: Call `sts.assume_role(RoleArn=role_arn, ExternalId=external_id, RoleSessionName="numio-validation", DurationSeconds=900)`. On success, report the assumed role ARN. On failure, report error code + specific remediation (wrong ARN, ExternalId mismatch, missing permission).
3. **s3_list** (skip if CUR config not provided): Using assumed-role credentials, call `s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=5)`. Report object count. On failure, report the S3 error.
4. **s3_read** (skip if s3_list found no objects): Call `s3.head_object()` on the first listed object. Report file size and content type. On failure, report the S3 error.

R9: Account status is derived from validation:
- All steps pass -> `active`
- Credentials + AssumeRole pass, CUR steps fail or skip -> `warning`
- Any of credentials or AssumeRole fails -> `error`
- Soft-deleted -> `inactive`

R10: All validation errors must be logged at INFO level with the full boto3 error response (error code, message, request ID). Do not swallow exceptions silently.

### Frontend — "Add Account" Dialog

R11: The dialog contains all fields needed to connect an account:
- AWS Access Key ID (text input, required)
- AWS Secret Access Key (password input, required)
- AWS Account ID (text input, 12 digits, required)
- Role ARN (text input, required)
- External ID (text input, required)
- Display Name (text input, optional)
- Environment (dropdown: production/staging/development, optional)
- CUR Configuration (collapsible section, all optional):
  - S3 Bucket
  - S3 Prefix
  - CUR Report Name

R12: On submit, the dialog displays validation results as a step-by-step checklist. Each step shows: label, pass/fail/skip icon, detail text, and remediation text (when failed). The dialog remains open so the user can see results and fix issues.

R13: On successful validation (overall status `pass` or `partial`), the dialog shows a success state and a "Close" button. The account list refreshes.

R14: On failed validation, the dialog keeps the form editable so the user can correct inputs and retry without re-entering everything.

### Frontend — Edit Account

R15: Each account in the list has an "Edit" action that opens a dialog (same layout as Add) pre-filled with current values. Secret access key is masked but editable. Save triggers re-validation and displays results.

R16: Each account has a "Re-validate" action that triggers `POST /accounts/{id}/validate` and displays the step-by-step results.

### Cleanup

R17: Remove the `get_numio_principal_arn()` function and the `NUMIO_PRINCIPAL_ARN` config. The IAM Setup Guide and workspace info endpoint that depend on this value should be updated or simplified — Numio no longer auto-discovers its identity since credentials are provided per-account.

R18: Remove the `~/.aws` volume mount from `docker-compose.yml` backend and worker services. Numio no longer reads host AWS credentials.

## Acceptance Criteria

AC1: A user opens the Numio UI, navigates to Settings > Integrations, clicks "Add Account", fills in credentials + role ARN + external ID, and sees a step-by-step validation result — without any prior host-level AWS configuration.

AC2: Adding an account with valid credentials and role ARN but no CUR config results in status `warning` with steps 1-2 passing and steps 3-4 skipped.

AC3: Adding an account with invalid credentials shows step 1 as failed with the specific AWS error message (e.g., "InvalidClientTokenId") and remediation text. Steps 2-4 are skipped.

AC4: Adding an account with valid credentials but wrong role ARN shows step 1 pass, step 2 fail with specific error (e.g., "AccessDenied — the trust policy Principal does not match the caller ARN, or ExternalId does not match"), steps 3-4 skipped.

AC5: After adding an account with no CUR config, the user can edit the account, add CUR config, save, and see S3 validation steps execute.

AC6: All validation errors are logged server-side at INFO level with boto3 error code, message, and request ID.

AC7: The `aws-connectivity-example.py` prototype passes all checks against the test AWS account. The Numio UI produces equivalent results for the same account.

## Validation Steps

1. Start Numio from clean state (no prior AWS config on host).
2. Navigate to Settings > Integrations > Add Account.
3. Enter valid numio-service credentials, role ARN, external ID (no CUR config).
4. Verify: steps 1-2 pass, steps 3-4 skip, account created with status `warning`.
5. Edit the account, add CUR config (bucket, prefix, report name).
6. Verify: all 4 steps pass, account status changes to `active`.
7. Create a second account with intentionally wrong credentials.
8. Verify: step 1 fails with specific error, steps 2-4 skip, account is NOT created.
9. Check backend logs — confirm validation errors include AWS error codes and request IDs.

## Risks and Rollback

| Risk | Mitigation |
|------|------------|
| Credentials stored in plaintext could leak via DB dump or SQL injection | Acceptable for development. Separate backlog task for encryption. Ensure credentials are never returned in API list/get responses (redact to last 4 chars). |
| Breaking existing accounts table | Alembic migration adds nullable columns — existing rows unaffected. No data loss. |
| boto3 call failures in CI (no real AWS) | Unit tests mock boto3 calls. Integration test against real AWS is manual (validation step 7 above). |
