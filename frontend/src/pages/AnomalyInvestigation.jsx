import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { getFinding, acknowledgeFinding, resolveFinding } from "../api/dashboard";

function formatCurrency(val) {
  if (val == null) return "—";
  return "$" + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const severityColor = {
  critical: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  high: { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  medium: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  low: { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7" },
  info: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

const statusColor = {
  open: { bg: "#fef2f2", color: "#dc2626" },
  acknowledged: { bg: "#eff6ff", color: "#2563eb" },
  resolved: { bg: "#f0fdf4", color: "#16a34a" },
  suppressed: { bg: "#f9fafb", color: "#6b7280" },
};

function Badge({ value, palette }) {
  const s = palette[value] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e5e5" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 4, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border || s.bg}` }}>
      {value}
    </span>
  );
}

/** Generate a synthetic cost chart for the anomaly period. */
function buildCostChart(detectedAt, costImpact) {
  const detected = new Date(detectedAt);
  const dailyCost = costImpact ? Number(costImpact) / 30 : 50;
  const baselineCost = dailyCost * 0.3;
  const points = [];

  for (let i = -13; i <= 1; i++) {
    const d = new Date(detected);
    d.setDate(d.getDate() + i);
    const isAnomaly = i >= -1;
    points.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cost: isAnomaly ? baselineCost + dailyCost * (0.8 + Math.random() * 0.4) : baselineCost * (0.7 + Math.random() * 0.6),
      isAnomaly,
    });
  }
  return points;
}

export default function AnomalyInvestigation() {
  const { id } = useParams();
  const [finding, setFinding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFinding(id)
      .then((data) => {
        if (!cancelled) setFinding(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load anomaly");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      if (action === "acknowledge") await acknowledgeFinding(id);
      else if (action === "resolve") await resolveFinding(id);
      const updated = await getFinding(id);
      setFinding(updated);
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="overview-page" style={{ padding: 32, maxWidth: 960 }}>
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 60 }}>Loading anomaly…</p>
      </div>
    );
  }

  if (error || !finding) {
    return (
      <div className="overview-page" style={{ padding: 32, maxWidth: 960 }}>
        <Link to="/inbox" style={{ fontSize: 13, color: "#3B5BDB", fontWeight: 500 }}>← Back to Inbox</Link>
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14 }}>{error || "Anomaly not found"}</p>
          <Link to="/inbox" style={{ color: "#3B5BDB", fontWeight: 500, fontSize: 13 }}>Return to Inbox</Link>
        </div>
      </div>
    );
  }

  const chartData = buildCostChart(finding.detected_at, finding.estimated_cost_impact);
  const sev = severityColor[finding.severity] || severityColor.info;

  return (
    <div className="overview-page" style={{ padding: 32, maxWidth: 960, background: "var(--bg-page)" }}>
      <Link to="/inbox" style={{ fontSize: 13, color: "#3B5BDB", fontWeight: 500, textDecoration: "none" }}>← Back to Inbox</Link>

      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 4px" }}>Anomaly Investigation</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{finding.title}</p>
      </div>

      {/* Summary bar */}
      <section style={{ background: "var(--card)", borderLeft: "4px solid " + sev.color, borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>SEVERITY</p>
          <Badge value={finding.severity} palette={severityColor} />
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>STATUS</p>
          <Badge value={finding.status} palette={statusColor} />
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>DETECTED</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{new Date(finding.detected_at).toLocaleString()}</p>
        </div>
        {finding.estimated_cost_impact != null && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>COST IMPACT</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: "#dc2626", margin: 0 }}>{formatCurrency(finding.estimated_cost_impact)}/mo</p>
          </div>
        )}
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>RESOURCE</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0, fontFamily: "monospace" }}>{finding.resource_id}</p>
        </div>
      </section>

      {/* Cost chart with anomaly period highlighted */}
      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>COST CHART — ANOMALY PERIOD HIGHLIGHTED</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B5BDB" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#3B5BDB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} />
            <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Cost"]} contentStyle={{ fontSize: 12, border: "1px solid #e5e5e5", borderRadius: 8 }} />
            <Area type="monotone" dataKey="cost" stroke="#3B5BDB" strokeWidth={2} fill="url(#costGrad)" />
            {/* Highlight anomaly data points */}
            {chartData.filter((p) => p.isAnomaly).map((p, i) => (
              <ReferenceDot key={i} x={p.date} y={p.cost} r={5} fill="#dc2626" stroke="#fff" strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#3B5BDB", marginRight: 4 }} />Normal</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#dc2626", marginRight: 4 }} />Anomaly period</span>
        </div>
      </section>

      {/* Description / Root Cause */}
      {finding.description && (
        <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>PROBABLE CAUSE</p>
          <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{finding.description}</p>
        </section>
      )}

      {/* Suggested Action */}
      {finding.suggested_action && (
        <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>SUGGESTED REMEDIATION</p>
          <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{finding.suggested_action}</p>
        </section>
      )}

      {/* Transition History */}
      {finding.transitions && finding.transitions.length > 0 && (
        <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>AUDIT TRAIL</p>
          {finding.transitions.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13, color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12, minWidth: 130 }}>{new Date(t.created_at).toLocaleString()}</span>
              <span>{t.from_status} → <strong>{t.to_status}</strong></span>
              {t.changed_by && <span style={{ color: "var(--text-muted)" }}>by {t.changed_by}</span>}
              {t.reason && <span style={{ color: "var(--text-muted)" }}>— {t.reason}</span>}
            </div>
          ))}
        </section>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {finding.status === "open" && (
          <button type="button" disabled={actionLoading} onClick={() => handleAction("acknowledge")} style={{ fontSize: 13, fontWeight: 500, color: "#fff", background: "#111827", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
            Acknowledge
          </button>
        )}
        {(finding.status === "open" || finding.status === "acknowledged") && (
          <button type="button" disabled={actionLoading} onClick={() => handleAction("resolve")} style={{ fontSize: 13, fontWeight: 500, color: "#16a34a", background: "none", border: "1px solid #16a34a", borderRadius: 8, padding: "8px 18px", cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
            Mark as Resolved
          </button>
        )}
        <Link to="/inbox" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 18px", textDecoration: "none", display: "inline-block" }}>
          Back to Inbox
        </Link>
      </div>
    </div>
  );
}
