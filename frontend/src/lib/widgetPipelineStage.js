/**
 * Pure stage-derivation for dashboard widget empty states.
 *
 * When a widget returns zero results for a given time range, the user
 * deserves an explanation that distinguishes "your setup isn't ready"
 * from "no data matches your filters". This module maps ingestion state
 * + account state + the widget's own date range into a single stage the
 * diagnostic card can render against.
 *
 * Stages (ordered — first match wins):
 *   no_account                        No accounts registered at all
 *   account_invalid                   Some account has a broken connection
 *   awaiting_first_export             Accounts exist, in grace window, no sync yet
 *   running                           A job is actively running
 *   failed                            Latest run for this data source is failed
 *   recently_ingested_no_data_in_range
 *                                     Ingestion is healthy but the requested
 *                                     range predates all ingested data
 *   synced                            Everything is fine — empty really means empty
 */

import { INITIAL_SYNC_GRACE_HOURS, STALE_THRESHOLD_HOURS } from "./ingestionStatus";

const INVALID_ACCOUNT_STATUSES = new Set(["disconnected", "incomplete"]);
const MS_PER_HOUR = 60 * 60 * 1000;

function hoursSince(iso, now) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / MS_PER_HOUR;
}

export function deriveWidgetStage({
  accounts,
  statuses,
  dataSource,
  startDate,
  endDate,
  now = Date.now(),
}) {
  // 1. No accounts at all
  if (!accounts || accounts.length === 0) {
    return { stage: "no_account" };
  }

  // 2. Some account has a broken connection
  const invalidAccount = accounts.find((a) => INVALID_ACCOUNT_STATUSES.has(a.status));
  if (invalidAccount) {
    return { stage: "account_invalid", account: invalidAccount };
  }

  const safeStatuses = (statuses || []).filter((s) =>
    dataSource ? s.data_source === dataSource : true
  );

  // 3. Running
  const runningStatus = safeStatuses.find(
    (s) => s.last_status === "running" || s.last_status === "pending"
  );
  if (runningStatus) return { stage: "running", statusRow: runningStatus };

  // 4. Latest is failed (for this data source)
  const successes = safeStatuses.filter((s) => s.last_status === "success" && s.last_sync_at);
  const failures = safeStatuses.filter((s) => s.last_status === "failed");
  const latestSuccess = successes
    .slice()
    .sort((a, b) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())[0];
  const latestFailure = failures
    .slice()
    .sort((a, b) => {
      const ta = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
      const tb = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
      return tb - ta;
    })[0];

  // If we have a failure and either no prior success, or the failure is
  // newer than the latest success, treat the source as failed.
  if (latestFailure) {
    const failureTs = latestFailure.last_sync_at ? new Date(latestFailure.last_sync_at).getTime() : 0;
    const successTs = latestSuccess?.last_sync_at ? new Date(latestSuccess.last_sync_at).getTime() : 0;
    if (!latestSuccess || failureTs > successTs) {
      return { stage: "failed", statusRow: latestFailure };
    }
  }

  // 5. Awaiting first export — accounts exist, inside grace window, no statuses
  //    at all for this data source
  if (safeStatuses.length === 0) {
    const recentlyConnected = accounts.some((a) => {
      const ref = a.created_at || a.registered_at;
      if (!ref) return false;
      return hoursSince(ref, now) < INITIAL_SYNC_GRACE_HOURS;
    });
    if (recentlyConnected) return { stage: "awaiting_first_export" };
  }

  // 6. "recently_ingested_no_data_in_range" would require the backend to
  //    report the earliest covered data timestamp (distinct from last_sync_at
  //    which is when the sync *ran*). Without that, any client-side
  //    heuristic is unreliable — a sync that ran 1h ago may have backfilled
  //    months of historical data. The PipelineDiagnosticCard retains a
  //    render branch for this stage so we can enable it once the backend
  //    exposes coverage metadata.
  //
  // 7. Staleness isn't a distinct stage here — widgets care about "is my
  //    empty result explained by a pipeline issue?". Stale data still
  //    shows up as a sync, so the inline freshness label (amber) already
  //    communicates this. Returning "synced" lets the widget show its own
  //    "no data for this period" empty state.
  return { stage: "synced" };
}

export { INITIAL_SYNC_GRACE_HOURS, STALE_THRESHOLD_HOURS };
