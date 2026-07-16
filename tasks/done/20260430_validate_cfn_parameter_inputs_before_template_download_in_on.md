---
status: done
kind: bug
feature: bugfixes
title: Validate CFN parameter inputs before template download in onboarding wizard
---

# Validate CFN parameter inputs before template download in onboarding wizard

## Problem statement

The onboarding wizard lets users enter free-text values for the CUR S3 fields and immediately builds a CloudFormation template with them. If a value violates the `AllowedPattern` constraint defined in the template, CloudFormation rejects the stack at deploy time with a cryptic parameter validation error — not at the point where the user typed the value.

Reported example: `CurBucketName` value `" numio-cost-info"` (leading space) fails CloudFormation's `AllowedPattern: ^$|^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$`.

The fix is to validate each CUR field in the frontend against the same regex the template enforces, and block the "Next" action / show an inline error before the template is generated.

## Authoritative patterns

Sourced from `backend/src/numio/onboarding/cfn_template.py` lines 70–97:

| Field | Form key | CFN parameter | AllowedPattern |
|-------|----------|---------------|----------------|
| S3 Bucket | `curBucketName` | `CurBucketName` | `^$\|^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$` |
| S3 Prefix | `curPathPrefix` | `CurPathPrefix` | `^[A-Za-z0-9._/-]{0,512}$` |
| Report Name | `curReportName` | `CurReportName` | `^[A-Za-z0-9_-]{0,128}$` |

`WorkspaceExternalId` is auto-filled and not user-editable — exclude from scope.

## Scope

**In scope:**
- Add client-side validation of `curBucketName`, `curPathPrefix`, and `curReportName` in `frontend/src/components/onboarding/GuidedOnboarding.jsx`, on the CUR configuration step.
- Show an inline error message below each field that fails its pattern, matching the visual style of existing helper text (small grey/red text below the input).
- Disable the "Next" button on the CUR step while any field has a validation error.
- Same validation in `frontend/src/pages/Settings/Integrations.jsx` for the equivalent fields (`cur_s3_bucket`, `cur_s3_prefix`, `cur_report_name`) in the add/edit account dialog — disable submit or show inline errors there too.

**Out of scope:**
- Changes to backend patterns or the CFN template itself.
- Server-side validation (already present implicitly via CloudFormation; this task adds the client-side guard).
- `WorkspaceExternalId` — auto-filled, not user-editable.

## Implementation notes

Define the patterns as constants co-located with the validation logic (not inline in JSX) so they are easy to keep in sync with the backend. Suggested location: a small `cfnValidation.js` utility in `frontend/src/components/onboarding/` or `frontend/src/utils/`.

Validation should trigger on blur (not on every keystroke) to avoid showing errors while the user is still typing. An error that appeared on blur should clear as soon as the field becomes valid again (on change).

Suggested error messages (user-friendly, not the raw regex):

- **S3 Bucket**: *"Must be 3–63 lowercase letters, numbers, dots, or hyphens, and cannot start or end with a hyphen or dot. Leave blank if you have not set up a CUR bucket."*
- **S3 Prefix**: *"Only letters, numbers, dots, underscores, hyphens, and forward slashes are allowed."*
- **Report Name**: *"Only letters, numbers, underscores, and hyphens are allowed."*

## Acceptance criteria

- AC1: In the guided onboarding wizard, entering an invalid bucket name (e.g. one with a leading space, or uppercase letters) and tabbing out shows an inline error and disables the "Next" button.
- AC2: Fixing the value clears the error and re-enables "Next".
- AC3: A blank bucket name is accepted (the pattern allows empty — CUR is optional).
- AC4: The same inline errors appear in the add/edit account dialog at `/settings?tab=integrations` for `cur_s3_bucket`, `cur_s3_prefix`, and `cur_report_name`.
- AC5: Valid values for all three fields produce no errors.
- AC6: `cd frontend && npm run build` passes with no errors.
- AC7: Existing tests pass: `cd frontend && npm test`.

## Quality gates

- Manual test in browser: enter `" My Bucket"` in the S3 Bucket field, tab out — error appears, Next is disabled. Fix the value — error clears, Next re-enables.
- Manual test: leave bucket blank, fill prefix and report name with valid values — no errors (blank bucket is valid).
- `cd frontend && npm run build` — no errors.
- `cd frontend && npm test` — no regressions.

## Summary

### Steps completed

1. Added a small validation utility co-locating the three CFN AllowedPattern regexes with friendly error copy.
2. Wired blur-triggered validation, change-driven error clearing, `aria-invalid`, and inline error rendering into the Guided onboarding wizard's three CUR fields; disabled the Customize "Next" button while any field is invalid.
3. Wired the same pattern into the Settings → Integrations Add/Edit Account dialog by tagging the three CUR fields with a `cfnKind` and threading per-field error state through the shared `renderField`; disabled the form submit button while any field is invalid.
4. Verified end-to-end in a browser against the running dev stack: invalid bucket value (`BAD VAL`) shows inline error and disables Next; correcting to a valid value clears the error mid-typing; blank bucket is accepted with no error.

### Changes made

- `frontend/src/components/onboarding/cfnValidation.js` — new. Exports `CFN_FIELD_KINDS` and `validateCfnField(kind, value)`. Patterns mirror `backend/src/numio/onboarding/cfn_template.py` for `CurBucketName`, `CurPathPrefix`, `CurReportName`.
- `frontend/src/components/onboarding/cfnValidation.test.js` — new. 14 unit tests covering accept/reject cases for each kind.
- `frontend/src/components/onboarding/GuidedOnboarding.jsx` — added `CUR_FIELD_KINDS` map, `cfnFieldErrors` state, `handleCfnBlur`, `cfnFieldsValid` predicate, and inline error rows / `aria-invalid` on the three CUR inputs.
- `frontend/src/pages/Settings/Integrations.jsx` — added `cfnFieldErrors` state and per-field `cfnKind` tags inside `AccountFormDialog`; reworked `renderField` to render either the CFN error or the existing embedded-space warning; submit button disabled when invalid.

### Notable decisions or deviations

- Validation kinds (`bucket` / `prefix` / `report`) live in the utility, with the field-name → kind mapping kept inside each consumer. This avoids hard-coding either the camelCase wizard names or the snake_case account-form names into the utility.
- `handleCfnBlur` reads the value from the DOM event (`e.target.value`) rather than the closed-over `form` state, because a change event firing immediately before blur may not have committed yet — closure would otherwise validate the prior value.
- The existing `EmbeddedSpaceWarning` / space-warning copy is preserved as a fallback when no CFN error is displayed, so the two messages do not stack.

### Quality gates

- `cd frontend && npm test` — 24 files, 210 tests, all green (includes the 14 new tests).
- `cd frontend && npm run build` — clean.
- Manual browser smoke test against the running dev stack — covers AC1, AC2, AC3.
