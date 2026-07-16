---
status: done
phase: 9
task_id: P9.1
---

# Authentication with Cognito

## Prerequisites

- **P1.2 — Database setup:** Provides the database for session storage, API keys, and role assignments.
- **P1.3 — API foundation:** Provides the REST API scaffolding that auth middleware wraps.

## Problem Statement

The application needs user authentication to control access to the web UI and API. Per product decision, Cognito is the authentication provider, with an option to disable authentication entirely for development or single-user deployments.

## Scope

**In scope:**
- **Cognito integration:** Authenticate users via a customer-owned AWS Cognito user pool. The customer provisions and manages the Cognito user pool; Numio receives the pool ID and client ID via configuration. Support sign in and password reset flows via Cognito.
- **Session-based auth for web UI:** After Cognito authentication, maintain a session for the web UI. Protected routes redirect unauthenticated users to login. Sessions use HTTP-only secure cookies. The session token is a signed JWT (or opaque token with server-side lookup). Tokens are never stored in localStorage.
- **API key authentication for API/MCP access:** Support API key-based authentication for programmatic access. This task includes basic API key generation (create a key, return the key value once, store a hashed version) and validation middleware. Full API key management (list, revoke, admin view) is in P9.2. A seed API key can also be generated via a CLI management command for bootstrapping and testing.
- **Auth bypass option:** Controlled by the `AUTH_ENABLED` environment variable (default: `true`). When set to `false`, all requests are treated as an authenticated admin user. This supports development workflows and single-user deployments. Auth bypass is server-side only — not a client-side toggle.
- **Role-based access:** Three roles: admin, editor, viewer. Permissions matrix:

  | Operation | Admin | Editor | Viewer |
  |-----------|-------|--------|--------|
  | Manage workspace settings | Yes | No | No |
  | Manage AWS accounts | Yes | No | No |
  | Manage users | Yes | No | No |
  | Manage tag policies | Yes | Yes | No |
  | Manage budgets | Yes | Yes | No |
  | Manage infrastructure policies | Yes | Yes | No |
  | Manage findings (ack/resolve/suppress) | Yes | Yes | No |
  | Manage recommendations (accept/dismiss) | Yes | Yes | No |
  | Create remediation campaigns | Yes | Yes | No |
  | View all data | Yes | Yes | Yes |

  Role is stored per user and checked via middleware on protected operations.
- **Frontend auth flow:** Login page, logout action, redirect to login on session expiry, display current user identity in the header.

**Out of scope:**
- User invitation workflow (separate task P9.2)
- Self-service registration (admin creates users for MVP)
- OAuth/OIDC with providers other than Cognito
- Multi-factor authentication
- Frontend settings pages (separate task P9.3)

## Constraints

- Numio does not create or manage the Cognito user pool — the customer provides pool ID and client ID via configuration
- No long-lived secrets for Cognito stored in the frontend — use standard Cognito auth flows (e.g., authorization code flow with PKCE)
- Auth bypass must be a server-side configuration, not a client-side toggle

**Note:** This task covers both backend auth middleware and frontend auth flow because they are tightly coupled and must be developed together. Auth middleware is added globally — existing endpoints from Phases 2–8 become protected. The auth-bypass mode ensures backward compatibility during development.

## Acceptance Criteria

1. Users can sign in via Cognito and access the web UI
2. Sessions use HTTP-only secure cookies (not localStorage)
3. Unauthenticated requests to protected pages redirect to login
4. API key can be generated (basic creation in P9.1) and used to authenticate API and MCP requests
5. When auth is disabled via AUTH_ENABLED=false, the app works without login
6. Role-based access controls prevent viewers from performing write operations
7. Editor role can manage findings, budgets, policies, and recommendations but cannot modify workspace settings, manage users, or manage AWS accounts
8. Frontend shows current user identity and provides logout action

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- Frontend builds without errors: `cd frontend && npm run build`
