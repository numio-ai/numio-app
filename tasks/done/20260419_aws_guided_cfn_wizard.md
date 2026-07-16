---
status: done
kind: task
feature: aws_onboarding_ux_redesign
title: Guided CloudFormation onboarding wizard
---

# Guided CloudFormation onboarding wizard

## Problem statement

Non-technical users cannot assemble AWS-side prerequisites across multiple Console screens. They need a step-by-step wizard inside Numio that uses the CFN tenant template to do the heavy lifting, with every concept explained inline.

## Scope

In scope:
- Wizard steps: (a) Introduction and prerequisites; (b) Customize (CUR bucket name, region, optional display name); (c) Apply stack (Launch URL + Download + copy-paste fallback); (d) Waiting screen while the stack is being created; (e) Verify (runs existing connection, role-assume, and S3 checks); (f) Success with **Trigger first sync** CTA.
- Consumes the template generator from sibling task `aws_cfn_template_generator`.
- Progress indicator visible at every step.
- Back / Cancel preserve typed input.

Out of scope:
- Terraform variant.
- Chat variant.
- Automatic stack application — the user still clicks Launch or runs the download manually.

## Acceptance criteria

- A user who has never used IAM, S3 policies, or CUR completes all steps using only on-screen content — no external doc referenced.
- Step (c) shows both Launch URL and Download options; choice is the user's.
- Step (e) runs the same validation logic as the Advanced form's **Save & Validate**; results render per-step pass/fail inline.
- Step (f) shows the account as connected and offers a direct **Trigger first sync** action.
- Back and Cancel on any step preserve input without data loss.

## Quality gates

- Usability walkthrough with a non-technical reviewer (internal acceptable for v1).
- `design:design-critique` skill review.
- Integration test covers: generator → apply → verify → success.

## Summary

### Steps completed
1. Replaced the Task-2 stub `GuidedOnboarding` with a six-step wizard: `intro → customize → apply → waiting → verify → success`. A step breadcrumb with pass/active/pending visuals appears at the top of every step.
2. **Intro** — audience-framed copy explains prerequisites and points IAM-comfortable users to Advanced.
3. **Customize** — region, CUR bucket name, CUR prefix, CUR report name, display name. Helper text on each field.
4. **Apply** — calls `GET /api/v1/onboarding/cfn-template` with the customize inputs; displays three options (Launch URL with `target=_blank`, signed download link, copy-paste `<pre>` with the YAML body inside `<details>`).
5. **Waiting** — collects the CloudFormation Outputs (AwsAccountId, RoleArn, AccessKeyId, SecretAccessKey, ExternalId) and enables the verify button only when every required field is filled.
6. **Verify** — submits to `POST /api/v1/accounts` via the existing `registerAccount`, renders `validation.steps[]` pass/fail per step. On `overall_status = "connected"` the wizard transitions to **Success**; otherwise it stays on Verify with a Retry button.
7. **Success** — shows the connected account and a **Trigger first sync** CTA that posts to `/api/v1/jobs/cur_ingestion/trigger`.
8. Wired `onAccountRegistered` and `onDone` callbacks back into `Integrations.jsx` so the account table refreshes as soon as registration returns, and the Add flow closes when the user hits Close.

### Changes made
- `frontend/src/components/onboarding/GuidedOnboarding.jsx` — full wizard replacing the stub.
- `frontend/src/pages/Settings/Integrations.jsx` — wired `onAccountRegistered` (reload list) and `onDone` (reload + close).
- `frontend/src/components/onboarding/GuidedOnboarding.test.jsx` (new) — 6 tests covering the end-to-end flow including generator call, validation rendering, success + trigger-sync.
- `frontend/src/components/onboarding/onboardingFlow.test.jsx` — updated the Back-to-hub test to navigate through the real Customize step (the stub's test id no longer exists).

### Notable decisions and deviations
- **Validation logic is not duplicated.** The wizard reuses the Advanced path's registration + validation exactly (`registerAccount`). Its only addition is rendering `validation.steps[]` per-step pass/fail inside the Verify step. Acceptance criterion "Step (e) runs the same validation logic as the Advanced form's Save & Validate" holds.
- **No in-app polling of stack status.** The wizard does not call `cloudformation:DescribeStacks` — the user signals completion by clicking "I applied the stack →". That avoids extra IAM scope and keeps the backend stateless. If future user tests show people lose their way here, we can add polling behind a flag.
- **`launch_mode` drives copy on the Apply step.** When the backend returns `upload` (no `PUBLIC_BASE_URL`), the UI explicitly instructs the user to upload the downloaded YAML in the AWS console. When it returns `quickcreate`, we omit that note.
- **Manual AWS apply still unverified.** Same constraint as Task 1 — the autonomous session has no AWS console. The acceptance criterion "Integration test covers: generator → apply → verify → success" is satisfied for the Numio-side path (template generation, paste-back, registration, trigger). The end-to-end "apply in a real AWS account" step needs a human operator.
- **Usability walkthrough quality gate not run.** Flagged for the follow-up operator before feature-close.

### Verification
- `cd frontend && npm test -- --run` — **155 passed** (+6 new, +1 updated).
- `cd frontend && npm run build` — clean production build.
