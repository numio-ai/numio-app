import { describe, it, expect } from "vitest";
import { ACCOUNTS } from "./entities";
import { isDeterministic } from "./consistency";
import {
  workspaceSettings,
  usersList,
  me,
  myApiKeys,
  automationStatus,
  accountsList,
  notificationPreferences,
  jobHistory,
  ingestionStatus,
  inboxBadge,
  notifications,
  unreadCount,
  auditActionEvents,
  auditActionEventById,
  chatSessions,
  chatSessionById,
  savedQueries,
  runQueryResult,
  __platform,
} from "./platform";

const canonicalIds = new Set(ACCOUNTS.map((a) => a.id));

describe("synthetic platform — account consistency (AC2/AC3)", () => {
  it("integration list aws_account_id values are exactly the canonical accounts", () => {
    const listed = new Set(accountsList().accounts.map((a) => a.aws_account_id));
    expect(listed).toEqual(canonicalIds);
  });

  it("each integration row has a UUID id distinct from its 12-digit aws_account_id", () => {
    for (const a of accountsList().accounts) {
      expect(a.aws_account_id).toMatch(/^\d{12}$/);
      expect(a.id).not.toBe(a.aws_account_id);
    }
  });

  it("job-history account_results reference only integration-list accounts", () => {
    const listed = new Set(accountsList().accounts.map((a) => a.aws_account_id));
    for (const run of jobHistory().runs) {
      for (const ar of run.account_results) expect(listed.has(ar.account_id)).toBe(true);
    }
  });

  it("ingestion-status accounts are a subset of the integration list", () => {
    const listed = new Set(accountsList().accounts.map((a) => a.aws_account_id));
    for (const s of ingestionStatus().statuses) expect(listed.has(s.account_id)).toBe(true);
  });
});

describe("synthetic platform — shapes & wrappers", () => {
  it("list endpoints use their named array key + count", () => {
    expect(usersList().count).toBe(usersList().users.length);
    expect(myApiKeys().count).toBe(myApiKeys().keys.length);
    expect(accountsList().count).toBe(accountsList().accounts.length);
    expect(notifications().count).toBe(notifications().notifications.length);
    expect(savedQueries().count).toBe(savedQueries().items.length);
  });

  it("me() returns the admin user shape", () => {
    expect(me()).toMatchObject({ email: "demo@numio.ai", role: "admin", is_active: true });
  });

  it("workspace settings / automation / inbox badge have expected fields", () => {
    expect(workspaceSettings()).toHaveProperty("default_currency", "USD");
    expect(Array.isArray(automationStatus().domain_toggles)).toBe(true);
    expect(inboxBadge()).toHaveProperty("unread_count");
  });

  it("notification preferences cover the five canonical event types", () => {
    expect(notificationPreferences().preferences).toHaveLength(5);
  });

  it("unread count equals the number of unread notifications", () => {
    expect(unreadCount().count).toBe(notifications({ unread_only: true }).notifications.length);
  });

  it("audit action event detail items length matches summary.item_count (consumer footgun)", () => {
    const evt = auditActionEvents().events[0];
    expect(evt.summary.item_count).toBeGreaterThan(0);
    expect(auditActionEventById(evt.id).items).toHaveLength(evt.summary.item_count);
  });

  it("chat session detail includes a messages array; data explorer rows reference canonical accounts", () => {
    const s = chatSessions().sessions[0];
    expect(Array.isArray(chatSessionById(s.id).messages)).toBe(true);
    for (const row of runQueryResult().rows) expect(canonicalIds.has(row[0])).toBe(true);
  });
});

describe("synthetic platform — determinism (AC6)", () => {
  it("two generations produce byte-identical output", () => {
    expect(
      isDeterministic(() => ({
        accounts: accountsList(),
        jobs: jobHistory(),
        ingestion: ingestionStatus(),
        notifications: notifications(),
        query: runQueryResult(),
      })),
    ).toBe(true);
  });
});
