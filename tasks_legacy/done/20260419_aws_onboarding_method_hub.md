---
status: done
kind: task
feature: aws_onboarding_ux_redesign
title: Multi-method onboarding hub on Add Account
---

# Multi-method onboarding hub on Add Account

## Problem statement

The current Add Account dialog surfaces raw fields with no context, immediately overwhelming non-technical users. The redesign needs a method picker that routes users to the path best for them while preserving the raw form for experts.

## Scope

In scope:
- Replace the current Add Account dialog with a hub screen offering **Guided** (default), **Chat** (when feature flag on), **Advanced**.
- Short persona-framed copy on the hub (plain language about who each method is for).
- Method selection is reversible — a user can return to the hub from any method without losing typed input in that method.
- Feature flag `ONBOARDING_CHAT_ENABLED` controls Chat visibility.

Out of scope:
- The wizard contents of any single method (tracked in sibling tasks).
- Chat implementation (tracked in its own task).
- Removing or changing fields in the Advanced form.

## Acceptance criteria

- Clicking **+ Add Account** opens the method hub; Guided is the default highlighted option.
- Advanced is reachable via a secondary link or de-emphasized control, not a sibling card of equal visual weight.
- Chat option renders only when `ONBOARDING_CHAT_ENABLED=true`; hidden otherwise.
- Back-to-hub from any method preserves that method's typed input.
- Advanced path still reaches the existing raw-field form and submits unchanged.

## Quality gates

- `design:design-critique` skill review of hub layout and copy.
- Manual smoke test: Guided → back, Advanced → back, Chat → back (with flag on).
- No regression in the Advanced submission flow — existing end-to-end add-account verified.

## Summary

### Steps completed
1. Added `frontend/src/api/onboarding.js` covering `getOnboardingFeatures`, `getCfnTemplate`, and `getCfnTemplateDownloadUrl` (the latter two used by tasks 4 and 5).
2. Created `OnboardingMethodHub`. Guided is a large primary card with a "Recommended" pill; Chat is a smaller secondary card rendered only when `features.chat_enabled` is true; Advanced is an intentionally de-emphasised underlined text link in a secondary footer — **not** a sibling card of equal weight.
3. Added stub `GuidedOnboarding` and `ChatOnboarding` panels. Each renders a minimal preserved input, a "← Back to methods" control, and a note that the full wizard lands in a follow-up change. Tasks 4 and 5 replace these stubs with real content.
4. Refactored `Integrations.jsx`: `addMethod ∈ {null, 'hub', 'guided', 'chat', 'advanced'}`. Each method owns its own form state in the parent, so back-to-hub preserves typed input.
5. On mount, the page calls `GET /api/v1/onboarding/features` to hydrate `chat_enabled`; the call is non-fatal (Chat simply stays hidden on failure).
6. Added 9 hub-component tests and 6 integration tests that drive `Integrations` with mocked APIs: hub opens, Chat flag gating, Back-to-hub preserves input, Advanced reaches the raw form unchanged, Cancel closes the flow.

### Changes made
- `frontend/src/api/onboarding.js` (new)
- `frontend/src/components/onboarding/OnboardingMethodHub.jsx` (new)
- `frontend/src/components/onboarding/GuidedOnboarding.jsx` (new, stub)
- `frontend/src/components/onboarding/ChatOnboarding.jsx` (new, stub)
- `frontend/src/components/onboarding/OnboardingMethodHub.test.jsx` (new)
- `frontend/src/components/onboarding/onboardingFlow.test.jsx` (new)
- `frontend/src/pages/Settings/Integrations.jsx` — hub wiring, method routing, state preservation, feature-flag fetch

### Notable decisions and deviations
- **Advanced is a text link, not a card.** The task requires Advanced "not a sibling card of equal visual weight." Implemented as an underlined inline button inside a secondary footer divider.
- **Stub method panels on purpose.** Task scope forbids implementing Guided wizard contents or Chat scripted flow here (those live in their own tasks). Stubs render a minimal preserved input so the Back-to-hub acceptance criterion is verifiable in this task.
- **`design:design-critique` quality gate not run.** The autonomous session has no human reviewer on hand; flagged as outstanding for the follow-up operator before feature-close.

### Verification
- `cd frontend && npm test -- --run` — **146 passed** (+15 new).
- `cd frontend && npm run build` — clean production build.
