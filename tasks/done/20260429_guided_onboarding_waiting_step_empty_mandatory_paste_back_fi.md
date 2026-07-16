---
status: done
kind: bug
feature: bugfix_setup_wizard
title: Guided onboarding Waiting step — empty mandatory paste-back fields render with read-only styling
---

# Guided onboarding Waiting step — empty mandatory paste-back fields render with read-only styling

## Problem statement

On the **Waiting** step of the AWS onboarding Guided CloudFormation wizard
(`frontend/src/components/onboarding/GuidedOnboarding.jsx`, the `step === "waiting"` branch),
three mandatory paste-back fields render on a grey background that visually matches
read-only or non-mandatory inputs. The convention elsewhere in the app reserves the
grey background for read-only or optional fields, so users perceive these required
fields as not requiring input — yet the wizard cannot advance until they are filled.

Affected fields (all marked with the red asterisk indicating mandatory):

- `AwsAccountId *` (`data-testid="guided-field-account-id"`)
- `RoleArn *` (`data-testid="guided-field-role-arn"`)
- `AccessKeyId *` (`data-testid="guided-field-access-key"`)

Expected: these mandatory empty fields render with the editable-input background
used elsewhere for required text inputs awaiting user input.

## Scope

In scope:

- The three fields listed above on the **Waiting** step only.
- The fix applies when the field has no value (the default state on first entry to
  the step). Visual treatment after the user types a value is not changed by this
  task unless the existing styling already differs.

Out of scope:

- `ExternalId *` — its value is prepopulated correctly from earlier wizard state,
  so the read-only-looking grey background is acceptable and is intentionally not
  changed by this fix.
- `SecretAccessKey *` — already renders with the correct background (it is a
  `type="password"` input), no change needed.
- The **Verify** step's copy of the same five fields. By design, once the user
  submits Waiting the values are not re-entered there: validation failures send
  the user back to Waiting to correct values. Verify-step styling is therefore
  out of scope for this ticket.
- Any change to validation logic, field order, labels, help text, or the
  `missingPasteBackFields()` error-handling path.

## Acceptance criteria

- On entering the Waiting step with empty paste-back fields, the three inputs
  `guided-field-account-id`, `guided-field-role-arn`, and `guided-field-access-key`
  render with the standard editable-input background used by other mandatory text
  inputs in the wizard (e.g. the Customize step's `guided-field-label`).
- `guided-field-external-id` and `guided-field-secret` render unchanged.
- The red asterisk and `aria-invalid` behaviour on the three affected fields is
  unchanged.
- The existing Vitest suite for `GuidedOnboarding` continues to pass; if a test
  asserts on the grey background of the affected fields, it is updated to reflect
  the new expected styling and a brief note explains why.

## Quality gates

- `cd frontend && npm test -- GuidedOnboarding` passes.
- `cd frontend && npm run build` succeeds.
- Manual verification in a running dev stack:
  1. `./scripts/numio-dev.sh run all` then open the frontend.
  2. Navigate Settings → Integrations → Add Account → Guided CloudFormation.
  3. Walk through Intro → Customize → Apply → Waiting.
  4. Confirm `AwsAccountId`, `RoleArn`, `AccessKeyId` render with the
     editable-input background; `ExternalId` and `SecretAccessKey` are unchanged.

## Constraints and assumptions

- Assumes the grey background comes from the shared `formInput` / `formInput--small`
  CSS class or a wrapper rule, not from an inline style on the Waiting step. The
  fix should prefer the smallest scoped change that aligns the three fields with
  the rest of the wizard's mandatory inputs without regressing other usages of
  `formInput--small`.
- No backend changes expected.

## Summary

### Steps completed

1. Diagnosed root cause: `.formInput` (`frontend/src/styles.css:1436`) declares no
   `background`, so empty text inputs inherit the browser default. In the Waiting
   step those inputs sit inside a panel coloured `var(--bg-inset)` (`#f3f4f6` —
   the exact colour `.formInput--disabled` uses), making empty mandatory fields
   read as disabled. `SecretAccessKey` (`type="password"`) gets a different UA
   default and already reads correctly; `ExternalId` is prepopulated by the
   parent `Integrations.jsx` so it reads as "filled" regardless.
2. Applied the narrowest possible fix: inline `style={{ background: "var(--bg)" }}`
   on the three affected inputs in the Waiting step only. No changes to shared
   CSS, no changes to the Verify step, `ExternalId`, or `SecretAccessKey`.
3. Added a regression test asserting the three affected inputs carry the inline
   override and the two out-of-scope inputs (`external-id`, `secret`) do not.
4. Ran quality gates: `npm test -- GuidedOnboarding` (31/31 pass) and
   `npm run build` (success).
5. User performed manual verification in the running dev stack and confirmed the
   fix renders correctly for `AwsAccountId`, `RoleArn`, `AccessKeyId`. A briefly
   reported anomaly with `ExternalId` showing the placeholder turned out to be a
   stale-state artefact in the open browser session — a page refresh restored
   the prepopulated value, confirming no regression from this change.

### Changes made

- `frontend/src/components/onboarding/GuidedOnboarding.jsx` — added
  `style={{ background: "var(--bg)" }}` to the three Waiting-step inputs
  (`guided-field-account-id`, `guided-field-role-arn`,
  `guided-field-access-key`). 3 lines added.
- `frontend/src/components/onboarding/GuidedOnboarding.test.jsx` — added one
  regression test (`Waiting step paste-back inputs render with editable
  (non-inset) background on the three empty mandatory fields`) verifying the
  override is present on the three affected inputs and absent on
  `guided-field-external-id` / `guided-field-secret`.

### Notable decisions or deviations

- Chose inline `style` over a global `.formInput { background: #fff }` rule.
  The global change would be the textbook root-cause fix and would bring
  `.formInput` in line with `.formSelect` (which already declares
  `background: #fff`), but it would also recolour every other `.formInput`
  instance app-wide — including `ExternalId` on this same step, which the task
  scope explicitly leaves unchanged. The inline-style fix matches the bug's
  exact scope without that side effect. If a follow-up task ever wants to
  unify the two, the right move is a CSS-only change in `styles.css` plus a
  cleanup of these three inline styles.

### Links

- Feature: `tasks/features/20260427_bugfix_setup_wizard.md`
- No PR yet — change is on branch `dev`, not pushed.
