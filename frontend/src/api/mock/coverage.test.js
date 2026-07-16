import { describe, it, expect, beforeEach } from "vitest";
import { dispatchMock, hasHandler, getUnmatched, resetUnmatched } from "./registry";
import { store } from "./store";
import { setMockLatency } from "./latency";

// Authoritative list of every METHOD + path invoked by an exported API function
// across the 9 modules (extracted from src/api/*.js). Excludes the two exports
// that bypass request(): getNotificationStreamUrl (SSE) and
// getCfnTemplateDownloadUrl (download link) — spec §4.5.
const ENDPOINTS = [
  ["GET", "/api/v1/auth/me"],
  ["POST", "/api/v1/auth/login"],
  ["POST", "/api/v1/auth/logout"],
  ["POST", "/api/v1/auth/api-keys"],
  ["GET", "/api/v1/inbox/badge"],
  ["POST", "/api/v1/inbox/findings/F1/ack"],
  ["GET", "/api/v1/cost-views/total"],
  ["GET", "/api/v1/cost-views/time-series"],
  ["GET", "/api/v1/cost-views/by-dimension"],
  ["GET", "/api/v1/cost-views/trends"],
  ["GET", "/api/v1/cost-explorer/cost-by-service"],
  ["GET", "/api/v1/compliance/summary"],
  ["GET", "/api/v1/compliance/non-compliant"],
  ["GET", "/api/v1/anomalies/summary"],
  ["GET", "/api/v1/findings/summary"],
  ["GET", "/api/v1/findings"],
  ["GET", "/api/v1/findings/F1"],
  ["POST", "/api/v1/findings/F1/acknowledge"],
  ["POST", "/api/v1/findings/F1/resolve"],
  ["POST", "/api/v1/findings/F1/suppress"],
  ["GET", "/api/v1/resources"],
  ["GET", "/api/v1/budgets"],
  ["GET", "/api/v1/budgets/B1"],
  ["POST", "/api/v1/budgets"],
  ["PUT", "/api/v1/budgets/B1"],
  ["DELETE", "/api/v1/budgets/B1"],
  ["GET", "/api/v1/budgets/B1/alerts"],
  ["GET", "/api/v1/infra-policies"],
  ["GET", "/api/v1/infra-policies/P1"],
  ["POST", "/api/v1/infra-policies"],
  ["PUT", "/api/v1/infra-policies/P1"],
  ["DELETE", "/api/v1/infra-policies/P1"],
  ["GET", "/api/v1/recommendations"],
  ["GET", "/api/v1/recommendations/R1"],
  ["POST", "/api/v1/recommendations/R1/accept"],
  ["POST", "/api/v1/recommendations/R1/dismiss"],
  ["POST", "/api/v1/recommendations/R1/implement"],
  ["GET", "/api/v1/recommendations/savings/summary"],
  ["GET", "/api/v1/recommendations/savings/timeline"],
  ["GET", "/api/v1/notifications"],
  ["GET", "/api/v1/notifications/unread-count"],
  ["POST", "/api/v1/notifications/N1/read"],
  ["POST", "/api/v1/notifications/read-all"],
  ["GET", "/api/v1/audit-config-events"],
  ["GET", "/api/v1/audit-action-events"],
  ["GET", "/api/v1/audit-action-events/E1"],
  ["POST", "/api/v1/data-explorer/query"],
  ["GET", "/api/v1/data-explorer/queries"],
  ["POST", "/api/v1/data-explorer/queries"],
  ["PUT", "/api/v1/data-explorer/queries/Q1"],
  ["DELETE", "/api/v1/data-explorer/queries/Q1"],
  ["GET", "/api/v1/jobs/types"],
  ["GET", "/api/v1/jobs/history"],
  ["POST", "/api/v1/jobs/cur_ingestion/trigger"],
  ["GET", "/api/v1/jobs/ingestion-status"],
  ["GET", "/api/v1/onboarding/features"],
  ["GET", "/api/v1/onboarding/cfn-template"],
  ["GET", "/api/v1/onboarding/in-progress"],
  ["PUT", "/api/v1/onboarding/in-progress"],
  ["DELETE", "/api/v1/onboarding/in-progress"],
  ["GET", "/api/v1/tag-policies"],
  ["GET", "/api/v1/tag-policies/T1"],
  ["POST", "/api/v1/tag-policies"],
  ["PUT", "/api/v1/tag-policies/T1"],
  ["DELETE", "/api/v1/tag-policies/T1"],
  ["POST", "/api/v1/tag-policies/preview"],
  ["POST", "/api/v1/compliance/audit"],
  ["GET", "/api/v1/compliance/by-dimension"],
  ["GET", "/api/v1/compliance/trend"],
  ["GET", "/api/v1/campaigns"],
  ["GET", "/api/v1/campaigns/C1"],
  ["POST", "/api/v1/campaigns"],
  ["PATCH", "/api/v1/campaigns/C1"],
  ["PATCH", "/api/v1/campaigns/C1/resources/CR1/status"],
  ["GET", "/api/v1/campaigns/C1/progress"],
  ["GET", "/api/v1/campaigns/C1/resources/CR1/commands"],
  ["POST", "/api/v1/tags/apply/preview"],
  ["POST", "/api/v1/tags/apply"],
  ["GET", "/api/v1/aws-org-tag-policy"],
  ["POST", "/api/v1/aws-org-tag-policy/sync"],
  ["GET", "/api/v1/tags/schema/conflicts"],
  ["GET", "/api/v1/workspace/settings"],
  ["PUT", "/api/v1/workspace/settings"],
  ["GET", "/api/v1/users"],
  ["POST", "/api/v1/users"],
  ["PUT", "/api/v1/users/U1"],
  ["GET", "/api/v1/users/me/api-keys"],
  ["POST", "/api/v1/users/me/api-keys"],
  ["DELETE", "/api/v1/users/me/api-keys/K1"],
  ["GET", "/api/v1/users/api-keys"],
  ["DELETE", "/api/v1/users/api-keys/K1"],
  ["GET", "/api/v1/workspace/automation"],
  ["PUT", "/api/v1/workspace/automation/global"],
  ["PUT", "/api/v1/workspace/automation/domain"],
  ["GET", "/api/v1/workspace/info"],
  ["GET", "/api/v1/accounts"],
  ["POST", "/api/v1/accounts"],
  ["PUT", "/api/v1/accounts/A1"],
  ["POST", "/api/v1/accounts/A1/validate"],
  ["POST", "/api/v1/accounts/A1/deactivate"],
  ["DELETE", "/api/v1/accounts/A1"],
  ["GET", "/api/v1/notifications/preferences"],
  ["PUT", "/api/v1/notifications/preferences"],
];

beforeEach(() => {
  setMockLatency(0, 0);
  store.reset();
  resetUnmatched();
});

describe("endpoint coverage — parity (AC1)", () => {
  it("every invoked METHOD + path has a registered handler", () => {
    const missing = ENDPOINTS.filter(([m, p]) => !hasHandler(m, p));
    expect(missing).toEqual([]);
  });
});

describe("endpoint coverage — route walk executes with no unmatched (AC2)", () => {
  it("dispatching every endpoint with real ids resolves and records zero unmatched", async () => {
    // Resolve real ids so detail/transition handlers don't 404.
    const findingId = (await dispatchMock("/api/v1/findings")).findings[0].id;
    const budgetId = (await dispatchMock("/api/v1/budgets")).budgets[0].id;
    const recId = (await dispatchMock("/api/v1/recommendations")).recommendations[0].id;
    const policyId = (await dispatchMock("/api/v1/infra-policies")).policies[0].id;
    const notifId = (await dispatchMock("/api/v1/notifications")).notifications[0].id;
    const eventId = (await dispatchMock("/api/v1/audit-action-events")).events[0].id;
    const queryId = (await dispatchMock("/api/v1/data-explorer/queries")).items[0].id;
    const policyTagId = (await dispatchMock("/api/v1/tag-policies")).policies[0].id;
    const campaignId = (await dispatchMock("/api/v1/campaigns")).campaigns[0].id;
    const acctId = (await dispatchMock("/api/v1/accounts")).accounts[0].id;
    const userId = (await dispatchMock("/api/v1/users")).users[0].id;
    const keyId = (await dispatchMock("/api/v1/users/me/api-keys")).keys[0].id;

    const sub = (p) =>
      p
        .replace("/findings/F1", `/findings/${findingId}`)
        .replace("/budgets/B1", `/budgets/${budgetId}`)
        .replace("/recommendations/R1", `/recommendations/${recId}`)
        .replace("/infra-policies/P1", `/infra-policies/${policyId}`)
        .replace("/notifications/N1", `/notifications/${notifId}`)
        .replace("/audit-action-events/E1", `/audit-action-events/${eventId}`)
        .replace("/data-explorer/queries/Q1", `/data-explorer/queries/${queryId}`)
        .replace("/tag-policies/T1", `/tag-policies/${policyTagId}`)
        .replace("/campaigns/C1", `/campaigns/${campaignId}`)
        .replace("/accounts/A1", `/accounts/${acctId}`)
        .replace("/users/U1", `/users/${userId}`)
        .replace("/api-keys/K1", `/api-keys/${keyId}`);

    const failures = [];
    for (const [method, rawPath] of ENDPOINTS) {
      const path = sub(rawPath);
      const opts = { method };
      if (["POST", "PUT", "PATCH"].includes(method)) opts.body = JSON.stringify({ name: "x", amount: 100, paused: true, domain: "cost", label: "L", step: "customize", message: "hi", sql: "SELECT 1", status: "fixed", preferences: [] });
      try {
        await dispatchMock(path, opts);
      } catch (err) {
        failures.push(`${method} ${path}: ${err.message}`);
      }
    }
    expect(failures).toEqual([]);
    expect(getUnmatched()).toEqual([]);
  });
});

describe("endpoint coverage — writes mutate the store and reads reflect (AC3)", () => {
  it("creating a budget shows up in a subsequent list", async () => {
    const before = (await dispatchMock("/api/v1/budgets")).count;
    await dispatchMock("/api/v1/budgets", { method: "POST", body: JSON.stringify({ name: "New", amount: 5000 }) });
    expect((await dispatchMock("/api/v1/budgets")).count).toBe(before + 1);
  });

  it("acknowledging a finding flips its status on the next read", async () => {
    const f = (await dispatchMock("/api/v1/findings")).findings.find((x) => x.status === "open");
    await dispatchMock(`/api/v1/findings/${f.id}/acknowledge`, { method: "POST" });
    expect((await dispatchMock(`/api/v1/findings/${f.id}`)).status).toBe("acknowledged");
  });

  it("adding an account appears in the integration list", async () => {
    const before = (await dispatchMock("/api/v1/accounts")).count;
    await dispatchMock("/api/v1/accounts", { method: "POST", body: JSON.stringify({ aws_account_id: "555555555555", alias: "new" }) });
    const after = await dispatchMock("/api/v1/accounts");
    expect(after.count).toBe(before + 1);
    expect(after.accounts.some((a) => a.aws_account_id === "555555555555")).toBe(true);
  });

  it("marking a notification read lowers the unread count", async () => {
    const n = (await dispatchMock("/api/v1/notifications")).notifications.find((x) => !x.is_read);
    const before = (await dispatchMock("/api/v1/notifications/unread-count")).count;
    await dispatchMock(`/api/v1/notifications/${n.id}/read`, { method: "POST" });
    expect((await dispatchMock("/api/v1/notifications/unread-count")).count).toBe(before - 1);
  });
});
