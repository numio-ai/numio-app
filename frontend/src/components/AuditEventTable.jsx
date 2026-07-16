import React, { useState, useEffect, useCallback } from "react";
import { getAuditConfigEvents } from "../api/dashboard";

/**
 * Shared audit event table component.
 * Used in both Govern > Audit Log and Settings > Audit Logs.
 *
 * Props:
 *   compact - if true, renders without its own heading (for embedding in tabs)
 */
export default function AuditEventTable({ compact = false }) {
  const [events, setEvents] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditConfigEvents({
        user: userFilter || undefined,
        action: actionFilter || undefined,
        entity_type: entityTypeFilter || undefined,
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
  }, [userFilter, actionFilter, entityTypeFilter, startDate, endDate, offset]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [userFilter, actionFilter, entityTypeFilter, startDate, endDate]);

  const clearFilters = () => {
    setUserFilter("");
    setActionFilter("");
    setEntityTypeFilter("");
    setStartDate("");
    setEndDate("");
    setOffset(0);
  };

  const hasFilters = userFilter || actionFilter || entityTypeFilter || startDate || endDate;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function renderDiff(label, value) {
    if (!value || (typeof value === "object" && Object.keys(value).length === 0)) return null;
    return (
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>{label}</span>
        <pre style={{ fontSize: 11, color: "var(--text)", background: "var(--bg-page, #f9fafb)", borderRadius: 4, padding: 8, margin: "4px 0 0", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <section className="card" style={{ marginBottom: 16, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding, 16px)" }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>
          FILTERS
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            className="formInput formInput--small"
            placeholder="User"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input
            type="text"
            className="formInput formInput--small"
            placeholder="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input
            type="text"
            className="formInput formInput--small"
            placeholder="Entity type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input
            type="date"
            className="formInput formInput--small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start date"
          />
          <input
            type="date"
            className="formInput formInput--small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End date"
          />
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
          AUDIT EVENTS
        </p>
        <p style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
          {loading ? "..." : `${count} event${count !== 1 ? "s" : ""}`}
        </p>
        {hasFilters && (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 bg-slate-100">
            Filtered
          </span>
        )}
      </section>

      {/* Error state */}
      {error && (
        <div style={{ padding: 16, marginBottom: 16, background: "var(--danger-light, #fef2f2)", borderRadius: 8, color: "var(--danger, #ef4444)", fontSize: 13 }}>
          Failed to load audit events: {error}
        </div>
      )}

      {/* Table */}
      <section className="card" style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding, 16px)" }}>
        <div className="overflow-x-auto">
          <table className="table table--compact w-full">
            <thead>
              <tr>
                <th className="th th--left" style={{ borderColor: "var(--border)" }}>Timestamp</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>User</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Action</th>
                <th className="th" style={{ borderColor: "var(--border)" }}>Entity</th>
                <th className="th th--left" style={{ borderColor: "var(--border)" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                    Loading...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                    {hasFilters ? "No events match the current filters." : "No audit events found."}
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <React.Fragment key={evt.id}>
                    <tr
                      style={{ cursor: (evt.before_value || evt.after_value) ? "pointer" : "default" }}
                      onClick={() => {
                        if (evt.before_value || evt.after_value) {
                          setExpandedId(expandedId === evt.id ? null : evt.id);
                        }
                      }}
                    >
                      <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {formatDate(evt.created_at)}
                      </td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{evt.user}</td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{evt.action}</td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        {evt.entity_type}{evt.entity_id ? ` / ${evt.entity_id}` : ""}
                      </td>
                      <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {evt.details || "—"}
                          {(evt.before_value || evt.after_value) && (
                            <span style={{ fontSize: 10, color: "var(--accent, #3b82f6)" }}>
                              {expandedId === evt.id ? "▲" : "▼"}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                    {expandedId === evt.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "8px 14px 14px", borderColor: "var(--border)", background: "var(--bg-page, #f9fafb)" }}>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              {renderDiff("Before", evt.before_value)}
                            </div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              {renderDiff("After", evt.after_value)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {count === 0
              ? "0–0 of 0"
              : `${offset + 1}–${Math.min(offset + limit, count)} of ${count}`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset((o) => o + limit)}
            >
              →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
