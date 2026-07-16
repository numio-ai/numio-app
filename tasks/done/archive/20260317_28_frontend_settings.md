---
status: done
phase: 9
task_id: P9.3
---

# Frontend: Settings and Administration Pages

## Prerequisites

- **P9.1 — Authentication:** Provides login/session infrastructure and role-based access.
- **P9.2 — User & workspace management:** Provides workspace settings, user management, API token, and Andon cord APIs.
- **P8.1 — Notification engine & audit trail:** Provides notification preferences API and audit trail API for the Notifications and Audit Logs tabs.

## Problem Statement

Customers need a unified settings area to manage their workspace, connected AWS accounts, users, API tokens, notification preferences, automation safety controls, and audit logs.

## Scope

**In scope:**
- **Settings page** with tabbed navigation covering:
  - **Workspace tab:** Edit workspace name, default currency, timezone, data retention period
  - **Integrations tab:** List connected AWS accounts with sync status (last sync time, success/failure, resource count). Add new account (registration form with account ID, alias, role ARN, environment label). Remove account. Re-validate credentials. AWS account management APIs are provided by P2.1. See P2.1 API documentation for endpoint specifications. Placeholder section for future integrations (GCP, AI providers) — display "coming soon" or similar
  - **People tab:** List workspace users with role and status. Invite user form (email + role). Change role. Deactivate user.
  - **API Access Tokens tab:** List user's tokens (masked). Generate new token (display once). The full token value is returned only in the creation response. Subsequent list/get calls return a masked version (last 4 characters visible). The frontend displays the full token at creation time with a copy button and a warning that it won't be shown again. Revoke token. Admin view: see all users' tokens.
  - **Notifications tab:** Per-user notification preferences — toggle which event types to receive
  - **Automation Safety tab:** Global Andon cord toggle. Per-domain automation toggles. Visual indicator of current automation status.
  - **Audit Logs tab:** Reuse the audit log component built in P8.2. If P8.2 is completed after P9.3, implement the audit log tab as a placeholder that renders when the P8.2 component becomes available.
- All data sourced from backend APIs (P9.1, P9.2, P8.1)

**Out of scope:**
- Backend settings, auth, and user management APIs (P9.1, P9.2)
- Billing/subscription management
- Theme or appearance settings

## Acceptance Criteria

1. Settings page renders all tabs with correct data from backend APIs
2. Workspace settings can be edited and saved
3. AWS account list shows sync status per account; new accounts can be added
4. User list shows all workspace users; admin can invite users and change roles
5. API token can be generated and displayed (once), then appears masked in the list
6. Notification preferences can be toggled per event type
7. Andon cord toggle visually reflects current state and can be changed
8. All tabs handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
