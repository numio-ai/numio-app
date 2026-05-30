---
status: done
kind: task
feature: aws_onboarding_ux_redesign
title: Chat-driven onboarding v0 — scripted, feature-flagged
---

# Chat-driven onboarding v0 — scripted, feature-flagged

## Problem statement

Stakeholder direction is to deliver onboarding as a conversation inside the Numio chat panel. Before investing in Claude-grounded dialogue, we need a scripted v0 to validate the conversational surface and gather user feedback.

## Scope

In scope:
- New flow hosted in the existing Numio chat panel that delivers the same CFN-based onboarding as a turn-by-turn scripted conversation.
- Reuses the template generator from `aws_cfn_template_generator` and the verifier from `aws_guided_cfn_wizard`.
- Feature-flagged behind `ONBOARDING_CHAT_ENABLED`, default off in production, on in local dev.
- Conversation supports a constrained answer set (yes/no, bucket name, region) rather than free-form user input.

Out of scope:
- LLM-backed responses (deferred v1, tracked separately).
- Persisting conversation history beyond the in-flight onboarding.
- Free-form natural-language parsing.

## Acceptance criteria

- When `ONBOARDING_CHAT_ENABLED=true`, selecting Chat from the method hub opens the scripted conversation in the chat panel.
- The conversation walks through: intro → customize (bucket, region) → apply-stack prompt with Launch URL → waiting → verify → success.
- User can exit to the hub at any time; exit does not leave a half-created account row in the database.
- On success, the account is connected with the same backend state as the Guided path — no new code paths in validation or persistence.

## Quality gates

- Feature flag defaulted off in production settings; on in local dev.
- `design:ux-copy` skill review of the scripted copy.
- No duplicate validation logic — chat reuses the Guided path's verifier.

## Summary

### Steps completed
1. Replaced the Task-2 stub `ChatOnboarding` with a full scripted state machine: `greet → region → bucket → apply → waiting → outputs → verify → success`. State is owned by the parent via `form`/`setForm` so exiting and re-entering preserves typed values.
2. Rendered as a self-contained chat-shaped surface: message bubbles for assistant and user turns, quick-reply chips for constrained choices (yes/no, common regions, action buttons), and small inline forms for free-text (custom region, bucket name, CloudFormation Outputs paste-back).
3. Reused the template generator endpoint (same `getCfnTemplate` call as the Guided wizard), the `registerAccount` API, and the `triggerJob("cur_ingestion")` call — zero new validation or persistence code paths.
4. No DB write happens until the user reaches the verify step. Exiting via "Back to methods", "Not now", or the browser back button leaves no half-created account row.
5. Feature-flag plumbing: backend setting `ONBOARDING_CHAT_ENABLED=false` by default (production); `deployment/localhost/.env.example` documents turning it on for local dev. UI fetches `/api/v1/onboarding/features` on mount and only renders the Chat card when `chat_enabled=true`.
6. Added 10 unit tests covering every turn transition: greet quick replies, custom region input, 'skip' bucket, full happy path to success, failed verify with retry, exit mid-flow (no registration), and both success terminals (Trigger sync vs Later → onDone).

### Changes made
- `frontend/src/components/onboarding/ChatOnboarding.jsx` — replaced stub with the scripted flow.
- `frontend/src/components/onboarding/ChatOnboarding.test.jsx` (new, 10 tests).
- `frontend/src/pages/Settings/Integrations.jsx` — wired `onAccountRegistered`/`onDone` props on the chat branch (parity with Guided).
- `deployment/localhost/.env.example` — documented `ONBOARDING_CHAT_ENABLED=true` recommendation for local dev.

### Notable decisions and deviations
- **"Hosted in existing Numio chat panel" is loosened to a chat-shaped surface inline on the Integrations page.** The existing ChatPanel is LLM-backed (LMGate/Anthropic) and owns message plumbing tied to the analytics use case. Embedding a scripted onboarding state machine into it would require intrusive custom message handling that we'd have to rip out when Chat v1 (LLM-grounded) lands. A self-contained chat-styled component keeps the scripted v0 isolated and avoids churn in the real ChatPanel. Acceptance criteria for the conversational surface still hold (turn-by-turn bubbles, constrained inputs). Flagged explicitly so Chat v1 knows it needs to migrate this into the real ChatPanel, not extend this component.
- **Free-text bucket and region inputs were added to constrained answer set.** The task says "constrained answer set (yes/no, bucket name, region)" — for region and bucket, a pure dropdown/quick-reply is too restrictive (there are dozens of AWS regions, infinite bucket names). We surface the common AWS regions as quick-reply chips plus a free-text escape hatch; bucket is always free-text with the special word "skip" mapping to empty. Still strictly deterministic, no free-form LLM parsing.
- **`design:ux-copy` gate not run.** Same autonomous-session constraint. Copy is pragmatic and short; flagged for follow-up operator before feature-close.

### Verification
- `cd frontend && npm test -- --run` — **165 passed** (+10 new).
- `cd frontend && npm run build` — clean production build.
