---
status: done
kind: bug
feature: bugfix_setup_wizard
title: Cancel onboarding modal hangs on slow DELETE; resume restores stale step
---

# Cancel onboarding modal hangs on slow DELETE; resume restores stale step

## Problem statement

When the user clicks **Cancel onboarding** in the Guided CloudFormation wizard's confirmation modal (after acknowledging "I have deleted the CFN stack in AWS Console"), two defects compound:

1. `handleCancelConfirm` in `frontend/src/components/onboarding/GuidedOnboarding.jsx` awaits `deleteOnboardingInProgress()` before closing the modal and calling `onBack()`. With no fetch timeout (`frontend/src/api/onboarding.js`), any backend slowness, queueing behind an in-flight Verify validation, or backend hang leaves the modal stuck on `Cancelling…`.
2. After a confirmed cancel, `backToHub` in `frontend/src/pages/Settings/Integrations.jsx` does not clear `guidedInitialStep`. The server record is gone, but `guidedInitialStep` still holds the old step. Re-entering Guided in the same session re-mounts the wizard at a step whose backing record no longer exists, with `persistedRef=true` — the user is back in a wizard pointing at nothing.

## Scope

In:

- `deleteOnboardingInProgress` in `frontend/src/api/onboarding.js`: bound the call with an AbortController-driven timeout (10s) so it cannot hang.
- `handleCancelConfirm` in `GuidedOnboarding.jsx`: keep the await, but on failure surface the error in the modal instead of swallowing. Modal stays open. Clicking **Cancel onboarding** again retries the DELETE. **Keep onboarding** clears the error and dismisses the modal. On success, modal closes and `onBack()` is called.
- `backToHub` in `Integrations.jsx`: clear `guidedInitialStep` and reset `guidedForm` to the same defaults `closeAdd` uses, so a re-entry after cancel starts fresh at intro.
- Tests in `GuidedOnboarding.test.jsx`: existing pass; add coverage for (a) DELETE failure renders an error and keeps the modal open, (b) Keep onboarding clears the error.

Out:

- A separate "Force close" affordance — the existing **Keep onboarding** button is enough; the user can retry, dismiss, or close the tab. Tab close + auto-restore on next visit is the documented escape hatch.
- Refactoring `backToHub` / `closeAdd` into a single helper.
- Any backend changes — DELETE endpoint is already idempotent and fast.

## Acceptance criteria

1. With a healthy backend, clicking the red **Cancel onboarding** button closes the modal and returns the user to the method hub in well under one second.
2. After confirmed cancel, opening **Add Account → Guided** again starts the wizard at the intro step with empty form fields, not at the previously persisted step.
3. With a slow / hung / failing backend, the DELETE call aborts after 10s. The modal stays open. An error message tells the user the cancel didn't land and to retry. No silent UI/DB drift.
4. Clicking **Cancel onboarding** while an error is shown re-runs the DELETE. On success, modal closes and `onBack()` is called.
5. **Keep onboarding** dismisses the modal and clears any error, without calling DELETE.
6. The existing intro-step "Back to methods" path is unchanged — no DELETE, just returns to hub.

## Quality gates

- `cd frontend && npm test -- GuidedOnboarding` — all existing cancel tests pass; new coverage for failure path (error rendered, modal stays open) and Keep-onboarding-clears-error passes.
- Manual: with backend paused (`kill -STOP <backend-pid>`), trigger Cancel from Apply step; after ~10s the modal shows a timeout error and stays open. Resume backend (`kill -CONT`); click Cancel again — modal closes within ~100ms. Verify DELETE landed (`SELECT * FROM onboarding_in_progress` is empty).

## Summary

### Steps completed

1. Identified two defects: (a) `handleCancelConfirm` awaited an unbounded `fetch` so a slow/hung backend stranded the modal on `Cancelling…` indefinitely; (b) `backToHub` did not clear `guidedInitialStep`, so a re-entry after confirmed cancel auto-restored the wizard at a step whose backing record had just been deleted.
2. Bounded `deleteOnboardingInProgress` with a 10s `AbortController` timeout in `frontend/src/api/onboarding.js`.
3. Replaced the silent `catch {}` in `handleCancelConfirm` with explicit error surfacing — the modal stays open and renders a danger-coloured message; clicking **Cancel onboarding** again retries the DELETE; **Keep onboarding** clears the error and dismisses.
4. Cleared `guidedInitialStep` inside `backToHub` (safe for the intro path, which never sets it).
5. Added two unit tests: failure path (modal stays open with error, retry succeeds) and Keep-onboarding-clears-error.
6. Manual end-to-end via Puppeteer: paused the actual uvicorn worker (PID found via `lsof -i :PORT`, parent process is the supervisor and doesn't serve requests), triggered Cancel, observed timeout error after ~10s; resumed worker, retried, modal closed and DB row gone; re-entered Guided and confirmed wizard restarts at intro.

### Changes made

- `frontend/src/api/onboarding.js` — `deleteOnboardingInProgress` now accepts `{ timeoutMs = 10000 }` and aborts the underlying fetch on timeout.
- `frontend/src/components/onboarding/GuidedOnboarding.jsx` — added `cancelError` state; `handleCancelConfirm` surfaces failures instead of swallowing; `handleCancelDismiss` clears the error; modal renders the error inline (`data-testid="guided-cancel-error"`).
- `frontend/src/pages/Settings/Integrations.jsx` — `backToHub` now clears `guidedInitialStep`.
- `frontend/src/components/onboarding/GuidedOnboarding.test.jsx` — added failure-path and dismiss-clears-error tests.

### Notable decisions or deviations

- Initial proposal was fire-and-forget on the DELETE, which the user correctly rejected: it would mask DB failures and leave orphaned records. Final design keeps the await but bounds it with a timeout and surfaces failures honestly.
- No separate "Force close" button. The existing **Keep onboarding** button + tab close + auto-restore on next visit is sufficient as the user-controlled escape hatch.
- No fetch-timeout helper added to the request layer — only the cancel call needs it. YAGNI.

### Links

- Branch: `dev` (committed locally; not yet pushed).
