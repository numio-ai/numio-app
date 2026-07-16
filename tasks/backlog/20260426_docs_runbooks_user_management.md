---
status: backlog
kind: task
feature: user_management
title: Update dev-runbook and ops-runbook for user management
---

# Update dev-runbook and ops-runbook for user management

## Problem statement

`dev-runbook.md` and `ops-runbook.md` describe the synthetic admin as the only flow. Real user management ships in this feature; doc drift will mislead operators. Doc-sync is mandatory.

## Scope

In scope:
- Update `docs/dev-runbook.md`: document the first-run create-first-admin flow when bypass is off, the `AUTH_BYPASS` env name, and how dev workflow continues to use bypass mode.
- Update `docs/ops-runbook.md`: document `AUTH_BYPASS`, the production environment gate, and the first-run flow for cloud deployments.
- Cross-link both runbooks to `docs/app/settings/user-management-spec.md`.

Out of scope:
- User-facing user-guide updates (separate task if needed).

## Acceptance criteria

- Both runbooks reference `AUTH_BYPASS` exclusively for the new var name; `AUTH_ENABLED` appears only in a one-line "deprecated, dual-read in this release" note.
- Both runbooks describe the first-run create-first-admin flow.
- Both link to the user-management spec.
- A cold reader following the dev-runbook on a fresh worktree can reach a logged-in real admin in their browser.

## Quality gates

- Manual walkthrough on a fresh worktree confirms the docs work end-to-end.
- Markdown lint clean.
