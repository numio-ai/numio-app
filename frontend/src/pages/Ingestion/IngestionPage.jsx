/**
 * Data Ingestion page — minimal, CUR-focused view.
 *
 * Layout:
 *   1. Header with refresh.
 *   2. Primary top action: "Run CUR ingestion now" (admin only).
 *   3. Single "CUR ingestion runs" table with one row per (run, account).
 *
 * Route: /ingestion  (registered in App.jsx, linked from the main app sidebar)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, RefreshCw, Play, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useIngestionStatus } from "../../context/IngestionStatusContext";
import { getJobHistory, triggerJob } from "../../api/jobs";
import ErrorMessageShared from "../../components/ErrorMessage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUR_JOB_TYPE = "cur_ingestion";
const AUTO_REFRESH_MS = 30_000;
const TRIGGER_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const TRIGGER_POLL_INTERVAL_MS = 3_000;

const STATUS_STYLES = {
  success: { bg: "#f0fdf4", color: "#15803d", dot: "#16a34a" },
  running: { bg: "#eff6ff", color: "#0369a1", dot: "#0284c7" },
  pending: { bg: "#eff6ff", color: "#0369a1", dot: "#0284c7" },
  failed: { bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626" },
  skipped: { bg: "#f3f4f6", color: "#4b5563", dot: "#9ca3af" },
  never: { bg: "#f3f4f6", color: "#4b5563", dot: "#9ca3af" },
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatRelativeTime(iso) {
  if (!iso) return "Never";
  const now = Date.now();
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Never";
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAbsoluteTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatNumber(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString();
}

export function summarizeRunResult(r) {
  if (!r) return "";
  const rows = Number(r.totalRows || 0).toLocaleString();
  const accts = r.accountCount || 0;
  const acctWord = accts === 1 ? "account" : "accounts";
  switch (r.status) {
    case "success":
      return accts === 0
        ? "Run completed. No accounts processed."
        : `Run succeeded — ${rows} rows fetched across ${accts} ${acctWord}.`;
    case "partial":
      return `Run partially succeeded — ${rows} rows fetched; ${r.failedAccounts || 0} ${
        r.failedAccounts === 1 ? "account" : "accounts"
      } failed (see rows below).`;
    case "failure":
    case "failed":
      return accts === 0
        ? "Run failed before any account was processed."
        : `Run failed for ${r.failedAccounts || accts} of ${accts} ${acctWord} (see row below).`;
    case "skipped":
      return "Run skipped — no eligible accounts.";
    default:
      return `Run finished with status: ${r.status}.`;
  }
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.never;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} aria-hidden />
      {status}
    </span>
  );
}

function ErrorInline({ message }) {
  return <ErrorMessageShared message={message} />;
}

// ---------------------------------------------------------------------------
// Flattening: one row per (run, account_result)
// ---------------------------------------------------------------------------

/**
 * Turn a list of JobRunDetail into a flat list of rows, one per account
 * involved in each run. Only CUR ingestion runs are kept. A run with no
 * account_results still produces a single row (account = "—") so that
 * skipped / failed-before-dispatch runs remain visible.
 */
export function flattenCurRuns(runs) {
  const out = [];
  for (const run of runs || []) {
    if (run.job_type !== CUR_JOB_TYPE) continue;
    const results = run.account_results || [];
    if (results.length === 0) {
      out.push({
        key: `${run.id}::none`,
        runId: run.id,
        jobType: run.job_type,
        startedAt: run.started_at,
        status: run.status,
        accountId: null,
        recordCount: null,
        errorDetails: run.error_details || null,
      });
      continue;
    }
    for (const ar of results) {
      out.push({
        key: `${run.id}::${ar.account_id}`,
        runId: run.id,
        jobType: run.job_type,
        startedAt: run.started_at,
        status: ar.status || run.status,
        accountId: ar.account_id,
        recordCount: ar.record_count,
        errorDetails: ar.error_details || run.error_details || null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CUR runs table
// ---------------------------------------------------------------------------

function CurRunsTable({ rows, accounts, onLoadMore, loadingMore, canLoadMore }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const accountById = useMemo(() => {
    const m = new Map();
    (accounts || []).forEach((a) => m.set(a.aws_account_id, a));
    return m;
  }, [accounts]);

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!rows || rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "12px 0" }}>
        No CUR ingestion runs yet. Trigger one above to populate this list.
      </p>
    );
  }

  return (
    <div>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-inset)", borderBottom: "1px solid var(--border)" }}>
              <th style={thStyle}>JOB</th>
              <th style={thStyle}>STARTED</th>
              <th style={thStyle}>STATUS</th>
              <th style={thStyle}>AWS ACCOUNT</th>
              <th style={{ ...thStyle, textAlign: "right" }}>ROWS FETCHED</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = expanded.has(r.key);
              const hasError = Boolean(r.errorDetails);
              const account = r.accountId ? accountById.get(r.accountId) : null;
              return (
                <React.Fragment key={r.key}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <code style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.jobType}</code>
                    </td>
                    <td style={tdStyle} title={formatAbsoluteTime(r.startedAt)}>
                      {formatRelativeTime(r.startedAt)}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={tdStyle}>
                      {r.accountId ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: "var(--text)", fontWeight: 500 }}>
                            {account?.alias || r.accountId}
                          </span>
                          <code style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.accountId}</code>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNumber(r.recordCount)}</td>
                    <td style={tdStyle}>
                      {hasError ? (
                        <button
                          type="button"
                          onClick={() => toggle(r.key)}
                          style={linkButtonStyle}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {isOpen ? "Hide error" : "Show error"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {hasError && isOpen && (
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-inset)" }}>
                      <td colSpan={6} style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <pre
                            style={{
                              fontSize: 12,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              color: "var(--danger, #dc2626)",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              margin: 0,
                              flex: 1,
                            }}
                          >
                            {r.errorDetails}
                          </pre>
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(r.errorDetails).catch(() => {});
                              }
                            }}
                            className="btn btn--ghost btn--sm"
                            style={{ flexShrink: 0 }}
                          >
                            Copy
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {canLoadMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle = {
  padding: "12px 16px",
  fontSize: 13,
  color: "var(--text)",
  verticalAlign: "top",
};

const linkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  color: "var(--primary, #3b82f6)",
  cursor: "pointer",
  padding: 0,
  fontSize: 12,
  fontWeight: 500,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IngestionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const {
    accounts,
    loading: statusLoading,
    error: statusError,
    lastFetchedAt,
    refresh: refreshStatus,
  } = useIngestionStatus();

  const [history, setHistory] = useState([]);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [running, setRunning] = useState(false);
  const [triggerError, setTriggerError] = useState(null);
  // Explicit feedback surface for the most recent on-demand run.
  // Shape: { status, totalRows, accountCount, failedAccounts, runId } | null
  const [lastRunResult, setLastRunResult] = useState(null);

  const loadHistory = useCallback(
    async (opts = {}) => {
      const { silent = false, limit = historyLimit } = opts;
      try {
        if (!silent) setPageLoading(true);
        setPageError(null);
        const historyRes = await getJobHistory(limit);
        setHistory(historyRes?.runs || []);
      } catch (e) {
        setPageError(e.message || "Failed to load ingestion data");
      } finally {
        if (!silent) setPageLoading(false);
      }
    },
    [historyLimit]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (pageLoading) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadHistory({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [pageLoading, loadHistory]);

  const curRows = useMemo(() => flattenCurRuns(history), [history]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const newLimit = historyLimit + 20;
      const res = await getJobHistory(newLimit);
      setHistory(res?.runs || []);
      setHistoryLimit(newLimit);
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = pageLoading || statusLoading;
  const error = pageError || statusError;

  const handleRun = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Run CUR ingestion for all connected accounts now?")) return;
    setRunning(true);
    setTriggerError(null);
    setLastRunResult(null);
    try {
      const trigger = await triggerJob(CUR_JOB_TYPE);

      // The backend trigger endpoint runs the job synchronously and returns
      // the terminal status in the response. Only poll as a fallback in case
      // that contract changes to async dispatch ("running" / "pending").
      let finalStatus = trigger.status;
      let finalRun = null;
      const limit = Math.max(20, historyLimit);

      if (finalStatus === "running" || finalStatus === "pending") {
        const deadline = Date.now() + TRIGGER_POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, TRIGGER_POLL_INTERVAL_MS));
          const h = await getJobHistory(limit);
          setHistory(h?.runs || []);
          finalRun = (h?.runs || []).find((r) => r.id === trigger.job_run_id);
          if (finalRun && finalRun.status !== "running" && finalRun.status !== "pending") {
            finalStatus = finalRun.status;
            break;
          }
        }
      }

      // Pull the final history snapshot so the row and feedback are consistent.
      const h = await getJobHistory(limit);
      setHistory(h?.runs || []);
      finalRun = (h?.runs || []).find((r) => r.id === trigger.job_run_id) || finalRun;
      refreshStatus();

      const accountResults = finalRun?.account_results || [];
      const totalRows = accountResults.reduce((s, a) => s + (a.record_count || 0), 0);
      const failedAccounts = accountResults.filter((a) => a.status === "failed" || a.status === "failure").length;
      setLastRunResult({
        status: finalStatus,
        totalRows,
        accountCount: accountResults.length,
        failedAccounts,
        runId: trigger.job_run_id,
      });
    } catch (e) {
      setTriggerError(e.message || "Failed to trigger job");
    } finally {
      setRunning(false);
    }
  };

  const noAccountsConfigured = !loading && accounts.length === 0;

  return (
    <div className="pageContent" style={{ padding: "32px 32px 64px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 }}>Data Ingestion</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Health and history of CUR ingestion jobs for this workspace.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastFetchedAt && (
            <span
              style={{ fontSize: 11, color: "var(--text-tertiary)" }}
              title={lastFetchedAt.toLocaleString()}
            >
              Updated {formatRelativeTime(lastFetchedAt.toISOString())}
            </span>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              refreshStatus();
              loadHistory({ silent: true });
            }}
            disabled={loading}
            aria-label="Refresh ingestion status"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && !loading && <ErrorInline message={error} />}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading ingestion status…</p>
      ) : noAccountsConfigured ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ padding: "48px 24px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-inset)", textAlign: "center" }}
        >
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
            No AWS accounts connected. Connect an account to start ingesting cost data.
          </p>
          <Link to="/settings?tab=integrations" className="btn btn--primary btn--sm" style={{ textDecoration: "none" }}>
            Go to Integrations <ExternalLink size={12} style={{ marginLeft: 4 }} />
          </Link>
        </div>
      ) : (
        <>
          {/* Primary run-now action */}
          <section
            style={{
              marginBottom: 24,
              padding: "16px 20px",
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--bg-inset)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                Run CUR ingestion on demand
              </p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                Fetches the latest Cost &amp; Usage Report from every connected AWS account.
                {!isAdmin && " Admin only."}
              </p>
              {running && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                  Running CUR ingestion…
                </p>
              )}
              {!running && lastRunResult && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}
                >
                  <StatusBadge status={lastRunResult.status} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {summarizeRunResult(lastRunResult)}
                  </span>
                </div>
              )}
              {triggerError && (
                <p style={{ fontSize: 12, color: "var(--danger, #dc2626)", marginTop: 6 }}>{triggerError}</p>
              )}
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRun}
              disabled={!isAdmin || running}
              title={!isAdmin ? "Admin only" : "Run CUR ingestion now"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: !isAdmin || running ? "not-allowed" : "pointer",
                opacity: !isAdmin && !running ? 0.6 : 1,
              }}
            >
              {running ? (
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Play size={16} />
              )}
              {running ? "Running…" : "Run CUR ingestion now"}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </section>

          {/* CUR runs table */}
          <section>
            <p style={sectionHeaderStyle}>CUR INGESTION RUNS</p>
            <CurRunsTable
              rows={curRows}
              accounts={accounts}
              onLoadMore={handleLoadMore}
              loadingMore={loadingMore}
              canLoadMore={history.length >= historyLimit}
            />
          </section>
        </>
      )}
    </div>
  );
}

const sectionHeaderStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 12,
};
