import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getFindings, acknowledgeFinding, resolveFinding } from "../../api/dashboard";
import SkeletonLoader from "../../components/SkeletonLoader";
import ErrorMessage from "../../components/ErrorMessage";
import useInboxUnreadCount from "../../hooks/useInboxUnreadCount";

const POLL_INTERVAL_MS = 30_000;

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "anomaly", label: "Anomaly" },
  { key: "zombie", label: "Zombie" },
  { key: "idle", label: "Idle" },
  { key: "policy_violation", label: "Policy" },
  { key: "tag_violation", label: "Tag" },
];

const SEVERITY_OPTIONS = [
  { key: "", label: "All severities" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "info", label: "Info" },
];

const severityColor = {
  critical: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  high: { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  medium: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  low: { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7" },
  info: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

const statusColor = {
  open: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  acknowledged: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  resolved: { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7" },
  suppressed: { bg: "#f9fafb", color: "#6b7280", border: "#e5e5e5" },
};

function Badge({ value, palette }) {
  const s = palette[value] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e5e5" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 4, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {value}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatCurrency(val) {
  if (val == null) return "—";
  return "$" + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function FindingCard({ finding, expanded, onToggle, onAction }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 8,
        borderLeft: `4px solid ${(severityColor[finding.severity] || severityColor.info).color}`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          cursor: "pointer",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge value={finding.severity} palette={severityColor} />
            <Badge value={finding.type.replace("_", " ")} palette={{ [finding.type.replace("_", " ")]: { bg: "#f3f4f6", color: "#374151", border: "#e5e5e5" } }} />
            <Badge value={finding.status} palette={statusColor} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{finding.title}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {finding.resource_id} · {formatDate(finding.detected_at)}
          </p>
        </div>
        {finding.estimated_cost_impact != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#dc2626", margin: 0 }}>{formatCurrency(finding.estimated_cost_impact)}/mo</p>
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>DETECTION SOURCE</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{finding.detection_source}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>DETECTED</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{new Date(finding.detected_at).toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>LAST SEEN</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{new Date(finding.last_seen_at).toLocaleString()}</p>
            </div>
            {finding.estimated_cost_impact != null && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>COST IMPACT</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", margin: 0 }}>{formatCurrency(finding.estimated_cost_impact)}/mo</p>
              </div>
            )}
          </div>

          {finding.description && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>DESCRIPTION</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{finding.description}</p>
            </div>
          )}

          {finding.suggested_action && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>SUGGESTED ACTION</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{finding.suggested_action}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {finding.type === "anomaly" && (
              <button type="button" onClick={() => navigate(`/anomalies/${finding.id}`)} style={{ fontSize: 12, fontWeight: 500, color: "#3B5BDB", background: "none", border: "1px solid #3B5BDB", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                Investigate →
              </button>
            )}
            {(finding.type === "zombie" || finding.type === "idle") && (
              <button type="button" onClick={() => navigate("/recommendations")} style={{ fontSize: 12, fontWeight: 500, color: "#3B5BDB", background: "none", border: "1px solid #3B5BDB", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                View recommendations →
              </button>
            )}
            {finding.status === "open" && (
              <button type="button" onClick={() => onAction("acknowledge", finding.id)} style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: "#111827", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                Acknowledge
              </button>
            )}
            {(finding.status === "open" || finding.status === "acknowledged") && (
              <button type="button" onClick={() => onAction("resolve", finding.id)} style={{ fontSize: 12, fontWeight: 500, color: "#16a34a", background: "none", border: "1px solid #16a34a", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                Resolve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const unreadCount = useInboxUnreadCount();
  const [activeType, setActiveType] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("");
  const [findings, setFindings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (activeType !== "all") params.type = activeType;
      if (severityFilter) params.severity = severityFilter;
      const data = await getFindings(params);
      setFindings(data.findings);
      setTotalCount(data.count);
    } catch (err) {
      setError(err.message || "Failed to load findings");
    } finally {
      setLoading(false);
    }
  }, [activeType, severityFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleAction = async (action, findingId) => {
    try {
      if (action === "acknowledge") await acknowledgeFinding(findingId);
      else if (action === "resolve") await resolveFinding(findingId);
      await fetchData();
    } catch {
      // Silently refresh
    }
  };

  // Summary counts
  const openCount = findings.filter((f) => f.status === "open").length;
  const criticalCount = findings.filter((f) => f.severity === "critical" && f.status === "open").length;
  const resolvedCount = findings.filter((f) => f.status === "resolved").length;

  return (
    <div className="overview-page" style={{ padding: 32, maxWidth: 960, background: "var(--bg-page)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0, marginBottom: 4, lineHeight: 1.2 }}>Inbox</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>
            Work queue · {unreadCount} need triage
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <section style={{ background: "var(--card)", borderLeft: "4px solid #3B5BDB", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, alignItems: "flex-start" }} aria-label="Summary">
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>TOTAL FINDINGS</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{totalCount}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>OPEN</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: openCount > 0 ? "#dc2626" : "var(--text-primary)", margin: 0 }}>{openCount}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>CRITICAL</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: criticalCount > 0 ? "#dc2626" : "var(--text-primary)", margin: 0 }}>{criticalCount}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>RESOLVED</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#16a34a", margin: 0 }}>{resolvedCount}</p>
        </div>
      </section>

      {/* Filters: type tabs + severity dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveType(tab.key)}
              style={{
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: activeType === tab.key ? 500 : 400,
                borderRadius: 6,
                border: `1px solid ${activeType === tab.key ? "var(--text-primary)" : "var(--border)"}`,
                background: activeType === tab.key ? "var(--text-primary)" : "var(--card)",
                color: activeType === tab.key ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading && <SkeletonLoader variant="feed" />}
      {error && <ErrorMessage message={error} onRetry={fetchData} />}
      {!loading && !error && findings.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14, margin: 0 }}>No findings found</p>
          <p style={{ fontSize: 12, margin: "8px 0 0", color: "var(--text-tertiary)" }}>
            Findings will appear here once detection jobs run against your AWS accounts.
          </p>
        </div>
      )}
      {!loading && !error && findings.map((f) => (
        <FindingCard
          key={f.id}
          finding={f}
          expanded={expandedId === f.id}
          onToggle={() => setExpandedId((id) => (id === f.id ? null : f.id))}
          onAction={handleAction}
        />
      ))}

      <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 20, marginBottom: 0 }}>
        Looking for audit history?{" "}
        <Link to="/settings?tab=audit_logs" style={{ color: "#3B5BDB", fontWeight: 500 }}>View Audit Logs →</Link>
      </p>
    </div>
  );
}
