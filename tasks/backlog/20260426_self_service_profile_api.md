---
status: backlog
kind: task
feature: user_management
title: Self-service profile API
---

# Self-service profile API

## Problem statement

Logged-in users need to update their own name and password and view the active workspace ID. Email and role are admin-only and must be rejected for self-edit.

## Scope

In scope:
- `PATCH /api/v1/me` accepting only `name`.
- `POST /api/v1/me/password` requiring current password.
- `GET /api/v1/me/workspace` returning `{ id }` for any logged-in user.

Out of scope:
- Frontend (covered by `frontend_user_menu_profile`).

## Acceptance criteria

- `PATCH /me` with `email` or `role` in payload → 400.
- `POST /me/password` with wrong current password → 401.
- `POST /me/password` with correct current password and a valid new password persists Argon2id hash; the current session remains valid.
- `GET /me/workspace` returns the active workspace UUID.

## Quality gates

- Integration tests cover: happy paths, attempted email/role mutation, wrong current password, password-change session persistence.
- Lint and format pass.
