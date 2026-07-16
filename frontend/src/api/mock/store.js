/**
 * In-memory, session-scoped store for mock mode (spec §3.4).
 *
 * Seeded (deep-cloned) from the synthetic datasets on load. Writes mutate this
 * store; subsequent reads in the same session reflect the change. State resets
 * on page reload — no persistence to disk, localStorage, or a backend.
 *
 * Pure aggregation reads (cost views, savings, compliance scores) read straight
 * from the synthetic builders — they do not change on writes. Entity
 * collections that write flows mutate (accounts, findings, recommendations,
 * budgets, notifications, saved queries, chat, onboarding, inbox) live here.
 */
import * as cost from "../../mocks/synthetic/cost";
import * as gov from "../../mocks/synthetic/governance";
import * as platform from "../../mocks/synthetic/platform";

const clone = (v) => JSON.parse(JSON.stringify(v));
let seq = 9000;
const nextId = () => `e0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function seed() {
  return {
    me: platform.me(),
    inbox: platform.inboxBadge(),
    accounts: clone(platform.accountsList().accounts),
    findings: clone(gov.findingsList().findings),
    recommendations: clone(gov.recommendationsList().recommendations),
    budgets: clone(cost.budgetsList().budgets),
    notifications: clone(platform.notifications().notifications),
    savedQueries: clone(platform.savedQueries().items),
    chatSessions: clone(platform.chatSessions().sessions),
    onboardingInProgress: platform.onboardingInProgress(),
    apiKeys: clone(platform.myApiKeys().keys),
    users: clone(platform.usersList().users),
    workspaceSettings: platform.workspaceSettings(),
    automation: platform.automationStatus(),
    notificationPreferences: platform.notificationPreferences(),
    tagPolicies: clone(gov.tagPoliciesList().policies),
  };
}

let state = seed();

export const store = {
  reset() {
    state = seed();
    seq = 9000;
  },
  raw: () => state,

  // --- auth / inbox ------------------------------------------------------
  me: () => ({ ...state.me }),
  inboxBadge: () => ({ ...state.inbox }),
  ackInboxFinding(findingId) {
    if (state.inbox.unread_count > 0) state.inbox.unread_count -= 1;
    return { finding_id: findingId, acknowledged: true, new_unread_count: state.inbox.unread_count };
  },

  // --- findings ----------------------------------------------------------
  findings: () => state.findings,
  finding(id) {
    return state.findings.find((f) => f.id === id) || null;
  },
  transitionFinding(id, toStatus) {
    const f = state.findings.find((x) => x.id === id);
    if (!f) return null;
    f.status = toStatus;
    if (toStatus === "acknowledged" && state.inbox.unread_count > 0) state.inbox.unread_count -= 1;
    f.updated_at = "2026-05-27T12:00:00Z";
    return f;
  },

  // --- recommendations ---------------------------------------------------
  recommendations: () => state.recommendations,
  recommendation(id) {
    return state.recommendations.find((r) => r.id === id) || null;
  },
  transitionRecommendation(id, toStatus, stampField) {
    const r = state.recommendations.find((x) => x.id === id);
    if (!r) return null;
    r.status = toStatus;
    if (stampField) r[stampField] = "2026-05-27T12:00:00Z";
    return r;
  },

  // --- budgets -----------------------------------------------------------
  budgets: () => state.budgets,
  budget(id) {
    return state.budgets.find((b) => b.id === id) || null;
  },
  createBudget(data) {
    const b = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      name: data.name || "New budget",
      amount: String(data.amount ?? "0.00"),
      currency: data.currency || "USD",
      period: data.period || "monthly",
      dimension: data.dimension || "environment",
      dimension_value: data.dimension_value || "production",
      alert_thresholds: data.alert_thresholds || [50, 80, 100],
      created_at: "2026-05-27T12:00:00Z",
      updated_at: "2026-05-27T12:00:00Z",
      current_spend: "0.00",
      percentage_consumed: "0.00",
      projected_spend: "0.00",
      remaining: String(data.amount ?? "0.00"),
      status: "on_track",
      days_elapsed: 27,
      days_in_period: 31,
      top_cost_drivers: [],
    };
    state.budgets.push(b);
    return b;
  },
  updateBudget(id, data) {
    const b = state.budgets.find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, data, { updated_at: "2026-05-27T12:00:00Z" });
    if (data.amount !== undefined) b.amount = String(data.amount);
    return b;
  },
  deleteBudget(id) {
    state.budgets = state.budgets.filter((b) => b.id !== id);
  },

  // --- notifications -----------------------------------------------------
  notifications: () => state.notifications,
  markNotificationRead(id) {
    const n = state.notifications.find((x) => x.id === id);
    if (n) n.is_read = true;
    return n || { id, is_read: true };
  },
  markAllNotificationsRead() {
    const updated = state.notifications.filter((n) => !n.is_read).length;
    state.notifications.forEach((n) => (n.is_read = true));
    return { updated };
  },

  // --- accounts ----------------------------------------------------------
  accounts: () => state.accounts,
  account(id) {
    return state.accounts.find((a) => a.id === id) || null;
  },
  addAccount(data) {
    const a = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      aws_account_id: data.aws_account_id || "999999999999",
      alias: data.alias || "new-account",
      role_arn: data.role_arn || `arn:aws:iam::${data.aws_account_id || "999999999999"}:role/NumioReadRole`,
      tag_writer_role_arn: null,
      aws_access_key_id_hint: null,
      external_id: data.external_id || null,
      status: "connected",
      environment_label: data.environment_label || "production",
      status_message: null,
      cur_s3_bucket: data.cur_s3_bucket || null,
      cur_s3_prefix: data.cur_s3_prefix || null,
      cur_report_name: data.cur_report_name || null,
      cur_managed_by_numio: false,
      created_at: "2026-05-27T12:00:00Z",
      updated_at: "2026-05-27T12:00:00Z",
    };
    state.accounts.push(a);
    return a;
  },
  updateAccount(id, data) {
    const a = state.accounts.find((x) => x.id === id);
    if (!a) return null;
    Object.assign(a, data, { updated_at: "2026-05-27T12:00:00Z" });
    return a;
  },
  setAccountStatus(id, status) {
    const a = state.accounts.find((x) => x.id === id);
    if (a) a.status = status;
    return a;
  },
  deleteAccount(id) {
    state.accounts = state.accounts.filter((a) => a.id !== id);
  },

  // --- saved queries -----------------------------------------------------
  savedQueries: () => state.savedQueries,
  createSavedQuery({ name, sql, description }) {
    const q = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      name,
      sql,
      description: description ?? null,
      created_by_user_id: state.me.id,
      updated_by_user_id: state.me.id,
      created_at: "2026-05-27T12:00:00Z",
      updated_at: "2026-05-27T12:00:00Z",
    };
    state.savedQueries.push(q);
    return q;
  },
  updateSavedQuery(id, patch) {
    const q = state.savedQueries.find((x) => x.id === id);
    if (!q) return null;
    Object.assign(q, patch, { updated_at: "2026-05-27T12:00:00Z" });
    return q;
  },
  deleteSavedQuery(id) {
    state.savedQueries = state.savedQueries.filter((q) => q.id !== id);
  },

  // --- chat --------------------------------------------------------------
  chatSessions: () => state.chatSessions,
  chatSession(id) {
    const s = state.chatSessions.find((x) => x.id === id);
    if (!s) return null;
    const messages = s.messages || [
      { id: `${s.id}-m1`, role: "user", content: s.title || "Hello", data: null, created_at: s.created_at },
      { id: `${s.id}-m2`, role: "assistant", content: "Here is what I found in your demo data.", data: null, created_at: s.last_activity_at },
    ];
    return { ...s, messages };
  },
  createChatSession(title) {
    const s = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      title: title || null,
      created_at: "2026-05-27T12:00:00Z",
      last_activity_at: "2026-05-27T12:00:00Z",
      messages: [],
    };
    state.chatSessions.unshift(s);
    return { id: s.id, workspace_id: s.workspace_id, title: s.title, created_at: s.created_at, last_activity_at: s.last_activity_at };
  },
  deleteChatSession(id) {
    state.chatSessions = state.chatSessions.filter((s) => s.id !== id);
  },
  addChatMessage(sessionId, message) {
    const s = state.chatSessions.find((x) => x.id === sessionId);
    const reply = { message: "Here is what I found in your demo data.", data: null, message_id: nextId() };
    if (s) {
      s.messages = s.messages || [];
      s.messages.push({ id: nextId(), role: "user", content: message, data: null, created_at: "2026-05-27T12:00:00Z" });
      s.messages.push({ id: reply.message_id, role: "assistant", content: reply.message, data: null, created_at: "2026-05-27T12:00:01Z" });
      s.last_activity_at = "2026-05-27T12:00:01Z";
    }
    return reply;
  },

  // --- onboarding --------------------------------------------------------
  onboardingInProgress: () => state.onboardingInProgress,
  putOnboardingInProgress({ label, step }) {
    state.onboardingInProgress = {
      label,
      step,
      created_at: state.onboardingInProgress?.created_at || "2026-05-27T12:00:00Z",
      updated_at: "2026-05-27T12:00:00Z",
    };
    return state.onboardingInProgress;
  },
  deleteOnboardingInProgress() {
    state.onboardingInProgress = null;
  },

  // --- api keys ----------------------------------------------------------
  apiKeys: () => state.apiKeys,
  createApiKey(name) {
    const k = { id: nextId(), name: name || "key", key_prefix: "numio_nw", created_at: "2026-05-27T12:00:00Z" };
    state.apiKeys.push({ ...k, last_used_at: null, user_id: state.me.id, user_email: state.me.email });
    return { ...k, key: `numio_nw_${nextId().replace(/-/g, "")}` };
  },
  revokeApiKey(id) {
    state.apiKeys = state.apiKeys.filter((k) => k.id !== id);
  },

  // --- users -------------------------------------------------------------
  users: () => state.users,
  inviteUser(data) {
    const u = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      email: data.email || "new@numio.ai",
      name: data.name || data.email || "New User",
      role: data.role || "member",
      is_active: true,
    };
    state.users.push(u);
    return u;
  },
  updateUser(id, data) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, data);
    return u;
  },

  // --- workspace settings / automation / preferences --------------------
  workspaceSettings: () => state.workspaceSettings,
  updateWorkspaceSettings(data) {
    state.workspaceSettings = { ...state.workspaceSettings, ...data, updated_at: "2026-05-27T12:00:00Z" };
    return state.workspaceSettings;
  },
  automation: () => state.automation,
  setGlobalToggle(paused) {
    state.automation.automation_paused = !!paused;
    return state.automation;
  },
  setDomainToggle(domain, paused) {
    const t = state.automation.domain_toggles.find((d) => d.domain === domain);
    if (t) t.paused = !!paused;
    else state.automation.domain_toggles.push({ domain, paused: !!paused });
    return state.automation;
  },
  notificationPreferences: () => state.notificationPreferences,
  updateNotificationPreferences(prefs) {
    if (prefs?.preferences) state.notificationPreferences = { preferences: prefs.preferences };
    return state.notificationPreferences;
  },

  // --- tag policies ------------------------------------------------------
  tagPolicies: () => state.tagPolicies,
  tagPolicy(id) {
    return state.tagPolicies.find((p) => p.id === id) || null;
  },
  createTagPolicy(data) {
    const p = {
      id: nextId(),
      workspace_id: state.me.workspace_id || "00000000-0000-0000-0000-000000000000",
      name: data.name || "New policy",
      description: data.description ?? null,
      priority: data.priority ?? 1,
      is_active: data.is_active ?? true,
      created_by: state.me.email,
      updated_by: state.me.email,
      created_at: "2026-05-27T12:00:00Z",
      updated_at: "2026-05-27T12:00:00Z",
      rules: data.rules || [],
    };
    state.tagPolicies.push(p);
    return p;
  },
  updateTagPolicy(id, data) {
    const p = state.tagPolicies.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, data, { updated_at: "2026-05-27T12:00:00Z" });
    return p;
  },
  deleteTagPolicy(id) {
    state.tagPolicies = state.tagPolicies.filter((p) => p.id !== id);
  },
};
