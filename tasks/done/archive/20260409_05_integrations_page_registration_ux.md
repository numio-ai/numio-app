---
status: done
kind: task
---

# T5: Integrations Page — Registration and Validation UX

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)
Depends on: T3

## Problem

The Integrations page (`Settings/Integrations.jsx`) cannot register AWS accounts:
- Form sends `name` but API requires `alias` (422 on every submission).
- CUR S3 fields are not in the form (required for cost data).
- Validation results are not displayed (backend validates but frontend ignores results).
- No edit or re-validate capability.
- No ExternalId display for customers setting up their trust policy.
- Error status on accounts shows no detail (status_message hidden).

## Goals

1. Fix form field name mapping (`name` → `alias`).
2. Add required CUR S3 fields (bucket, prefix, report name) to the registration form.
3. Add client-side validation for all fields per R1.3.
4. Display validation results inline after submission (per-check pass/fail/warning with remediation hints).
5. Show loading state during backend validation. Keep form open on failure.
6. Display workspace ExternalId (copyable) from `GET /workspace/info`.
7. Add link to IAM Setup Guide (T6) from the Integrations page.
8. Account table: show `status_message` on error/warning rows (hover or expand).
9. Edit flow: inline or modal form for Display Name, Environment, CUR fields. Save triggers re-validation gate.
10. Re-validate button per account row.
11. API client: add `getWorkspaceInfo()` and `revalidateAccount()` functions.

## Non-goals

- IAM Setup Guide content (that's T6)
- Empty state CTAs on other pages (that's T7)
- Visual design system changes (use existing design tokens and component patterns)

## Constraints & Assumptions

- Backend APIs from T3 are deployed and available.
- The existing Integrations component structure (single file) can be refactored into sub-components if needed for maintainability.
- ExternalId and principal ARN come from `GET /api/v1/workspace/info` (T1).
- The inline note for organizations ("register the management/payer account") is static text.

## Acceptance Criteria

1. Registration form submits successfully with all 7 required fields. Account appears in table with "active" status.
2. Submitting with an invalid Role ARN or inaccessible S3 bucket shows per-check validation results inline. Form stays open.
3. CUR S3 fields are required. Client-side validation prevents submission with empty CUR fields.
4. Loading spinner shown during validation.
5. Workspace ExternalId displayed above the accounts table (copyable).
6. Link to IAM Setup Guide visible on the Integrations page.
7. Account rows with error/warning status show the status_message detail.
8. Edit form allows changing Display Name, Environment, and CUR fields. Save triggers re-validation. Rejected on failure.
9. Re-validate button on each account row triggers re-validation and updates status.
10. API client has `getWorkspaceInfo()` and `revalidateAccount()` functions.

## Validation Steps

1. Navigate to Settings → Integrations. ExternalId is displayed.
2. Click "Add Account" → form shows all 7 fields.
3. Submit with valid data → loading → success → account in table.
4. Submit with bad role ARN → loading → error details inline → form stays open.
5. Edit an account's CUR bucket to an invalid value → save rejected with error.
6. Click Re-validate on an active account → status confirmed.
7. Error account row shows status_message on hover/click.

## Risks & Rollback

- This is the largest task. Consider splitting into sub-PRs (form fix + validation, then edit + re-validate) if needed.
- Frontend changes are isolated to the Integrations component and API client. Rollback: revert the files.
