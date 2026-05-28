import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  REC_LIST,
  REC_CATEGORIES,
  REC_SAVED_VIEWS,
  applyView,
} from "./recommendationsMockData";
import SendToAutopilotModal from "../../components/SendToAutopilotModal";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
};

const secLabel = { fontSize: 10, fontWeight: 600, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 };
const btnGhost = { fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" };
const btnSecondary = { fontSize: 12, color: C.text, background: C.surface, fontWeight: 500, border: `1px solid ${C.text}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: C.text, fontWeight: 500, border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" };

function Chip({ children, tone = "neutral" }) {
  const palette = {
    neutral: { c: "#374151", bg: "#f3f4f6", b: C.border },
    ai: { c: C.ai2, bg: C.aiBg, b: C.aiBd },
    auto: { c: C.good, bg: C.goodBg, b: C.goodBd },
  }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: palette.c, background: palette.bg, border: `1px solid ${palette.b}`, padding: "2px 8px", borderRadius: 4 }}>
      {children}
    </span>
  );
}

function MetaInline({ r }) {
  const effortColor = r.effort === "Low" ? C.good : r.effort === "Medium" ? C.warn : C.danger;
  return (
    <span style={{ fontSize: 11, color: C.xMuted, fontFamily: "JetBrains Mono, monospace" }}>
      {r.scope} · effort <span style={{ color: effortColor, fontWeight: 600 }}>{r.effort.toLowerCase()}</span> · confidence {r.confidence.toLowerCase()}
      {r.affectedCount != null && <> · affects {r.affectedCount} resource{r.affectedCount === 1 ? "" : "s"}</>}
    </span>
  );
}

function RiskBox({ risk }) {
  const tone = risk.level === "low" ? { color: C.good, bg: C.goodBg, bd: C.goodBd } : risk.level === "med" ? { color: C.warn, bg: C.warnBg, bd: C.warnBd } : { color: C.danger, bg: C.dangerBg, bd: C.dangerBd };
  const label = risk.level === "low" ? "Low" : risk.level === "med" ? "Medium" : "High";
  return (
    <div style={{ marginTop: 6, padding: "10px 12px", background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 8, fontSize: 12, color: C.text2 }}>
      <p style={{ margin: 0, fontWeight: 600, color: tone.color, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tone.color }} />
        {label}
      </p>
      <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>{risk.text}</p>
    </div>
  );
}

function CardHeader({ r, expanded, onToggle }) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`rec-card-header-${r.id}`}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      style={{
        padding: expanded ? "14px 16px" : "12px 16px",
        display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
        background: expanded ? "#fafafa" : C.surface,
        borderBottom: expanded ? `1px solid ${C.border}` : "none",
      }}
    >
      <span style={{ color: C.xMuted, fontSize: 12, width: 14, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 120ms" }}>▸</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
          <Chip>{r.category}</Chip>
          {r.source === "ai" && <Chip tone="ai">✨ AI</Chip>}
          {r.autopilot && <Chip tone="auto">Autopilot-eligible</Chip>}
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: C.text, margin: 0 }}>{r.title}</p>
        <p style={{ margin: "3px 0 0" }}><MetaInline r={r} /></p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: C.good, margin: 0 }}>${r.saving.toLocaleString()}/mo</p>
        {!expanded && <span style={{ fontSize: 11, color: C.xMuted }}>Click to see evidence</span>}
      </div>
    </div>
  );
}

function RecCard({ r, expanded, onToggle, onApplyOnce, onSendToAutopilot, onDismiss, onSnooze }) {
  if (!expanded) {
    return (
      <div data-testid={`rec-card-${r.id}`} data-expanded="false" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 }}>
        <CardHeader r={r} expanded={false} onToggle={onToggle} />
      </div>
    );
  }
  return (
    <div data-testid={`rec-card-${r.id}`} data-expanded="true" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <CardHeader r={r} expanded onToggle={onToggle} />
      <div style={{ padding: "16px 20px 18px" }}>
        <div data-testid={`rec-section-signals-${r.id}`} style={{ marginBottom: 16 }}>
          <p style={secLabel}>Signals detected</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
            {r.signals.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
          </ul>
        </div>

        <div data-testid={`rec-section-affected-${r.id}`} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <p style={{ ...secLabel, marginBottom: 0 }}>Affected resources</p>
            {r.affectedCount != null && (
              <Link
                to={`/resources?rec=${r.id}`}
                data-testid={`rec-view-resources-${r.id}`}
                style={{ fontSize: 12, color: C.ai2, fontWeight: 500, textDecoration: "none" }}
              >
                View all {r.affectedCount} in Resources →
              </Link>
            )}
          </div>
          {r.sample.length > 0 ? (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 90px 150px 90px 110px",
                gap: 12, padding: "8px 12px", background: "#fafafa", borderBottom: `1px solid ${C.border}`,
                fontSize: 10, fontWeight: 500, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                <span>NAME</span><span>SERVICE</span><span>TYPE</span><span style={{ textAlign: "right" }}>SPEND/MO</span><span>IDLE PATTERN</span>
              </div>
              {r.sample.map((s, i) => (
                <div key={s.name} style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 150px 90px 110px",
                  gap: 12, padding: "8px 12px",
                  borderBottom: i < r.sample.length - 1 ? "1px solid #f3f4f6" : "none",
                  fontSize: 12, color: C.text,
                }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ color: C.muted }}>{s.svc}</span>
                  <span style={{ color: C.muted }}>{s.type}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>${s.spend.toLocaleString()}</span>
                  <span style={{ color: C.muted }}>{s.idle}</span>
                </div>
              ))}
              {r.remainingCount > 0 && (
                <div style={{
                  padding: "8px 12px", background: "#fafafa",
                  fontSize: 12, color: C.muted,
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span>… {r.remainingCount} more affected resources</span>
                  <span style={{ fontWeight: 600, color: C.text2 }}>${r.remainingSpend.toLocaleString()}/mo combined</span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>
              {r.affectedCount == null ? "Not resource-based." : "1 resource."}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
          <div data-testid={`rec-section-what-${r.id}`}>
            <p style={secLabel}>What will happen</p>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
              {r.whatHappens.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
            </ul>
            <p data-testid={`rec-section-exclusions-${r.id}`} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              <span style={{ fontWeight: 600, color: C.text2 }}>Exclusions: </span>{r.exclusions}
            </p>
          </div>
          <div data-testid={`rec-section-risk-${r.id}`}>
            <p style={secLabel}>Risk</p>
            <RiskBox risk={r.risk} />
          </div>
        </div>

        {r.manualRemediation && (
          <div data-testid={`rec-section-manual-${r.id}`} style={{ marginBottom: 16 }}>
            <p style={secLabel}>Manual remediation</p>
            <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 6px" }}>{r.manualRemediation.note}</p>
            <pre style={{
              background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.6,
              whiteSpace: "pre", overflowX: "auto", margin: 0,
            }}>{r.manualRemediation.cmd}</pre>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            data-testid={`rec-dismiss-${r.id}`}
            onClick={() => onDismiss?.(r)}
            style={btnGhost}
          >
            Dismiss
          </button>
          <button
            type="button"
            data-testid={`rec-snooze-${r.id}`}
            onClick={() => onSnooze?.(r)}
            style={btnGhost}
          >
            Snooze 7 days
          </button>
          <span style={{ flex: 1 }} />
          <Link to="/govern/audit" style={{ fontSize: 12, color: C.muted, marginRight: 8, textDecoration: "none" }}>View full audit trail →</Link>
          <button
            type="button"
            data-testid={`rec-apply-once-${r.id}`}
            onClick={() => onApplyOnce(r)}
            style={btnSecondary}
          >
            Apply once
          </button>
          <button
            type="button"
            data-testid={`rec-send-autopilot-${r.id}`}
            onClick={() => onSendToAutopilot(r)}
            style={btnPrimary}
          >
            Send to Autopilot →
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewsPicker({ activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const active = REC_SAVED_VIEWS.find((v) => v.id === activeId) || REC_SAVED_VIEWS[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="rec-views-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13,
          background: open ? "#f3f4f6" : C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.text, fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: C.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: C.xMuted }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Saved views" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 340, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button type="button" style={{ fontSize: 11, color: C.muted, background: "transparent", border: "none", padding: "2px 6px", cursor: "pointer" }}>+ Save current</button>
          </div>
          {REC_SAVED_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`rec-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: on ? "#f3f4f6" : "transparent", cursor: "pointer" }}
              >
                <span style={{ width: 14, color: C.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: on ? 500 : 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {v.label}
                    {v.id === "zombie" && <span title="Replaces the old Zombie Hunter page" style={{ fontSize: 10, color: C.ai2, background: C.aiBg, border: `1px solid ${C.aiBd}`, padding: "1px 6px", borderRadius: 9 }}>preset</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button type="button" title="Copy link" style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: C.muted, cursor: "pointer" }}>🔗</button>
                <button type="button" title="More" style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: C.muted, fontSize: 16, lineHeight: 1, cursor: "pointer" }}>⋯</button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <button type="button" style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: C.muted, background: "transparent", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Manage all views…
          </button>
        </div>
      )}
    </div>
  );
}

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3000);
    return () => clearTimeout(id);
  }, [onDismiss]);
  return (
    <div
      data-testid="rec-toast"
      role="status"
      style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        zIndex: 200, padding: "10px 18px",
        background: C.text, color: "#fff", borderRadius: 8, fontSize: 13,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      }}
    >
      {message}
    </div>
  );
}

const SORT_OPTIONS = [
  { id: "savings", label: "Highest savings" },
  { id: "newest", label: "Newest" },
];

const STATUS_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
];

function MenuButton({ label, value, options, onChange, testId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const active = options.find((o) => o.id === value) || options[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, background: C.surface, cursor: "pointer" }}
      >
        {label}: {active.label} ▾
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 160,
            background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 4, zIndex: 50,
          }}
        >
          {options.map((o) => {
            const on = o.id === active.id;
            return (
              <div
                key={o.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`${testId}-option-${o.id}`}
                onClick={() => { onChange(o.id); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onChange(o.id); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 4, fontSize: 12, color: C.text, cursor: "pointer", background: on ? "#f3f4f6" : "transparent" }}
              >
                <span style={{ width: 14, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <span>{o.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const viewId = params.get("view") || "all";

  const [expandedIds, setExpandedIds] = useState(() => new Set(["r-201"]));
  const [activeCategory, setActiveCategory] = useState("All");
  const [toast, setToast] = useState(null);
  const [autopilotRec, setAutopilotRec] = useState(null);
  const [sortBy, setSortBy] = useState("savings");
  const [statusFilter, setStatusFilter] = useState("open");
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [rescanLabel, setRescanLabel] = useState("· last 2h ago");
  const [rescanning, setRescanning] = useState(false);

  const setView = (v) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("view", v.id);
      return np;
    });
    setActiveCategory("All");
  };

  const view = REC_SAVED_VIEWS.find((v) => v.id === viewId) || REC_SAVED_VIEWS[0];
  const filtered = useMemo(() => {
    let items = applyView(view, REC_LIST);
    if (activeCategory !== "All") items = items.filter((r) => r.category === activeCategory);
    if (statusFilter === "open") items = items.filter((r) => !hiddenIds.has(r.id));
    if (sortBy === "newest") {
      items = [...items].sort((a, b) => (b.id > a.id ? 1 : -1));
    } else {
      items = [...items].sort((a, b) => b.saving - a.saving);
    }
    return items;
  }, [view, activeCategory, sortBy, statusFilter, hiddenIds]);

  const onDismissRec = (r) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(r.id);
      return next;
    });
    setToast(`Dismissed · ${r.title}`);
  };

  const onSnoozeRec = (r) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(r.id);
      return next;
    });
    setToast(`Snoozed for 7 days · ${r.title}`);
  };

  const onRescan = () => {
    if (rescanning) return;
    setRescanning(true);
    setRescanLabel("· scanning…");
    setTimeout(() => {
      setRescanning(false);
      setRescanLabel("· just now");
    }, 800);
  };

  const toggleCard = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = REC_LIST.reduce((a, b) => a + b.saving, 0);

  const onApplyOnce = (r) => {
    setToast(`Applied · $${r.saving.toLocaleString()} saved · reversible for 7 days`);
  };

  const onSendToAutopilot = (r) => {
    setAutopilotRec(r);
  };

  return (
    <div
      data-testid="recommendations-page"
      style={{
        padding: 32, maxWidth: 1100, width: "100%", minHeight: "100%",
        boxSizing: "border-box", background: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>Recommendations</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
            <b style={{ color: C.good, fontWeight: 600 }}>${total.toLocaleString()}/mo</b> in pending savings
            <span style={{ color: C.xMuted }}> · </span>
            acted on <b style={{ color: C.text2, fontWeight: 600 }}>$3,820</b> last 7 days
            <span style={{ color: C.xMuted }}> · </span>
            {filtered.length} open
          </p>
        </div>
        <button
          type="button"
          data-testid="rec-rescan-button"
          onClick={onRescan}
          disabled={rescanning}
          style={{
            fontSize: 12, color: C.text2, background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 8,
            cursor: rescanning ? "default" : "pointer",
            opacity: rescanning ? 0.7 : 1,
          }}
          title="Force a fresh scan of the fleet"
        >
          <span>⟳ Rescan</span>
          <span data-testid="rec-rescan-label" style={{ color: C.xMuted, fontWeight: 400 }}>{rescanLabel}</span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ViewsPicker activeId={viewId} onSelect={setView} />
        <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 12, color: C.text2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>
          🔗 Share link
        </button>
        <button type="button" style={{ padding: "5px 10px", fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>
          Save as…
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {REC_CATEGORIES.map((f) => {
          const on = activeCategory === f;
          return (
            <button
              key={f}
              type="button"
              data-testid={`rec-category-${f}`}
              onClick={() => setActiveCategory(f)}
              style={{
                padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
                borderRadius: 6, border: `1px solid ${on ? C.text : C.border}`,
                background: on ? C.text : C.surface,
                color: on ? "#fff" : C.muted, cursor: "pointer",
              }}
            >
              {f}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <MenuButton label="Sort" value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} testId="rec-sort" />
        <MenuButton label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} testId="rec-status" />
      </div>

      {filtered.length === 0 ? (
        <div data-testid="rec-empty-state" style={{ padding: "60px 20px", textAlign: "center", color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          No recommendations match this view.
        </div>
      ) : (
        filtered.map((r) => (
          <RecCard
            key={r.id}
            r={r}
            expanded={expandedIds.has(r.id)}
            onToggle={() => toggleCard(r.id)}
            onApplyOnce={onApplyOnce}
            onSendToAutopilot={onSendToAutopilot}
            onDismiss={onDismissRec}
            onSnooze={onSnoozeRec}
          />
        ))
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      {autopilotRec && (
        <SendToAutopilotModal
          recommendation={autopilotRec}
          onCancel={() => setAutopilotRec(null)}
          onApprove={(payload) => {
            setAutopilotRec(null);
            setToast(`Autopilot rule queued · ${payload.dryRun ? "dry-run first" : "enabled live"}`);
          }}
        />
      )}
    </div>
  );
}
