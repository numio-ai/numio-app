---
status: done
kind: bug
feature: bugfix_setup_wizard
title: Guided onboarding Verify step has no visible progress feedback
---

# Guided onboarding Verify step has no visible progress feedback

## Problem statement

When the user completes Apply, returns from the AWS Console with stack outputs, and clicks "Verify connection →" on the Waiting step, the Guided wizard transitions to Verify but presents no perceivable feedback. The user clicks the button repeatedly because the UI gives no signal that anything is happening. The Advanced (manual) form already solves this with inline per-step pass/fail rows in the same form view; Guided's Verify must look and feel the same.

Source files involved (verified during triage):

- `frontend/src/components/onboarding/GuidedOnboarding.jsx` — the Verify step renders "Running connection, role-assume, and S3 checks…" while in flight, but the transition itself is the only visible change and the small text is not strong enough.
- `frontend/src/pages/Settings/Integrations.jsx` — the Advanced form's `AccountFormDialog` is the gold-standard validation UX.

## Scope

In:

- Replace or augment the Guided wizard's Verify step rendering so its loading state, per-step row layout, icon set, and color treatment match the Advanced form's `AccountFormDialog` validation rendering. Reuse the same component or its render path where possible.
- The "Verify connection →" click on the Waiting step (and the in-step "Retry") must produce immediate visible feedback within 100 ms: button enters a clear loading state, paste-back fields lock.
- During validation, four pending rows ("Verify AWS credentials", "Assume customer role", "List CUR objects in S3", "Read CUR object from S3") render and update their status as each step completes.
- On failure, the user can edit paste-back fields and retry without re-pasting all values.

Out:

- Backend validation logic — already shared via `POST /api/v1/accounts`.
- Changes to the Advanced form's behavior.
- Skin / brand restyling beyond aligning with Advanced.

## Acceptance criteria

1. Click on "Verify connection →" produces a visible loading state within 100 ms — button label/state change is visible to the user.
2. Four step rows render during validation, updating live as each AWS check completes (pending → pass / fail / skip).
3. Visual layout, icons, and colors of the validation result match the Advanced form's render of the same response payload.
4. After a failure, the user can edit paste-back fields and re-click validate; the prior result rows clear and the new run renders fresh.
5. The wizard does not advance to Success unless `validation.overall_status === "connected"`.
6. Manual (with auth bypass): drive the wizard through to Verify, observe loading state, confirm visual parity with Advanced.

## Quality gates

- `cd frontend && npm test` — full suite passes; new tests cover the loading state and per-step row rendering of the Verify step.
- Visual side-by-side comparison with Advanced form on the same browser at the same zoom level.
- `docs/app/settings/integrations/aws-integration-spec.md` updated if the description of the Verify step's UX needs realignment.

## Constraints and assumptions

- The four-step ValidationSteps payload comes from `aws_service.validate_account` and is already what the Advanced form renders. Reuse the rendering component if possible.
- Auth bypass is on in local dev; admin role implicit.
