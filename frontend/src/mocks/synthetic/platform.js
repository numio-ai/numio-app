/**
 * Synthetic platform & operations dataset (spec §5.2, task synthetic_data_platform).
 *
 * Covers every UI surface outside cost and governance: workspace settings,
 * users, API keys, automation, accounts/integration, onboarding, auth/session,
 * jobs, ingestion, inbox, notifications, chat, data explorer, and audit.
 *
 * Account consistency (AC2): the integration list's `aws_account_id` values ARE
 * the canonical account ids; every account referenced by ingestion status and
 * job history is one of them. Built only on canonical entities; defines no
 * parallel account/service/region set.
 */
import { ACCOUNTS, DEMO_WINDOW } from "./entities";
import { CORE_SEED, makeRng, rngInt, rngPick, round2 } from "./seed";

const WS = "00000000-0000-0000-0000-000000000000";
const uuidFrom = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rng = makeRng(CORE_SEED + 3);

// --- workspace settings -----------------------------------------------------

export function workspaceSettings() {
  return {
    id: WS,
    name: "Numio Demo",
    slug: "default",
    default_currency: "USD",
    timezone: "America/New_York",
    data_retention_days: 365,
    automation_paused: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

export function workspaceInfo() {
  return { external_id: "c0ffee00-0000-4000-8000-000000000001" };
}

// --- users ------------------------------------------------------------------

const USERS = [
  { id: uuidFrom(1), workspace_id: WS, email: "demo@numio.ai", name: "Demo Admin", role: "admin", is_active: true },
  { id: uuidFrom(2), workspace_id: WS, email: "engineer@numio.ai", name: "Pat Engineer", role: "member", is_active: true },
  { id: uuidFrom(3), workspace_id: WS, email: "finance@numio.ai", name: "Sam Finance", role: "viewer", is_active: true },
];

export function usersList() {
  return { users: USERS, count: USERS.length };
}

/** Authenticated session — GET /api/v1/auth/me */
export function me() {
  return { ...USERS[0] };
}

// --- API keys ---------------------------------------------------------------

const API_KEYS = [
  { id: uuidFrom(10), name: "ci-pipeline", key_prefix: "numio_ci", created_at: "2026-02-01T00:00:00Z", last_used_at: "2026-05-26T12:00:00Z", user_id: USERS[0].id, user_email: USERS[0].email },
  { id: uuidFrom(11), name: "local-dev", key_prefix: "numio_dv", created_at: "2026-03-10T00:00:00Z", last_used_at: null, user_id: USERS[1].id, user_email: USERS[1].email },
];

export function myApiKeys() {
  return { keys: API_KEYS, count: API_KEYS.length };
}
export function allApiKeys() {
  return { keys: API_KEYS, count: API_KEYS.length };
}

// --- automation -------------------------------------------------------------

export function automationStatus() {
  return {
    automation_paused: false,
    domain_toggles: [
      { domain: "cost", paused: false },
      { domain: "governance", paused: false },
      { domain: "tagging", paused: true },
    ],
  };
}

// --- accounts / integration list -------------------------------------------

// Canonical accounts → AccountResponse rows. row `id` is a UUID; the 12-digit
// `aws_account_id` is the cross-screen join key reused by jobs + ingestion.
const ACCOUNT_ROWS = ACCOUNTS.map((a, i) => ({
  id: uuidFrom(20 + i),
  workspace_id: WS,
  aws_account_id: a.id,
  alias: a.alias,
  role_arn: `arn:aws:iam::${a.id}:role/NumioReadRole`,
  tag_writer_role_arn: i === 0 ? `arn:aws:iam::${a.id}:role/NumioTagWriter` : null,
  aws_access_key_id_hint: null,
  external_id: workspaceInfo().external_id,
  status: i === 3 ? "incomplete" : "connected",
  environment_label: a.environment,
  status_message: i === 3 ? "CUR report not yet configured." : null,
  cur_s3_bucket: i === 3 ? null : `numio-cur-${a.id}`,
  cur_s3_prefix: i === 3 ? null : "cur/numio",
  cur_report_name: i === 3 ? null : "numio-cur",
  cur_managed_by_numio: false,
  created_at: "2026-01-05T00:00:00Z",
  updated_at: "2026-05-20T00:00:00Z",
}));

export function accountsList() {
  return { accounts: ACCOUNT_ROWS, count: ACCOUNT_ROWS.length };
}

// Accounts that actually ingest (the connected ones).
const INGESTING = ACCOUNT_ROWS.filter((a) => a.status === "connected");

// --- notification preferences ----------------------------------------------

const EVENT_TYPES = ["budget_alert", "anomaly_detected", "zombie_found", "policy_violation", "recommendation_generated"];

export function notificationPreferences() {
  return { preferences: EVENT_TYPES.map((event_type, i) => ({ event_type, enabled: i !== 2 })) };
}

// --- onboarding -------------------------------------------------------------

export function onboardingFeatures() {
  return { chat_enabled: false };
}

export function onboardingInProgress() {
  return null; // 204 — no onboarding in progress in the demo
}

// --- jobs + ingestion -------------------------------------------------------

const DATA_SOURCES = ["cur_ingestion", "cost_explorer"];

export function jobTypes() {
  return {
    job_types: [
      { job_type: "cur_ingestion", description: "Ingest Cost and Usage Report data", interval_seconds: 86400 },
      { job_type: "cost_explorer", description: "Cost Explorer fallback sync", interval_seconds: 86400 },
      { job_type: "compliance_audit", description: "Tag compliance audit", interval_seconds: 86400 },
    ],
  };
}

// Precomputed once at module load so repeated calls are byte-identical (the
// shared rng is stateful; builders must not consume it at call time).
const JOB_RUNS = [0, 1, 2].map((r) => {
  const day = String(25 + r).padStart(2, "0");
  return {
    id: uuidFrom(40 + r),
    workspace_id: WS,
    job_type: "cur_ingestion",
    status: "success",
    started_at: `2026-05-${day}T02:00:00Z`,
    finished_at: `2026-05-${day}T02:04:00Z`,
    error_details: null,
    account_results: INGESTING.map((a) => ({
      account_id: a.aws_account_id, // 12-digit join key
      status: "success",
      record_count: rngInt(rng, 8000, 60000),
      error_details: null,
    })),
  };
});

const INGESTION_STATUSES = INGESTING.flatMap((a) =>
  DATA_SOURCES.map((ds) => ({
    workspace_id: WS,
    account_id: a.aws_account_id, // subset of the integration list
    data_source: ds,
    last_sync_at: "2026-05-27T02:04:00Z",
    last_status: "success",
    record_count: rngInt(rng, 8000, 60000),
    error_details: null,
  })),
);

export function jobHistory(limit = 20) {
  return { runs: JOB_RUNS.slice(0, limit) };
}

export function ingestionStatus() {
  return { statuses: INGESTION_STATUSES };
}

// --- inbox ------------------------------------------------------------------

export function inboxBadge() {
  return { unread_count: 7, triage_count: 3, critical_count: 1, fetched_at: "2026-05-27T12:00:00Z" };
}

// --- notifications + unread count -------------------------------------------

const NOTIFICATIONS = EVENT_TYPES.flatMap((event_type, i) =>
  [0, 1].map((j) => ({
    id: uuidFrom(60 + i * 2 + j),
    workspace_id: WS,
    event_type,
    title: `${event_type.replace(/_/g, " ")} notification`,
    message: `A ${event_type.replace(/_/g, " ")} event occurred.`,
    entity_type: "finding",
    entity_id: uuidFrom(100 + i),
    is_read: j === 1,
    created_at: `2026-05-${String(20 + i).padStart(2, "0")}T10:00:00Z`,
  })),
);

export function notifications({ unread_only = false } = {}) {
  const list = unread_only ? NOTIFICATIONS.filter((n) => !n.is_read) : NOTIFICATIONS;
  return { notifications: list, count: list.length };
}
export function unreadCount() {
  return { count: NOTIFICATIONS.filter((n) => !n.is_read).length };
}

// --- audit ------------------------------------------------------------------

export function auditConfigEvents() {
  const events = [
    { id: uuidFrom(80), workspace_id: WS, user: USERS[0].email, action: "create", entity_type: "budget", entity_id: uuidFrom(200), before_value: null, after_value: { amount: "40000.00" }, details: "Created Production monthly budget", created_at: "2026-05-01T09:00:00Z" },
    { id: uuidFrom(81), workspace_id: WS, user: USERS[1].email, action: "update", entity_type: "aws_account", entity_id: ACCOUNT_ROWS[0].id, before_value: { status: "incomplete" }, after_value: { status: "connected" }, details: "Account validated", created_at: "2026-05-05T11:30:00Z" },
  ];
  return { events, count: events.length };
}

const ACTION_EVENTS = [
  {
    id: uuidFrom(90),
    workspace_id: WS,
    actor: USERS[0].email,
    operation_type: "tag_apply",
    status: "success",
    rationale: "Apply missing CostCenter tags",
    summary: { item_count: 2, success_count: 2, failure_count: 0 },
    requested_at: "2026-05-24T14:00:00Z",
    completed_at: "2026-05-24T14:00:05Z",
  },
];

export function auditActionEvents() {
  return { events: ACTION_EVENTS, count: ACTION_EVENTS.length };
}

export function auditActionEventById(id) {
  const evt = ACTION_EVENTS.find((e) => e.id === id);
  if (!evt) return null;
  return {
    ...evt,
    items: Array.from({ length: evt.summary.item_count }, (_, i) => ({
      id: uuidFrom(95 + i),
      event_id: evt.id,
      target_type: "resource",
      target_id: `i-${String(i).padStart(12, "0")}`,
      change_key: "tag:CostCenter",
      before_value: null,
      after_value: "platform",
      status: "success",
      error_code: null,
      error_message: null,
      aws_request_id: `req-${i}`,
      attempted_at: evt.requested_at,
      completed_at: evt.completed_at,
    })),
  };
}

// --- chat -------------------------------------------------------------------

const CHAT_SESSIONS = [
  { id: uuidFrom(110), workspace_id: WS, title: "Why did EC2 spend rise?", created_at: "2026-05-20T10:00:00Z", last_activity_at: "2026-05-20T10:05:00Z" },
  { id: uuidFrom(111), workspace_id: WS, title: "Find idle resources", created_at: "2026-05-22T09:00:00Z", last_activity_at: "2026-05-22T09:03:00Z" },
];

export function chatSessions() {
  return { sessions: CHAT_SESSIONS, count: CHAT_SESSIONS.length };
}

export function chatSessionById(id) {
  const s = CHAT_SESSIONS.find((x) => x.id === id);
  if (!s) return null;
  return {
    ...s,
    messages: [
      { id: uuidFrom(120), role: "user", content: s.title, data: null, created_at: s.created_at },
      { id: uuidFrom(121), role: "assistant", content: "Here is what I found in your demo data.", data: null, created_at: s.last_activity_at },
    ],
  };
}

// --- data explorer ----------------------------------------------------------

const SAVED_QUERIES = [
  { id: uuidFrom(130), workspace_id: WS, name: "Workspaces", sql: "SELECT slug FROM workspaces", description: "Quick lookup", created_by_user_id: USERS[0].id, updated_by_user_id: USERS[0].id, created_at: "2026-05-04T00:00:00Z", updated_at: "2026-05-04T00:00:00Z" },
  { id: uuidFrom(131), workspace_id: WS, name: "Top accounts by spend", sql: "SELECT account_id, SUM(unblended_cost) FROM cost_records GROUP BY 1", description: "Spend ranking", created_by_user_id: USERS[0].id, updated_by_user_id: USERS[0].id, created_at: "2026-05-06T00:00:00Z", updated_at: "2026-05-06T00:00:00Z" },
];

export function savedQueries() {
  return { items: SAVED_QUERIES, count: SAVED_QUERIES.length };
}

const QUERY_RESULT = {
  columns: ["account_id", "total"],
  rows: ACCOUNTS.map((a) => [a.id, round2(rngInt(rng, 10000, 90000)).toFixed(2)]),
  row_count: ACCOUNTS.length,
  truncated: false,
  elapsed_ms: rngInt(rng, 3, 40),
};

export function runQueryResult() {
  return QUERY_RESULT;
}

// Internal handles for tests.
export const __platform = { ACCOUNT_ROWS, INGESTING, USERS, DEMO_WINDOW };
