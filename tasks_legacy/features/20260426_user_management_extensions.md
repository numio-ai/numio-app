---
status: backlog
slug: user_management_extensions
title: User Management — deferred extensions
---

# User Management — deferred extensions

## Problem statement

Phase-1 user management (`feature: user_management`) ships native identity, a single role (`admin`), and a minimal UI sufficient for 5–20-user teams in demo and early production. Eight follow-on capabilities were explicitly deferred during discovery and must not be silently lost.

## Objective

Provide a single home for the deferred capabilities so each can be picked up, scoped, and shipped independently when the customer signal arrives, without re-litigating the original deferral.

## Acceptance criteria

This umbrella feature is complete when every member task has shipped to `done/` or has been formally retired by a product decision recorded in this feature's summary section. Each task carries its own acceptance criteria.

## Scope

In scope: tracking of the eight deferred capabilities listed below.

Out of scope: implementation. Each member task scopes its own work.

## Tasks

1. cognito_backend_wiring — Activate the dormant Cognito identity backend
2. roles_beyond_admin — Implement member / engineer / finance / viewer roles + permission matrix
3. audit_log — Authentication and admin-action audit log
4. machine_users_api_tokens — Machine users and API tokens for automation
5. mid_session_forced_signout — Immediate session invalidation on user disable
6. smtp_email_delivery — SMTP integration for invitations and password resets
7. self_serve_forgot_password — User-initiated password reset flow
8. account_lockout — Brute-force protection / account lockout

## Linked spec

`docs/app/settings/user-management-spec.md` — see "Out of scope" section for the deferral context behind each task.
