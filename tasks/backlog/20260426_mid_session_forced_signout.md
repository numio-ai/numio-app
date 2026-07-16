---
status: backlog
kind: task
feature: user_management_extensions
title: Mid-session forced sign-out on user disable
---

# Mid-session forced sign-out on user disable

## Problem statement

Spec R14 leaves disabled users' active sessions alive until natural expiry. Customers may want immediate revocation when a user is disabled.

## Scope

In scope:
- On disable, mark all sessions for that user `revoked_at = now()`.
- Middleware respects `revoked_at` on every authenticated request.

Out of scope:
- WebSocket push to active tabs (next page-load is sufficient).

## Acceptance criteria

- The disabled user's next request returns 401.
- UI redirects them to `/login` on the 401.
- Re-enabling the user does not auto-sign-in any prior session — they must log in fresh.

## Quality gates

- Integration test: disable while a request is in flight; confirm subsequent request returns 401.
