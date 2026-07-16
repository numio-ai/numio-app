import React, { useState, useEffect, useCallback } from "react";
import { getAuditActionEvents, getAuditActionEvent } from "../api/dashboard";

const OPERATION_TYPES = ["tag_apply", "tag_remove"];
const STATUS_COLORS = {
  success: { color: "#166534", bg: "#dcfce7" },
  partial_failure: { color: "#92400e", bg: "#fef3c7" },
  failure: { color: "#991b1b", bg: "#fee2e2" },
  in_progress: { color: "#1e40af", bg: "#dbeafe" },
  pending: { color: "#475569", bg: "#f1f5f9" },
};

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg }}>
      {status}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Operations tab: lists action audit events (operations Numio performed against
 * external systems, e.g. tag writes). Clicking a row opens a drawer with the
 * parent event and all child items.
 */
export default function AuditActionEventTable() {
  const [events, setEvents] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [operationType, setOperationType] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Drawer state
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditActionEvents({
        operation_type: operationType || undefined,
        actor: actorFilter || undefined,
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit,
        offset,
      });
      setEvents(data.events || []);
      setCount(data.count ?? 0);
    } catch (err) {
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [operationType, actorFilter, statusFilter, startDate, endDate, offset]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setOffset(0);
  }, [operationType, actorFilter, statusFilter, startDate, endDate]);

  const openDetail = useCallback(async (eventId) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail({ id: eventId });
    try {
      const data = await getAuditActionEvent(eventId);
      setDetail(data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const clearFilters = () => {
    setOperationType("");
    setActorFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setOffset(0);
  };

  const hasFilters = operationType || actorFilter || statusFilter || startDate || endDate;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Filters */}
      <section className="card" style={{ marginBottom: 16, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding, 16px)" }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>
          FILTERS
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            className="formInput formInput--small"
            value={operationType}
            onChange={(e) => setOperationType(e.target.value)}
            style={{ maxWidth: 160 }}
            title="Operation type"
          >
            <option value="">All operations</option>
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            className="formInput formInput--small"
            placeholder="Actor"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input
            type="text"
            className="formInput formInput--small"
            placeholder="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input type="date" className="formInput formInput--small" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="Start date" />
          <input type="date" className="formInput formInput--small" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="End date" />
          {hasFilters && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Summary bar */}
      <section
        className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
        style={{ marginBottom: 16, borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
          OPERATIONS
        </p>
        <p style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
          {loading ? "..." : `${count} operation${count !== 1 ? "s" : ""}`}
        </p>
        {hasFilters && (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 bg-slate-100">Filtered</span>
        )}
      </section>

      {error && (
        <div style={{ padding: 16, marginBottom: 16, background: "var(--danger-light, #fef2f2)", borderRadius: 8, color: "var(--danger, #ef4444)", fontSize: 13 }}>
          Failed to load operations: {error}
        </div>
      )}

      {/* Table */}
      <section className="card" style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding, 16px)" }}>
        <div className="overflow-x-auto">
          <table className="table table--compact w-full">
            <thead>
              <tr>
                <th className="th th--left" style={{ borderColor: "var(--border)" }}>Requested</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Actor</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Operation</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Status</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>Loading...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={5} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                  {hasFilters ? "No operations match the current filters." : "No operations recorded yet."}
                </td></tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} style={{ cursor: "pointer" }} onClick={() => openDetail(evt.id)}>
                    <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDate(evt.requested_at)}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{evt.actor}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{evt.operation_type}</td>
                    <td className="td" style={{ borderColor: "var(--border)" }}><StatusPill status={evt.status} /></td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{evt.summary?.item_count ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {count === 0 ? "0–0 of 0" : `${offset + 1}–${Math.min(offset + limit, count)} of ${count}`}
          </span>
          <div className="flex gap-1">
            <button type="button" className="btn btn--outline btn--sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>←</button>
            <button type="button" className="btn btn--outline btn--sm" disabled={currentPage >= totalPages} onClick={() => setOffset((o) => o + limit)}>→</button>
          </div>
        </div>
      </section>

      {detail && (
        <OperationDrawer detail={detail} loading={detailLoading} error={detailError} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function OperationDrawer({ detail, loading, error, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", height: "100%", background: "#fff", boxShadow: "-4px 0 16px rgba(0,0,0,0.1)", padding: 24, overflowY: "auto" }}
      >
        <div className="flex justify-between items-start" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>Operation detail</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>✕</button>
        </div>

        {loading && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading...</p>}
        {error && <p style={{ fontSize: 13, color: "var(--danger, #ef4444)" }}>Failed to load: {error}</p>}

        {!loading && !error && detail.operation_type && (
          <>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 13, marginBottom: 20 }}>
              <dt style={{ color: "var(--text-tertiary)" }}>Operation</dt><dd style={{ margin: 0 }}>{detail.operation_type}</dd>
              <dt style={{ color: "var(--text-tertiary)" }}>Status</dt><dd style={{ margin: 0 }}><StatusPill status={detail.status} /></dd>
              <dt style={{ color: "var(--text-tertiary)" }}>Actor</dt><dd style={{ margin: 0 }}>{detail.actor}</dd>
              <dt style={{ color: "var(--text-tertiary)" }}>Requested</dt><dd style={{ margin: 0 }}>{formatDate(detail.requested_at)}</dd>
              <dt style={{ color: "var(--text-tertiary)" }}>Completed</dt><dd style={{ margin: 0 }}>{formatDate(detail.completed_at)}</dd>
              {detail.rationale && (<><dt style={{ color: "var(--text-tertiary)" }}>Rationale</dt><dd style={{ margin: 0 }}>{detail.rationale}</dd></>)}
            </dl>

            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Items ({detail.items?.length ?? 0})
            </p>
            <table className="table table--compact w-full">
              <thead>
                <tr>
                  <th className="th th--left" style={{ borderColor: "var(--border)" }}>Target</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Key</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Before → After</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", fontSize: 11, wordBreak: "break-all" }}>{item.target_id}</td>
                    <td className="td" style={{ borderColor: "var(--border)" }}>{item.change_key}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", fontSize: 11 }}>
                      {item.before_value ?? "∅"} → {item.after_value ?? "∅"}
                    </td>
                    <td className="td" style={{ borderColor: "var(--border)" }}>
                      <StatusPill status={item.status} />
                      {item.error_code && <div style={{ fontSize: 10, color: "var(--danger, #ef4444)" }}>{item.error_code}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
