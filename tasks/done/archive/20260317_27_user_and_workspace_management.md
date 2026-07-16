---
status: done
phase: 9
task_id: P9.2
---

# User and Workspace Management

## Prerequisites

- **P9.1 — Authentication:** Provides the Cognito integration, session management, role-based access middleware, and basic API key generation that this task extends.
- **P2.1 — AWS account registration:** Provides the account registration APIs that workspace management surfaces.

## Problem Statement

Admins need to manage their Numio workspace (name, settings, configuration) and invite/manage users with appropriate roles. This provides the organizational foundation for multi-user access.

## Scope

**In scope:**
- **Workspace settings:** Configure workspace name, default currency, timezone, and data retention period. REST API endpoints for get/update workspace settings.
- **User management:** Admin can invite users by email. Invited users receive an invitation (via Cognito) to set up their account. Requires the customer's Cognito user pool to have email delivery configured (SES or Cognito default). If email delivery is not configured, user creation succeeds but the invitation email is not sent — the admin must manually share temporary credentials. Admin can assign and change roles (admin, editor, viewer). Admin can deactivate users. List all users in the workspace with their roles and status.
- **API access tokens:** Users can generate personal API access tokens for programmatic access. Tokens are scoped to the workspace. Users can list their tokens (masked), and revoke tokens. Admin can view and revoke any user's tokens.
- **Automation safety (Andon cord):** Global toggle to pause all automated actions. Per-domain automation toggles (e.g., pause zombie detection notifications while keeping budget alerts active). P9.2 implements the Andon cord as a workspace-level flag (global + per-domain) with REST API for toggling. The flag is checked by the notification engine (P8.1) before delivery. Worker job integration is deferred — the flag API exists but worker jobs do not check it until a future task.
- REST API endpoints for all above functionality
- All data is workspace-scoped

**Out of scope:**
- Authentication flows (P9.1)
- Self-service user registration
- Workspace creation (single default workspace from Phase 1)
- Frontend settings pages (separate task P9.3)

## Acceptance Criteria

1. Admin can update workspace settings (name, currency, timezone)
2. Admin can invite a new user by email and assign a role
3. Invited user can sign in and has the assigned role
4. Admin can change a user's role and deactivate a user
5. Users can generate and revoke API access tokens
6. API access token authenticates API requests correctly
7. Andon cord API correctly toggles the global and per-domain flags (verified via API response)
8. Per-domain automation toggles work independently
9. Integration of Andon cord with notification delivery is verified after P8.1 is complete

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
