---
status: backlog
kind: task
feature: user_management
title: Remove James C. admin dummy user
---

# Remove James C. admin dummy user

## Problem statement

"James C. admin" and related dummy data are hard-coded across the frontend. Spec acceptance requires zero leftovers — every user-facing display must read from `AuthContext`.

## Scope

In scope:
- Sweep `frontend/src` for "James", "JC", and any related dummy avatar / default name.
- Replace each occurrence with a value sourced from `AuthContext` or remove it entirely if vestigial.
- Update unit-test fixtures that depended on the dummy.

Out of scope:
- Backend bypass-mode synthetic admin — keeps email `admin@localhost` and display name "Local Admin" per existing convention. This task does not rename that.

## Acceptance criteria

- `git grep -i "james"` in `frontend/src` returns nothing.
- All user displays read from `AuthContext`.
- No regression in component tests.

## Quality gates

- `cd frontend && npm test && npm run build` succeed.
- Visual smoke test confirms every header / sidebar / dialog shows the real user.
