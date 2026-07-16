---
status: done
kind: task
---

# T8: Documentation Fixes

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)
Depends on: T3

## Problem

`docs/user-guide.md` has stale and incorrect information:
- API path: references `/api/accounts` instead of `/api/v1/accounts`.
- Field name: uses `name` instead of `alias` in the API example.
- Permission list: incomplete (missing S3 permissions for CUR access).
- Navigation: references "Accounts page" instead of "Settings → Integrations."

## Goals

1. Correct the API path to `/api/v1/accounts`.
2. Update the API example to use `alias` and include all required fields (including CUR S3 location).
3. Update the permission list to match what the backend validates: `cur:DescribeReportDefinitions`, `s3:GetObject`, `s3:ListBucket`.
4. Update navigation reference to "Settings → Integrations."
5. Add a note about AWS Organizations (management account CUR covers all members).

## Non-goals

- Writing the IAM Setup Guide (that's T6 — in-app content)
- Rewriting the full user guide

## Constraints & Assumptions

- The user guide is a short document (~40 lines). Changes are straightforward text edits.
- The permission list must stay aligned with the validation service (T2). If T2 changes the checks, this doc must be updated.

## Acceptance Criteria

1. `docs/user-guide.md` references `/api/v1/accounts` (not `/api/accounts`).
2. API example uses `alias` (not `name`) and includes `cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name`.
3. Permission list matches the validation checks: `cur:DescribeReportDefinitions`, `s3:GetObject`, `s3:ListBucket`.
4. UI navigation says "Settings → Integrations" (not "Accounts page").
5. Note about AWS Organizations management account is present.

## Validation Steps

1. Read `docs/user-guide.md` — all acceptance criteria are met.
2. Run the API example in the doc against the running backend — it succeeds (with valid AWS credentials).

## Risks & Rollback

- No risk. Text-only changes. Rollback: revert the file.
