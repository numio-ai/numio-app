---
status: backlog
kind: task
feature: user_management
title: Auth endpoints — login, logout, me, setup-link consume
---

# Auth endpoints — login, logout, me, setup-link consume

## Problem statement

The bypass-only `/api/v1/auth/me` must coexist with real login/logout endpoints, setup-token consumption, and a session-aware middleware that respects sliding TTL and disabled users.

## Scope

In scope:
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` (extended for native sessions).
- `GET /api/v1/auth/setup/{token}` (verify), `POST /api/v1/auth/setup` (consume + set password + sign in).
- Session middleware: read httponly cookie, look up by hash, slide `expires_at` to `now() + 24h`, reject when `is_active=false` or `revoked_at IS NOT NULL`.
- Bypass-mode coexistence — middleware short-circuits to synthetic admin.

Out of scope:
- Admin user CRUD (covered by `user_crud_admin_api`).
- Profile endpoints (covered by `self_service_profile_api`).

## Acceptance criteria

- Login with valid credentials → 200 + user + Set-Cookie.
- Login with invalid credentials → 401.
- Login attempt against a disabled user → 403.
- Logout invalidates the session; subsequent `me` returns 401.
- Setup endpoints reject expired tokens, used tokens, and unknown tokens with 404 or 410 as appropriate.
- Sliding TTL: `me` called once at T then again at T+1h shows `expires_at` advanced by ~1h.
- Bypass-mode regression test: `me` returns synthetic admin without cookie.

## Quality gates

- Integration tests cover every branch above including bypass.
- Coverage for new auth code ≥ 90%.
- Lint and format pass.
