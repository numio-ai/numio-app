/**
 * Pure derivation helpers for ingestion status.
 *
 * Kept framework-free so they can be unit-tested without rendering React
 * and so any consumer (top-bar pill, banner, freshness labels, diagnostic
 * card) derives consistent state from the same rules.
 *
 * Thresholds are exported as named constants so tuning happens in one
 * place. If product decides to make them server-driven later, swap the
 * constants for a configuration fetch without touching consumers.
 */

/** Data source is considered stale after this many hours since last success. */
export const STALE_THRESHOLD_HOURS = 26;

/** Newly-connected accounts are treated as "syncing" rather than "delayed"
 * for this many hours after registration, even if no sync has happened yet. */
export const INITIAL_SYNC_GRACE_HOURS = 48;

const MS_PER_HOUR = 60 * 60 * 1000;

function hoursSince(iso, now = Date.now()) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / MS_PER_HOUR;
}

/**
 * Derive a single aggregate "Data" pill state from the ingestion-status
 * response plus the account list.
 *
 * Decision tree (first match wins):
 *   1. No accounts at all -> "not_configured"
 *   2. Any account has a failed last-status -> "issue"
 *   3. Any account/source is in "running" state OR the account was
 *      registered < INITIAL_SYNC_GRACE_HOURS ago and has never synced
 *      -> "syncing"
 *   4. Any account/source has last_sync_at older than
 *      STALE_THRESHOLD_HOURS -> "delayed"
 *   5. Otherwise -> "synced"
 */
export function deriveDataPillState({ statuses, accounts, now = Date.now() }) {
  if (!accounts || accounts.length === 0) return "not_configured";

  const safeStatuses = statuses || [];

  // 1. Any hard failure
  if (safeStatuses.some((s) => s.last_status === "failed")) return "issue";

  // 2. Any in-progress run
  if (safeStatuses.some((s) => s.last_status === "running" || s.last_status === "pending")) {
    return "syncing";
  }

  // 3. Newly-connected accounts still inside the grace window with no sync yet
  const recentlyConnectedAwaiting = accounts.some((a) => {
    const hasAnyStatus = safeStatuses.some((s) => s.account_id === a.aws_account_id);
    if (hasAnyStatus) return false;
    // Use created_at when available; otherwise fall back to the oldest
    // ingestion timestamp we could find. If neither is present we must
    // assume the account is older than the grace window.
    const ref = a.created_at || a.registered_at;
    if (!ref) return false;
    return hoursSince(ref, now) < INITIAL_SYNC_GRACE_HOURS;
  });
  if (recentlyConnectedAwaiting) return "syncing";

  // 4. Never synced (outside grace window) counts as an issue for UX — the
  // user expects data within a reasonable window. Treat as "delayed"
  // rather than "issue" to avoid over-shouting; hard failures keep "issue".
  const anyNeverSynced = accounts.some((a) => {
    return !safeStatuses.some((s) => s.account_id === a.aws_account_id && s.last_sync_at);
  });
  if (anyNeverSynced) return "delayed";

  // 5. Any stale
  const anyStale = safeStatuses.some(
    (s) => s.last_sync_at && hoursSince(s.last_sync_at, now) > STALE_THRESHOLD_HOURS
  );
  if (anyStale) return "delayed";

  return "synced";
}

/**
 * Find the most recent failed ingestion-status row (for surfacing in the
 * pill popover / global banner). Returns null when none.
 */
export function mostRecentFailure(statuses) {
  const failures = (statuses || []).filter((s) => s.last_status === "failed");
  if (failures.length === 0) return null;
  return failures
    .slice()
    .sort((a, b) => {
      const ta = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
      const tb = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
      return tb - ta;
    })[0];
}

/**
 * Return the top-N most recently synced (per-account × per-source) entries
 * for the compact popover summary.
 */
export function recentlySyncedEntries(statuses, limit = 5) {
  return (statuses || [])
    .filter((s) => s.last_sync_at)
    .slice()
    .sort((a, b) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())
    .slice(0, limit);
}

/**
 * Per-data-source freshness — used by dashboard widget labels (Task 05).
 * If no source is passed, returns the most recent sync across all sources.
 */
export function freshnessForSource(statuses, dataSource, now = Date.now()) {
  const safe = statuses || [];
  const matching = dataSource
    ? safe.filter((s) => s.data_source === dataSource)
    : safe;
  if (matching.length === 0) {
    return { lastSyncAt: null, hoursAgo: null, isStale: false, isFailed: false, status: "never" };
  }
  // Prefer successful syncs; fall back to latest of any kind.
  const successes = matching.filter((s) => s.last_status === "success" && s.last_sync_at);
  const pool = successes.length > 0 ? successes : matching;
  const latest = pool
    .slice()
    .sort((a, b) => {
      const ta = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
      const tb = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
      return tb - ta;
    })[0];
  const hoursAgo = latest.last_sync_at ? hoursSince(latest.last_sync_at, now) : null;
  return {
    lastSyncAt: latest.last_sync_at || null,
    hoursAgo,
    isStale: hoursAgo != null && hoursAgo > STALE_THRESHOLD_HOURS,
    isFailed: latest.last_status === "failed",
    status: latest.last_status || "never",
    dataSource: latest.data_source,
  };
}

/** Count accounts with a currently-failing ingestion (used by Task 07 banner). */
export function failingAccountCount(statuses) {
  const ids = new Set();
  (statuses || []).forEach((s) => {
    if (s.last_status === "failed") ids.add(s.account_id);
  });
  return ids.size;
}
