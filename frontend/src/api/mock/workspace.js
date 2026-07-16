/**
 * Mock handlers for the workspace API domain — mirrors src/api/workspace.js
 * (settings, users, API keys, automation, accounts integration, notification
 * preferences).
 */
import { store } from "./store.js";
import { notFound } from "./errors.js";
import * as platform from "../../mocks/synthetic/platform";

// AccountRegistrationResponse: the account plus a passing validation report.
function registration(account) {
  return {
    account,
    validation: {
      steps: [
        { name: "role_assumption", label: "Assume IAM role", status: "pass", detail: "Assumed NumioReadRole.", error: null, remediation: null },
        { name: "cur_access", label: "Read CUR bucket", status: account.cur_s3_bucket ? "pass" : "skip", detail: account.cur_s3_bucket ? "CUR readable." : "CUR not configured.", error: null, remediation: null },
      ],
      overall_status: account.status,
    },
  };
}

export const workspaceHandlers = [
  // settings
  { method: "GET", path: "/api/v1/workspace/settings", handler: () => store.workspaceSettings() },
  { method: "PUT", path: "/api/v1/workspace/settings", handler: ({ body }) => store.updateWorkspaceSettings(body || {}) },
  { method: "GET", path: "/api/v1/workspace/info", handler: () => platform.workspaceInfo() },

  // users
  { method: "GET", path: "/api/v1/users", handler: () => ({ users: store.users(), count: store.users().length }) },
  { method: "POST", path: "/api/v1/users", handler: ({ body }) => store.inviteUser(body || {}) },
  { method: "PUT", path: "/api/v1/users/:id", handler: ({ params, body }) => store.updateUser(params.id, body || {}) || notFound("User") },

  // API keys
  { method: "GET", path: "/api/v1/users/me/api-keys", handler: () => ({ keys: store.apiKeys(), count: store.apiKeys().length }) },
  { method: "POST", path: "/api/v1/users/me/api-keys", handler: ({ body }) => store.createApiKey(body?.name) },
  { method: "DELETE", path: "/api/v1/users/me/api-keys/:id", handler: ({ params }) => { store.revokeApiKey(params.id); return null; } },
  { method: "GET", path: "/api/v1/users/api-keys", handler: () => ({ keys: store.apiKeys(), count: store.apiKeys().length }) },
  { method: "DELETE", path: "/api/v1/users/api-keys/:id", handler: ({ params }) => { store.revokeApiKey(params.id); return null; } },

  // automation
  { method: "GET", path: "/api/v1/workspace/automation", handler: () => store.automation() },
  { method: "PUT", path: "/api/v1/workspace/automation/global", handler: ({ body }) => store.setGlobalToggle(body?.paused) },
  { method: "PUT", path: "/api/v1/workspace/automation/domain", handler: ({ body }) => store.setDomainToggle(body?.domain, body?.paused) },

  // accounts / integration
  { method: "GET", path: "/api/v1/accounts", handler: () => ({ accounts: store.accounts(), count: store.accounts().length }) },
  { method: "POST", path: "/api/v1/accounts", handler: ({ body }) => registration(store.addAccount(body || {})) },
  { method: "PUT", path: "/api/v1/accounts/:id", handler: ({ params, body }) => { const a = store.updateAccount(params.id, body || {}); return a ? registration(a) : notFound("Account"); } },
  { method: "POST", path: "/api/v1/accounts/:id/validate", handler: ({ params }) => { const a = store.account(params.id); return a ? registration(a) : notFound("Account"); } },
  { method: "POST", path: "/api/v1/accounts/:id/deactivate", handler: ({ params }) => store.setAccountStatus(params.id, "inactive") || notFound("Account") },
  { method: "DELETE", path: "/api/v1/accounts/:id", handler: ({ params }) => { store.deleteAccount(params.id); return null; } },

  // notification preferences
  { method: "GET", path: "/api/v1/notifications/preferences", handler: () => store.notificationPreferences() },
  { method: "PUT", path: "/api/v1/notifications/preferences", handler: ({ body }) => store.updateNotificationPreferences(body || {}) },
];
