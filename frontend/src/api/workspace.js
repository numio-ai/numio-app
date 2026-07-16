/**
 * API client for workspace settings, user management, API keys, and automation toggles.
 */
import { request } from "./client";

// ---------------------------------------------------------------------------
// Workspace settings
// ---------------------------------------------------------------------------

export async function getWorkspaceSettings() {
  return request("/api/v1/workspace/settings");
}

export async function updateWorkspaceSettings(data) {
  return request("/api/v1/workspace/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export async function listUsers() {
  return request("/api/v1/users");
}

export async function inviteUser(email, name, role) {
  return request("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ email, name, role }),
  });
}

export async function updateUser(userId, data) {
  return request(`/api/v1/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export async function listMyApiKeys() {
  return request("/api/v1/users/me/api-keys");
}

export async function createApiKey(name) {
  return request("/api/v1/users/me/api-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeMyApiKey(keyId) {
  return request(`/api/v1/users/me/api-keys/${keyId}`, {
    method: "DELETE",
  });
}

export async function listAllApiKeys() {
  return request("/api/v1/users/api-keys");
}

export async function revokeAnyApiKey(keyId) {
  return request(`/api/v1/users/api-keys/${keyId}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Automation toggles (Andon cord)
// ---------------------------------------------------------------------------

export async function getAutomationStatus() {
  return request("/api/v1/workspace/automation");
}

export async function setGlobalToggle(paused) {
  return request("/api/v1/workspace/automation/global", {
    method: "PUT",
    body: JSON.stringify({ paused }),
  });
}

export async function setDomainToggle(domain, paused) {
  return request("/api/v1/workspace/automation/domain", {
    method: "PUT",
    body: JSON.stringify({ domain, paused }),
  });
}

// ---------------------------------------------------------------------------
// Workspace identity info (ExternalId + principal ARN)
// ---------------------------------------------------------------------------

export async function getWorkspaceInfo() {
  return request("/api/v1/workspace/info");
}

// ---------------------------------------------------------------------------
// AWS accounts (for Integrations tab)
// ---------------------------------------------------------------------------

export async function listAccounts() {
  return request("/api/v1/accounts");
}

export async function registerAccount(data) {
  return request("/api/v1/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAccount(accountId, data) {
  return request(`/api/v1/accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function revalidateAccount(accountId) {
  return request(`/api/v1/accounts/${accountId}/validate`, {
    method: "POST",
  });
}

export async function deactivateAccount(accountId) {
  return request(`/api/v1/accounts/${accountId}/deactivate`, {
    method: "POST",
  });
}

export async function deleteAccount(accountId) {
  return request(`/api/v1/accounts/${accountId}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export async function getNotificationPreferences() {
  return request("/api/v1/notifications/preferences");
}

export async function updateNotificationPreferences(preferences) {
  return request("/api/v1/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify({ preferences }),
  });
}
