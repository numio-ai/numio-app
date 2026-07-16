---
status: done
kind: task
---

# T3: Accounts API — Validation-Gated Registration and Management

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)
Depends on: T2

## Problem

The current `POST /accounts` endpoint always creates the account record, even when validation fails, then sets status to "error." This means:
- Error-status records clutter the database.
- The API returns 201 on failure, making it hard for the frontend to distinguish success from failure.
- `PUT /accounts` does not accept CUR fields and does not run validation.
- There is no re-validate endpoint for existing accounts.

## Goals

1. **Registration as gate:** `POST /accounts` runs validation first. Account is persisted only if validation succeeds or produces a warning. On failure, return 400 with per-check validation results (no record created).
2. **Edit with validation:** Extend `UpdateAccountRequest` to accept `cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name`. `PUT /accounts/{id}` runs validation before persisting changes. On failure, return 400 (changes not saved).
3. **Re-validate endpoint:** `POST /accounts/{id}/validate` runs all validation checks against an existing account, updates its status/status_message, and returns results.
4. **Response schema:** Registration and re-validate responses include both the account data and per-check validation results.

## Non-goals

- Changing the validation checks themselves (that's T2)
- Frontend consumption of the new responses (that's T5)
- Soft-delete behavior (unchanged)

## Constraints & Assumptions

- CUR columns already exist on `aws_accounts` table (nullable). Application-level enforcement (all-or-nothing for CUR fields) is sufficient.
- The `RegisterAccountRequest` schema already includes CUR fields as optional. They become required at the API handler level (reject if missing).
- The duplicate-check behavior (409) is unchanged.
- Admin role requirement for registration, edit, and delete is unchanged.

## Acceptance Criteria

1. `POST /accounts` with valid data and passing validation: returns 201 + account + validation results. Account exists in DB with status=active.
2. `POST /accounts` with valid data but failing validation: returns 400 + validation results. No account record in DB.
3. `POST /accounts` with valid data but warning (report name not found): returns 201 + account + validation results. Status=warning.
4. `PUT /accounts/{id}` accepts CUR fields. On validation pass: returns 200 + updated account. On failure: returns 400, account unchanged.
5. `PUT /accounts/{id}` triggers re-validation on any field change. Save only on success/warning.
6. `POST /accounts/{id}/validate` returns 200 + account + validation results. Updates status and status_message in DB.
7. All three endpoints include per-check validation details in the response body.
8. Tests cover: success, failure, warning, edit with CUR, re-validate.

## Validation Steps

1. Register an account with a valid role ARN → 201, account in DB, status=active.
2. Register with an invalid role ARN → 400, no account in DB.
3. Edit CUR fields on an existing account → 200 if validation passes.
4. Re-validate an account → status updated, validation results returned.
5. Existing tests for list, get, delete still pass.

## Risks & Rollback

- Breaking change to the POST /accounts contract (201-always → 400-on-failure). Frontend must be updated in sync (T5). During rollout, deploy backend first; the old frontend will see 400 errors on failed registrations instead of silent 201s — a better failure mode than the current silent success.
- Rollback: revert accounts.py and schemas.
