---
status: backlog
kind: task
feature: user_management
title: Frontend — Settings → Users page
---

# Frontend — Settings → Users page

## Problem statement

Admins need a UI for the user-management endpoints: list, add, edit, disable / enable, regenerate setup link.

## Scope

In scope:
- `/settings/users` route — table with email, name, role, status, last-seen.
- Add-user dialog — email + name + role; on submit shows a one-time setup-URL modal with copy-to-clipboard. Modal cannot be reopened (URL displayed only once).
- Edit-user dialog — name, email, role.
- Disable / enable / regenerate-link buttons.
- Last-admin guard UI — Disable and role-change buttons disabled with tooltip "Cannot disable the only active admin" when applicable.
- Bypass-mode handling — menu entry hidden, route returns in-app 404.

Out of scope:
- User menu / profile (covered by `frontend_user_menu_profile`).
- Audit log (deferred).

## Acceptance criteria

- List shows all expected columns.
- Add-user flow surfaces the setup URL once; copy-to-clipboard works; closing the modal does not let it reopen.
- Disable / role-change UI state matches the last-admin guard server-side.
- Bypass mode hides the entry and 404s the route in-app.

## Quality gates

- Component tests for last-admin-guard UI state and add-user-modal one-shot behavior.
- `cd frontend && npm test && npm run build` succeed.
- Manual smoke test documented in PR.
