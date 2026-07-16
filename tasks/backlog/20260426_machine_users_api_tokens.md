---
status: backlog
kind: task
feature: user_management_extensions
title: Machine users and API tokens
---

# Machine users and API tokens

## Problem statement

Automation needs to call Numio without a human session. Today there is no machine identity.

## Scope

In scope:
- Machine-user record kind distinct from human users.
- Long-lived API tokens with scopes.
- Token rotation that invalidates the prior token.

Out of scope:
- OIDC client credentials.

## Acceptance criteria

- Admin creates a machine user, issues a token, sets scopes.
- Tokens authenticate HTTP requests via header (e.g. `X-API-Key`).
- Rotation invalidates the old token immediately.

## Quality gates

- Integration tests cover token issuance, use, rotation, scope enforcement.
- Rate-limit interaction documented.
