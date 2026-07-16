/**
 * API client for Overview dashboard endpoints.
 */
import { request, gracefulRequest } from "./client";

// Retained: getNotificationStreamUrl builds an EventSource (SSE) URL directly.
const BASE = import.meta.env.VITE_API_URL || "";

// ---------------------------------------------------------------------------
// Cost Views (P3.3)
// ---------------------------------------------------------------------------

/** Total spend for a date range. */
export async function getTotalCost(startDate, endDate, granularity = "daily", account = null) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  if (account) params.set("account", account);
  return request(`/api/v1/cost-views/total?${params}`);
}

/** Spend over time (daily buckets for trend chart). */
export async function getCostTimeSeries(startDate, endDate, granularity = "daily", dimension = null, account = null) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  if (dimension) params.set("dimension", dimension);
  if (account) params.set("account", account);
  return request(`/api/v1/cost-views/time-series?${params}`);
}

/** Spend grouped by business dimension (team, project, etc.). */
export async function getCostByDimension(dimension, startDate, endDate, account = null) {
  const params = new URLSearchParams({
    dimension,
    start_date: startDate,
    end_date: endDate,
  });
  if (account) params.set("account", account);
  return request(`/api/v1/cost-views/by-dimension?${params}`);
}

/** Period-over-period trend analysis by dimension. */
export async function getTrends(dimension, period = "month", endDate = null, account = null) {
  const params = new URLSearchParams({ dimension, period });
  if (endDate) params.set("end_date", endDate);
  if (account) params.set("account", account);
  return request(`/api/v1/cost-views/trends?${params}`);
}

// ---------------------------------------------------------------------------
// Cost Explorer (default service-level breakdown)
// ---------------------------------------------------------------------------

/** Cost breakdown by AWS service (no attribution rules required). */
export async function getCostByService(accountId, startDate, endDate, granularity = "MONTHLY") {
  const params = new URLSearchParams({
    account_id: accountId,
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  return request(`/api/v1/cost-explorer/cost-by-service?${params}`);
}

// ---------------------------------------------------------------------------
// Compliance (P3.1)
// ---------------------------------------------------------------------------

/** Overall compliance summary with cost-weighted score. */
export async function getComplianceSummary() {
  return request("/api/v1/compliance/summary");
}

/** List non-compliant resources from the most recent audit. */
export async function getNonCompliantResources(limit = 1000) {
  return gracefulRequest(`/api/v1/compliance/non-compliant?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Graceful-degradation endpoints (Phase 4+)
// ---------------------------------------------------------------------------

/** Anomaly summary — returns null if API not deployed yet. */
export async function getAnomalySummary() {
  return gracefulRequest("/api/v1/anomalies/summary");
}

/** Action items / findings count — returns null if API not deployed yet. */
export async function getActionItemsSummary() {
  return gracefulRequest("/api/v1/findings/summary");
}

// ---------------------------------------------------------------------------
// Findings (P4.3)
// ---------------------------------------------------------------------------

/** List findings with optional filters. */
export async function getFindings({ type, severity, status, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (severity) params.set("severity", severity);
  if (status) params.set("status", status);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request(`/api/v1/findings?${params}`);
}

/** Get finding detail with transition history. */
export async function getFinding(findingId) {
  return request(`/api/v1/findings/${findingId}`);
}

/** Acknowledge a finding. */
export async function acknowledgeFinding(findingId) {
  return request(`/api/v1/findings/${findingId}/acknowledge`, { method: "POST" });
}

/** Resolve a finding. */
export async function resolveFinding(findingId) {
  return request(`/api/v1/findings/${findingId}/resolve`, { method: "POST" });
}

/** Suppress a finding. */
export async function suppressFinding(findingId, reason) {
  return request(`/api/v1/findings/${findingId}/suppress`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ---------------------------------------------------------------------------
// Cloud Resources (P2.5)
// ---------------------------------------------------------------------------

/** List cloud resources with optional filters. */
export async function getResources({ service, account_id, region, state, search, limit = 200, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (account_id) params.set("account_id", account_id);
  if (region) params.set("region", region);
  if (state) params.set("state", state);
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request(`/api/v1/resources?${params}`);
}

// ---------------------------------------------------------------------------
// Budgets (P5.1)
// ---------------------------------------------------------------------------

/** List all budgets with current status. */
export async function getBudgets() {
  return request("/api/v1/budgets");
}

/** Get budget detail with spend data. */
export async function getBudget(budgetId) {
  return request(`/api/v1/budgets/${budgetId}`);
}

/** Create a budget. */
export async function createBudget(data) {
  return request("/api/v1/budgets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update a budget. */
export async function updateBudget(budgetId, data) {
  return request(`/api/v1/budgets/${budgetId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete a budget. */
export async function deleteBudget(budgetId) {
  return request(`/api/v1/budgets/${budgetId}`, { method: "DELETE" });
}

/** Get alerts/findings for a budget. */
export async function getBudgetAlerts(budgetId) {
  return request(`/api/v1/budgets/${budgetId}/alerts`);
}

// ---------------------------------------------------------------------------
// Infrastructure Policies (P5.2)
// ---------------------------------------------------------------------------

/** List infrastructure policies with compliance status. */
export async function getInfraPolicies({ type, is_active, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (is_active !== undefined) params.set("is_active", String(is_active));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request(`/api/v1/infra-policies?${params}`);
}

/** Get infrastructure policy detail with violations. */
export async function getInfraPolicy(policyId) {
  return request(`/api/v1/infra-policies/${policyId}`);
}

/** Create an infrastructure policy. */
export async function createInfraPolicy(data) {
  return request("/api/v1/infra-policies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an infrastructure policy. */
export async function updateInfraPolicy(policyId, data) {
  return request(`/api/v1/infra-policies/${policyId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete an infrastructure policy. */
export async function deleteInfraPolicy(policyId) {
  return request(`/api/v1/infra-policies/${policyId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Recommendations (P6.1)
// ---------------------------------------------------------------------------

/** List recommendations with optional filters. */
export async function getRecommendations({ category, status, sort_by_savings = true, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  params.set("sort_by_savings", String(sort_by_savings));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request(`/api/v1/recommendations?${params}`);
}

/** Get recommendation detail. */
export async function getRecommendation(recommendationId) {
  return request(`/api/v1/recommendations/${recommendationId}`);
}

/** Accept a recommendation. */
export async function acceptRecommendation(recommendationId) {
  return request(`/api/v1/recommendations/${recommendationId}/accept`, { method: "POST" });
}

/** Dismiss a recommendation. */
export async function dismissRecommendation(recommendationId) {
  return request(`/api/v1/recommendations/${recommendationId}/dismiss`, { method: "POST" });
}

/** Mark a recommendation as implemented. */
export async function implementRecommendation(recommendationId) {
  return request(`/api/v1/recommendations/${recommendationId}/implement`, { method: "POST" });
}

/** Get savings summary (totals + by-category breakdown). */
export async function getSavingsSummary() {
  return request("/api/v1/recommendations/savings/summary");
}

/** Get savings timeline (cumulative entries ordered by date). */
export async function getSavingsTimeline() {
  return request("/api/v1/recommendations/savings/timeline");
}

// ---------------------------------------------------------------------------
// Notifications (P8.1)
// ---------------------------------------------------------------------------

/** List notifications with optional unread filter. */
export async function getNotifications({ unread_only = false, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (unread_only) params.set("unread_only", "true");
  return request(`/api/v1/notifications?${params}`);
}

/** Get unread notification count. */
export async function getUnreadCount() {
  return request("/api/v1/notifications/unread-count");
}

/** Mark a single notification as read. */
export async function markNotificationRead(notificationId) {
  return request(`/api/v1/notifications/${notificationId}/read`, { method: "POST" });
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead() {
  return request("/api/v1/notifications/read-all", { method: "POST" });
}

/** SSE stream URL for real-time notifications. */
export function getNotificationStreamUrl() {
  return `${BASE}/api/v1/notifications/stream`;
}

// ---------------------------------------------------------------------------
// Audit — Setup (config) events
// ---------------------------------------------------------------------------

/** List configuration audit events with optional filters. */
export async function getAuditConfigEvents({ user, action, entity_type, entity_id, start_date, end_date, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (user) params.set("user", user);
  if (action) params.set("action", action);
  if (entity_type) params.set("entity_type", entity_type);
  if (entity_id) params.set("entity_id", entity_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);
  return request(`/api/v1/audit-config-events?${params}`);
}

// ---------------------------------------------------------------------------
// Audit — Operations (action) events
// ---------------------------------------------------------------------------

/** List action audit events (operations Numio performed against external systems). */
export async function getAuditActionEvents({ operation_type, actor, status, start_date, end_date, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (operation_type) params.set("operation_type", operation_type);
  if (actor) params.set("actor", actor);
  if (status) params.set("status", status);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);
  return request(`/api/v1/audit-action-events?${params}`);
}

/** Get one action audit event with its child items. */
export async function getAuditActionEvent(eventId) {
  return request(`/api/v1/audit-action-events/${eventId}`);
}
