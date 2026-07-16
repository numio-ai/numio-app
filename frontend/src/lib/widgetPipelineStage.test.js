import { describe, it, expect } from "vitest";
import { deriveWidgetStage } from "./widgetPipelineStage";

const now = new Date("2026-04-16T12:00:00Z").getTime();
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();

const acct = (id, extras = {}) => ({
  aws_account_id: id,
  alias: `Account ${id}`,
  status: "connected",
  created_at: hoursAgo(30 * 24),
  ...extras,
});

const status = (account_id, data_source, last_status, last_sync_at, record_count = 0) => ({
  account_id,
  data_source,
  last_status,
  last_sync_at,
  record_count,
});

describe("deriveWidgetStage", () => {
  it("returns 'no_account' when there are no accounts", () => {
    const out = deriveWidgetStage({ accounts: [], statuses: [], dataSource: "cur", now });
    expect(out.stage).toBe("no_account");
  });

  it("returns 'account_invalid' when any account is disconnected", () => {
    const accounts = [acct("111", { status: "disconnected" })];
    const out = deriveWidgetStage({ accounts, statuses: [], dataSource: "cur", now });
    expect(out.stage).toBe("account_invalid");
  });

  it("returns 'running' when any ingestion job is in progress for this data source", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "running", null)];
    const out = deriveWidgetStage({ accounts, statuses, dataSource: "cur", now });
    expect(out.stage).toBe("running");
  });

  it("returns 'failed' when the latest status for the data source is a failure", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "failed", hoursAgo(1))];
    const out = deriveWidgetStage({ accounts, statuses, dataSource: "cur", now });
    expect(out.stage).toBe("failed");
  });

  it("prefers most-recent: latest success after a prior failure returns synced", () => {
    const accounts = [acct("111")];
    const statuses = [
      status("111", "cur", "failed", hoursAgo(5)),
      status("111", "cur", "success", hoursAgo(1), 100),
    ];
    const out = deriveWidgetStage({ accounts, statuses, dataSource: "cur", now });
    expect(out.stage).toBe("synced");
  });

  it("returns 'awaiting_first_export' for a brand-new account with no status yet", () => {
    const accounts = [acct("111", { created_at: hoursAgo(2) })];
    const out = deriveWidgetStage({ accounts, statuses: [], dataSource: "cur", now });
    expect(out.stage).toBe("awaiting_first_export");
  });

  it("returns 'synced' for an old account with no status (pipeline isn't blocking the empty result)", () => {
    const accounts = [acct("111", { created_at: hoursAgo(49) })];
    const out = deriveWidgetStage({ accounts, statuses: [], dataSource: "cur", now });
    // Outside grace window + no statuses: we treat it as synced-but-maybe-empty.
    // Callers decide whether to show a "no data for period" empty state or
    // present a stronger explanation at the page level.
    expect(out.stage).toBe("synced");
  });

  it("returns 'synced' when accounts are healthy (out-of-range detection deferred to backend)", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "success", hoursAgo(1), 100)];
    const out = deriveWidgetStage({
      accounts,
      statuses,
      dataSource: "cur",
      startDate: "2024-01-01",
      endDate: "2024-06-01",
      now,
    });
    expect(out.stage).toBe("synced");
  });

  it("filters statuses by dataSource", () => {
    const accounts = [acct("111")];
    const statuses = [
      status("111", "cost_explorer", "failed", hoursAgo(1)),
      status("111", "cur", "success", hoursAgo(1), 100),
    ];
    expect(
      deriveWidgetStage({ accounts, statuses, dataSource: "cur", now }).stage
    ).toBe("synced");
    expect(
      deriveWidgetStage({ accounts, statuses, dataSource: "cost_explorer", now }).stage
    ).toBe("failed");
  });
});
