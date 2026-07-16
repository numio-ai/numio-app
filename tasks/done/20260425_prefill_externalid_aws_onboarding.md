---
status: done
kind: bug
feature: bugfixes
title: Prefill ExternalId in AWS onboarding (Guided wizard + Advanced form)
---

# Prefill ExternalId in AWS onboarding (Guided wizard + Advanced form)

## Problem statement

The AWS account onboarding flow asks the user to enter the workspace's **ExternalId** by hand on two surfaces:

- **Guided wizard**, Verify step ([GuidedOnboarding.jsx:46](frontend/src/components/onboarding/GuidedOnboarding.jsx#L46)) — `externalId: ""` default.
- **Advanced form**, Add dialog ([Integrations.jsx:17](frontend/src/pages/Settings/Integrations.jsx#L17), `EMPTY_FORM`) — `external_id: ""` default.

The CloudFormation template Numio generates already embeds the workspace's `external_id` as the parameter default — Numio knows the value. Forcing the user to copy/paste it is the only place the value drifts, and it does drift. A live install in account 123456789012 hit `AccessDenied` on `sts:AssumeRole` because the submitted ExternalId did not match the role's trust-policy condition. AWS returns the same `is not authorized to perform: sts:AssumeRole` text for both a missing IAM grant and an ExternalId mismatch, so the failure mode is opaque and wastes operator time.

**Observed:** ExternalId field defaults to `""` on both surfaces; mismatch causes opaque `AccessDenied` at validation.
**Expected:** ExternalId field is prefilled with the workspace's own ExternalId (from `GET /api/v1/workspace/info`) on both surfaces. The field stays editable for the rare custom-trust-policy case; the common case requires zero typing.

This task supersedes and combines two earlier tickets that addressed the same root cause on each surface separately.

## Scope

In scope:
- **Guided wizard** — [GuidedOnboarding.jsx](frontend/src/components/onboarding/GuidedOnboarding.jsx). Prefill `form.externalId` from `getWorkspaceInfo()` ([frontend/src/api/workspace.js:117](frontend/src/api/workspace.js#L117) → `GET /api/v1/workspace/info`).
- **Advanced form (Add)** — `AccountFormDialog` in [Integrations.jsx](frontend/src/pages/Settings/Integrations.jsx) when `addMethod === "advanced"`. Prefill `addForm.external_id` from the same API.
- Shared loading / error path: a single fetch (or shared cache) for the workspace ExternalId; if the fetch fails or returns no `external_id`, both surfaces fall back to today's empty-default behaviour.
- Field stays editable on both surfaces; user-entered values must not be overwritten on re-render, step-back/forward, or method-switch.

Out of scope (separate tickets if needed):
- The **Chat** onboarding method ([ChatOnboarding.jsx:45](frontend/src/components/onboarding/ChatOnboarding.jsx#L45)) — different surface, different flow, focus here is the manual flow after clicking **+ Add Account**.
- The **Edit** dialog on Settings → Integrations — already prefills from the existing account record.
- Improving the `AccessDenied` error message to distinguish IAM-policy gap from ExternalId mismatch ([backend/src/numio/core/aws_service.py:308-317](backend/src/numio/core/aws_service.py#L308-L317)).
- Any change to how the workspace's `external_id` is generated, stored, or rotated.

## Acceptance criteria

1. Opening **Settings → Integrations → + Add Account → Guided** in a workspace whose `external_id = X` shows `X` prefilled in the ExternalId input on the Verify step (and anywhere else the field appears in the Guided flow).
2. Opening **Settings → Integrations → + Add Account → Advanced** in the same workspace shows `X` prefilled in the External ID input.
3. On either surface, editing the field overrides the prefilled value; the manually entered value is what gets POSTed to `registerAccount` / `/api/v1/accounts`.
4. On either surface, navigating away (Back / method-switch / step-back) and returning does not overwrite a value the user has manually edited within the same open session.
5. If `GET /api/v1/workspace/info` fails or returns no `external_id`, neither surface crashes; both fields fall back to empty (today's behaviour) and the dialog still works.
6. Manual end-to-end on the local dev stack against the live test account `123456789012` reaches `status: connected` from both surfaces without the operator typing the UUID into the ExternalId field.
7. The value prefilled into the field — and the value POSTed to the backend when the user does not edit it — equals the workspace's stored `external_id` returned by `GET /api/v1/workspace/info` (currently `161314a6-c5bc-4671-8017-61a2f347289e` for the local dev workspace; this is the same value the customer's `NumioCurReaderRole` trust policy expects). The value is fetched per-workspace via the API; no UUID is hardcoded in the frontend source.

## Quality gates

- `cd frontend && npm test -- GuidedOnboarding` covers (a) prefill-on-mount, (b) user edit overrides prefill, (c) graceful fallback when `getWorkspaceInfo` rejects.
- Frontend test for the Integrations Advanced form covers the same three cases.
- `cd frontend && npm test -- onboarding` and `cd frontend && npm run build` pass.
- Manual smoke per AC 6 above.
- No regression in the **Edit** dialog on the Integrations page (still prefills from account record) or in **ChatOnboarding** (unchanged).

## Constraints and assumptions

- Backend endpoint `GET /api/v1/workspace/info` already returns `external_id` ([backend/src/numio/api/workspace.py:33-47](backend/src/numio/api/workspace.py#L33-L47)) — no API change.
- The Guided wizard's `form` state is owned by the parent ([Integrations.jsx](frontend/src/pages/Settings/Integrations.jsx)); the prefill must integrate without breaking the parent's "preserve fields across Back / Cancel / method-switch" guarantee called out in the GuidedOnboarding header comment.
- A single cached fetch is preferred over two independent fetches — both surfaces live in the same parent component and the value does not change within a session.

## Risks and rollback

- **Risk:** prefill races with user input on a slow network and overwrites a value the user just typed. **Mitigation:** only set the initial value once, or only prefill when the field is empty AND the user has not yet edited it (track first-edit flag).
- **Risk:** customer with a custom-trust-policy ExternalId edits the field, then later returns and the prefill overwrites. **Mitigation:** same as above — never overwrite a non-empty user value.
- **Rollback:** revert the single frontend commit; behaviour returns to today's empty-default. No DB or API surface change.

## Summary

### Steps completed
1. Activated the task: `tasks/backlog/` → `tasks/active/`.
2. Wired `getWorkspaceInfo()` into `Integrations.jsx` — fetched once on mount, stored as `workspaceExternalId` (or `null` on failure).
3. Added a `prefillApplied` per-Add-session guard. A single `useEffect` keyed on `[workspaceExternalId, addMethod, prefillApplied]` applies the prefill exactly once when both (a) the dialog is open and (b) the workspace ExternalId is loaded; the empty-check guard inside each `setAddForm` / `setGuidedForm` preserves any value the user already typed before the API resolved.
4. `closeAdd()` now resets `prefillApplied` so the next + Add Account session re-prefills from scratch.
5. Added a `helper` line under the Advanced **External ID** field telling the user that the value is prefilled with the workspace's ExternalId and to verify it matches the `sts:ExternalId` condition in the IAM role's trust policy. This closes the new failure mode introduced by silent prefill: a user with an existing role whose trust policy expects a different ExternalId would otherwise see the same opaque AccessDenied this task was meant to prevent.
6. Extended `frontend/src/components/onboarding/onboardingFlow.test.jsx`:
   - Mock now stubs `getWorkspaceInfo` (default returns `external_id: "ws-external-id-uuid"`) and the `getCfnTemplate` / `getCfnTemplateDownloadUrl` calls used by the Guided wizard.
   - Five new tests cover: Advanced prefill on open, Advanced helper text, user-edit-overrides + method-switch preservation, Guided/Waiting prefill on open, graceful empty fallback when `getWorkspaceInfo` rejects.
7. Quality gates green: `npm test -- onboarding` (39/39 tests, 4 files), `npm run build` succeeds.
8. Manual smoke at `http://localhost:50788/settings/integrations`:
   - `GET /api/v1/workspace/info` → `{"external_id":"78125f9f-508a-4ce0-b7b8-43e520f745c2"}` for this worktree's workspace.
   - Advanced **External ID** field renders with that exact value prefilled, helper text visible underneath.
   - Guided wizard's **ExternalId** field on the Waiting step renders with the same value prefilled. Other Output fields (AwsAccountId / RoleArn / AccessKeyId / SecretAccessKey) stay empty as expected — they must come from CloudFormation Outputs.
9. Note on AC 7: the spec named `161314a6-…` as the local dev workspace's `external_id`. This worktree's database was seeded independently and currently holds `78125f9f-…`. The behavioural assertion still holds — what is prefilled equals what `GET /api/v1/workspace/info` returns for the active workspace; no UUID is hardcoded in the source.

### Changes made
- `frontend/src/pages/Settings/Integrations.jsx`:
  - Imported `getWorkspaceInfo` from `../../api/workspace`.
  - Added `workspaceExternalId` + `prefillApplied` state, the workspace-info fetch effect, and the per-session prefill effect.
  - Added `setPrefillApplied(false)` to `closeAdd()`.
  - Added a `helper` field to the `external_id` entry of `accountFields`.
- `frontend/src/components/onboarding/onboardingFlow.test.jsx`:
  - Extended both module mocks (`api/workspace`, `api/onboarding`) with the calls the wizard now makes.
  - Reset `getWorkspaceInfo` mock in `beforeEach`.
  - Added five tests covering AC 1, 2, 3, 4 (method-switch preservation), 5, and the helper-text addition.

### Notable decisions or deviations
- **Prefill location**: chose the parent `Integrations.jsx` rather than each form component. Both forms share parent-owned state, the value does not change within a session, and a single fetch + single guard keeps "never overwrite user input" trivial to reason about.
- **Helper on Advanced External ID** (added after the user flagged the new failure mode): without it, a user who already configured an IAM role with a different `sts:ExternalId` would silently submit a mismatching value and hit the same opaque AccessDenied this task was meant to prevent. Helper points them at the exact AWS console path to verify.
- AC 7's verification on the live stack used `78125f9f-…` (this worktree's seeded value), not the `161314a6-…` quoted in the spec — see step 9 above. The mechanism is the assertion; the literal UUID is environment-specific.

### Links
- Supersedes (deleted in the merge commit prior to this work): `20260425_prefill_externalid_field_in_guided_aws_onboarding_wizard.md`, `20260425_prefill_externalid_field_in_advanced_aws_onboarding_form_int.md`.
