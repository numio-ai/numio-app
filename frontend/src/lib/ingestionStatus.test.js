import { describe, it, expect } from "vitest";
import {
  deriveDataPillState,
  mostRecentFailure,
  recentlySyncedEntries,
  freshnessForSource,
  failingAccountCount,
  STALE_THRESHOLD_HOURS,
  INITIAL_SYNC_GRACE_HOURS,
} from "./ingestionStatus";

const now = new Date("2026-04-16T12:00:00Z").getTime();
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();

const acct = (aws_account_id, extras = {}) => ({
  aws_account_id,
  alias: `Account ${aws_account_id}`,
  created_at: hoursAgo(10 * 24),
  ...extras,
});

const status = (account_id, data_source, last_status, last_sync_at, record_count = 0, error_details = null) => ({
  workspace_id: "ws1",
  account_id,
  data_source,
  last_sync_at,
  last_status,
  record_count,
  error_details,
});

describe("deriveDataPillState", () => {
  it("returns 'not_configured' when there are no accounts", () => {
    expect(deriveDataPillState({ statuses: [], accounts: [] })).toBe("not_configured");
    expect(deriveDataPillState({ statuses: null, accounts: null })).toBe("not_configured");
  });

  it("returns 'issue' if any account has a failed last status", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "failed", hoursAgo(1), 0, "AccessDenied")];
    expect(deriveDataPillState({ statuses, accounts, now })).toBe("issue");
  });

  it("returns 'syncing' when a job is currently running", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "running", null)];
    expect(deriveDataPillState({ statuses, accounts, now })).toBe("syncing");
  });

  it("returns 'syncing' for freshly-connected accounts still in grace window with no status yet", () => {
    const accounts = [acct("111", { created_at: hoursAgo(2) })];
    expect(deriveDataPillState({ statuses: [], accounts, now })).toBe("syncing");
  });

  it("returns 'delayed' for accounts past the grace window with no status", () => {
    const accounts = [acct("111", { created_at: hoursAgo(INITIAL_SYNC_GRACE_HOURS + 1) })];
    expect(deriveDataPillState({ statuses: [], accounts, now })).toBe("delayed");
  });

  it("returns 'delayed' when last sync is older than STALE_THRESHOLD_HOURS", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "success", hoursAgo(STALE_THRESHOLD_HOURS + 1), 100)];
    expect(deriveDataPillState({ statuses, accounts, now })).toBe("delayed");
  });

  it("returns 'synced' when everything is fresh and successful", () => {
    const accounts = [acct("111")];
    const statuses = [status("111", "cur", "success", hoursAgo(1), 100)];
    expect(deriveDataPillState({ statuses, accounts, now })).toBe("synced");
  });

  it("prefers 'issue' over 'delayed' when some accounts are stale and others failed", () => {
    const accounts = [acct("111"), acct("222")];
    const statuses = [
      status("111", "cur", "failed", hoursAgo(2), 0, "boom"),
      status("222", "cur", "success", hoursAgo(STALE_THRESHOLD_HOURS + 2), 10),
    ];
    expect(deriveDataPillState({ statuses, accounts, now })).toBe("issue");
  });
});

describe("mostRecentFailure", () => {
  it("returns null when no failures", () => {
    expect(mostRecentFailure([])).toBeNull();
    expect(mostRecentFailure([status("111", "cur", "success", hoursAgo(1))])).toBeNull();
  });

  it("returns the most-recent failed status", () => {
    const a = status("111", "cur", "failed", hoursAgo(5), 0, "old");
    const b = status("222", "cur", "failed", hoursAgo(1), 0, "new");
    expect(mostRecentFailure([a, b])).toEqual(b);
  });
});

describe("recentlySyncedEntries", () => {
  it("sorts by last_sync_at desc and respects the limit", () => {
    const entries = [
      status("111", "cur", "success", hoursAgo(3)),
      status("222", "cur", "success", hoursAgo(1)),
      status("333", "cur", "success", hoursAgo(2)),
    ];
    const out = recentlySyncedEntries(entries, 2);
    expect(out.map((e) => e.account_id)).toEqual(["222", "333"]);
  });

  it("excludes entries without last_sync_at", () => {
    const entries = [
      status("111", "cur", "never", null),
      status("222", "cur", "success", hoursAgo(1)),
    ];
    expect(recentlySyncedEntries(entries).map((e) => e.account_id)).toEqual(["222"]);
  });
});

describe("freshnessForSource", () => {
  it("returns neutral result when nothing matches", () => {
    expect(freshnessForSource([], "cur", now)).toEqual({
      lastSyncAt: null,
      hoursAgo: null,
      isStale: false,
      isFailed: false,
      status: "never",
    });
  });

  it("prefers successful syncs over failed when computing freshness", () => {
    const res = freshnessForSource(
      [
        status("111", "cur", "failed", hoursAgo(1)),
        status("222", "cur", "success", hoursAgo(3)),
      ],
      "cur",
      now
    );
    expect(res.lastSyncAt).toBe(hoursAgo(3));
    expect(res.isFailed).toBe(false);
  });

  it("marks freshness as stale past the threshold", () => {
    const res = freshnessForSource(
      [status("111", "cur", "success", hoursAgo(STALE_THRESHOLD_HOURS + 1))],
      "cur",
      now
    );
    expect(res.isStale).toBe(true);
  });

  it("filters by dataSource when supplied", () => {
    const res = freshnessForSource(
      [
        status("111", "cur", "success", hoursAgo(5)),
        status("111", "cost_explorer", "success", hoursAgo(1)),
      ],
      "cost_explorer",
      now
    );
    expect(res.dataSource).toBe("cost_explorer");
  });
});

describe("failingAccountCount", () => {
  it("returns unique count of accounts currently failing", () => {
    expect(
      failingAccountCount([
        status("111", "cur", "failed", hoursAgo(1)),
        status("111", "cost_explorer", "failed", hoursAgo(1)),
        status("222", "cur", "success", hoursAgo(1)),
      ])
    ).toBe(1);
  });

  it("handles empty input", () => {
    expect(failingAccountCount([])).toBe(0);
    expect(failingAccountCount(null)).toBe(0);
  });
});
