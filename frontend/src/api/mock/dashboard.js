/**
 * Mock handlers for the dashboard API domain — mirrors src/api/dashboard.js
 * (cost views, cost-explorer, compliance, findings, resources, budgets, infra
 * policies, recommendations, notifications, audit).
 */
import { store } from "./store.js";
import { notFound } from "./errors.js";
import * as cost from "../../mocks/synthetic/cost";
import * as gov from "../../mocks/synthetic/governance";
import * as platform from "../../mocks/synthetic/platform";

function findingDetail(f) {
  const transitions =
    f.status === "open"
      ? []
      : [{ id: `${f.id}-t1`, from_status: "open", to_status: f.status, changed_by: "demo@numio.ai", reason: "Triaged", created_at: "2026-05-21T09:00:00Z" }];
  return { ...f, transitions };
}

export const dashboardHandlers = [
  // --- cost views / cost explorer ---
  { method: "GET", path: "/api/v1/cost-views/total", handler: ({ query }) => cost.costTotal({ start: query.start_date, end: query.end_date, account: query.account || null }) },
  { method: "GET", path: "/api/v1/cost-views/time-series", handler: ({ query }) => cost.costTimeSeries({ start: query.start_date, end: query.end_date, granularity: query.granularity || "daily", dimension: query.dimension || null, account: query.account || null }) },
  { method: "GET", path: "/api/v1/cost-views/by-dimension", handler: ({ query }) => cost.costByDimension(query.dimension || "service", { start: query.start_date, end: query.end_date, account: query.account || null }) },
  { method: "GET", path: "/api/v1/cost-views/trends", handler: ({ query }) => cost.costTrends(query.dimension || "service", query.period || "month") },
  { method: "GET", path: "/api/v1/cost-explorer/cost-by-service", handler: ({ query }) => cost.costByService(query.account_id || null, query.granularity || "MONTHLY") },

  // --- compliance (dashboard side) ---
  { method: "GET", path: "/api/v1/compliance/summary", handler: () => gov.complianceSummary() },
  { method: "GET", path: "/api/v1/compliance/non-compliant", handler: () => gov.nonCompliantList() },

  // --- graceful / not-deployed endpoints: mirror "not available" with null ---
  { method: "GET", path: "/api/v1/anomalies/summary", handler: () => null },
  { method: "GET", path: "/api/v1/findings/summary", handler: () => null },

  // --- findings ---
  {
    method: "GET",
    path: "/api/v1/findings",
    handler: ({ query }) => {
      let list = store.findings();
      if (query.type) list = list.filter((f) => f.type === query.type);
      if (query.severity) list = list.filter((f) => f.severity === query.severity);
      if (query.status) list = list.filter((f) => f.status === query.status);
      return { findings: list, count: list.length };
    },
  },
  { method: "GET", path: "/api/v1/findings/:id", handler: ({ params }) => { const f = store.finding(params.id); return f ? findingDetail(f) : notFound("Finding"); } },
  { method: "POST", path: "/api/v1/findings/:id/acknowledge", handler: ({ params }) => store.transitionFinding(params.id, "acknowledged") || notFound("Finding") },
  { method: "POST", path: "/api/v1/findings/:id/resolve", handler: ({ params }) => store.transitionFinding(params.id, "resolved") || notFound("Finding") },
  { method: "POST", path: "/api/v1/findings/:id/suppress", handler: ({ params }) => store.transitionFinding(params.id, "suppressed") || notFound("Finding") },

  // --- resources ---
  {
    method: "GET",
    path: "/api/v1/resources",
    handler: ({ query }) => {
      let list = gov.resourcesList().resources;
      if (query.service) list = list.filter((r) => r.service === query.service);
      if (query.account_id) list = list.filter((r) => r.account_id === query.account_id);
      if (query.region) list = list.filter((r) => r.region === query.region);
      if (query.state) list = list.filter((r) => r.state === query.state);
      if (query.search) list = list.filter((r) => (r.name || "").includes(query.search));
      return { resources: list, count: list.length };
    },
  },

  // --- budgets ---
  { method: "GET", path: "/api/v1/budgets", handler: () => ({ budgets: store.budgets(), count: store.budgets().length }) },
  { method: "GET", path: "/api/v1/budgets/:id", handler: ({ params }) => store.budget(params.id) || notFound("Budget") },
  { method: "POST", path: "/api/v1/budgets", handler: ({ body }) => store.createBudget(body || {}) },
  { method: "PUT", path: "/api/v1/budgets/:id", handler: ({ params, body }) => store.updateBudget(params.id, body || {}) || notFound("Budget") },
  { method: "DELETE", path: "/api/v1/budgets/:id", handler: ({ params }) => { store.deleteBudget(params.id); return null; } },
  { method: "GET", path: "/api/v1/budgets/:id/alerts", handler: ({ params }) => cost.budgetAlerts(params.id) },

  // --- infra policies ---
  { method: "GET", path: "/api/v1/infra-policies", handler: ({ query }) => gov.infraPoliciesList({ type: query.type, is_active: query.is_active === undefined ? undefined : query.is_active === "true" }) },
  { method: "GET", path: "/api/v1/infra-policies/:id", handler: ({ params }) => gov.infraPolicyById(params.id) || notFound("Policy") },
  { method: "POST", path: "/api/v1/infra-policies", handler: ({ body }) => ({ ...gov.infraPoliciesList().policies[0], ...body, id: `new-${Date.now() % 100000}` }) },
  { method: "PUT", path: "/api/v1/infra-policies/:id", handler: ({ params, body }) => ({ ...(gov.infraPolicyById(params.id) || gov.infraPoliciesList().policies[0]), ...body, id: params.id }) },
  { method: "DELETE", path: "/api/v1/infra-policies/:id", handler: () => null },

  // --- recommendations + savings ---
  {
    method: "GET",
    path: "/api/v1/recommendations",
    handler: ({ query }) => {
      let list = store.recommendations();
      if (query.category) list = list.filter((r) => r.category === query.category);
      if (query.status) list = list.filter((r) => r.status === query.status);
      return { recommendations: list, count: list.length };
    },
  },
  { method: "GET", path: "/api/v1/recommendations/savings/summary", handler: () => gov.savingsSummary() },
  { method: "GET", path: "/api/v1/recommendations/savings/timeline", handler: () => gov.savingsTimeline() },
  { method: "GET", path: "/api/v1/recommendations/:id", handler: ({ params }) => store.recommendation(params.id) || notFound("Recommendation") },
  { method: "POST", path: "/api/v1/recommendations/:id/accept", handler: ({ params }) => store.transitionRecommendation(params.id, "accepted", "accepted_at") || notFound("Recommendation") },
  { method: "POST", path: "/api/v1/recommendations/:id/dismiss", handler: ({ params }) => store.transitionRecommendation(params.id, "dismissed", "dismissed_at") || notFound("Recommendation") },
  { method: "POST", path: "/api/v1/recommendations/:id/implement", handler: ({ params }) => store.transitionRecommendation(params.id, "implemented", "implemented_at") || notFound("Recommendation") },

  // --- notifications ---
  {
    method: "GET",
    path: "/api/v1/notifications",
    handler: ({ query }) => {
      const list = query.unread_only === "true" ? store.notifications().filter((n) => !n.is_read) : store.notifications();
      return { notifications: list, count: list.length };
    },
  },
  { method: "GET", path: "/api/v1/notifications/unread-count", handler: () => ({ count: store.notifications().filter((n) => !n.is_read).length }) },
  { method: "POST", path: "/api/v1/notifications/:id/read", handler: ({ params }) => store.markNotificationRead(params.id) },
  { method: "POST", path: "/api/v1/notifications/read-all", handler: () => store.markAllNotificationsRead() },

  // --- audit ---
  { method: "GET", path: "/api/v1/audit-config-events", handler: () => platform.auditConfigEvents() },
  { method: "GET", path: "/api/v1/audit-action-events", handler: () => platform.auditActionEvents() },
  { method: "GET", path: "/api/v1/audit-action-events/:id", handler: ({ params }) => platform.auditActionEventById(params.id) || notFound("Event") },
];
