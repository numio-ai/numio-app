import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const B = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  ai: "#6366f1", ai2: "#4f46e5",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const STATUS_COLOR = {
  "on-track": { c: B.good, bg: B.goodBg, b: B.goodBd, label: "On track" },
  "at-risk": { c: B.warn, bg: B.warnBg, b: B.warnBd, label: "At risk" },
  "over": { c: B.danger, bg: B.dangerBg, b: B.dangerBd, label: "Over" },
};

export function deriveStatus({ spent, budget }) {
  const pct = (spent / budget) * 100;
  if (pct >= 100) return "over";
  if (pct >= 85) return "at-risk";
  return "on-track";
}

const MONTH_DAY = 15;
const MONTH_TOTAL = 31;
const EXPECTED_PCT = Math.round((MONTH_DAY / MONTH_TOTAL) * 100);

const BUDGETS = [
  { id: "team-eng", team: "Engineering", budget: 80000, spent: 64320, alert: 90 },
  { id: "team-payments", team: "Payments", budget: 48000, spent: 41280, alert: 90 },
  { id: "team-ml", team: "ML Platform", budget: 24000, spent: 24840, alert: 85 },
  { id: "team-data", team: "Data & Analytics", budget: 18000, spent: 11402, alert: 90 },
  { id: "team-finance", team: "Finance", budget: 12000, spent: 8240, alert: 90 },
  { id: "team-sales", team: "Sales", budget: 8000, spent: 6980, alert: 85 },
  { id: "team-marketing", team: "Marketing", budget: 6000, spent: 3120, alert: 90 },
  { id: "team-sandbox", team: "Sandbox / shared", budget: 4000, spent: 1280, alert: 90 },
];

const B_VIEWS = [
  { id: "all", label: "All teams", owner: "shared", filter: "all" },
  { id: "at-risk", label: "Teams at risk", owner: "shared", note: "Over budget or projected to exceed", filter: "at-risk" },
  { id: "mine", label: "My team", owner: "you", filter: "mine" },
  { id: "by-cc", label: "By cost-center", owner: "shared", filter: "all" },
];

const PERIODS = [
  { id: "month", label: "This month" },
  { id: "qtr", label: "This quarter" },
  { id: "year", label: "This year" },
];

const btnGhost = { fontSize: 12, color: B.muted, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: B.text, border: "none", borderRadius: 6, padding: "5px 14px", fontWeight: 500, cursor: "pointer" };

function BudgetBar({ pct, status }) {
  const c = STATUS_COLOR[status].c;
  return (
    <div data-testid="budget-bar" style={{ position: "relative", height: 6, borderRadius: 9999, background: "#f3f4f6", overflow: "visible" }}>
      <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, pct)}%`, background: c, borderRadius: 9999, overflow: "hidden" }} />
      {pct > 100 && (
        <div style={{ position: "absolute", left: "100%", top: 0, width: 4, height: 6, background: B.danger }} />
      )}
      <div
        data-testid="budget-pacing-tick"
        data-expected-pct={EXPECTED_PCT}
        title={`Expected at day ${MONTH_DAY} of ${MONTH_TOTAL}`}
        style={{
          position: "absolute", top: -3, left: `${EXPECTED_PCT}%`,
          width: 2, height: 12, background: "#6b7280", opacity: 0.5,
        }}
      />
    </div>
  );
}

function BudgetCard({ b }) {
  const pct = Math.round((b.spent / b.budget) * 100);
  const status = deriveStatus(b);
  const s = STATUS_COLOR[status];
  const drift = pct - EXPECTED_PCT;
  return (
    <div
      data-testid={`budget-card-${b.id}`}
      data-status={status}
      style={{
        background: B.surface,
        border: `1px solid ${s.b}`,
        borderLeft: `4px solid ${s.c}`,
        borderRadius: 10, padding: "14px 18px",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: B.text, margin: 0 }}>{b.team}</p>
          <p style={{ fontSize: 11, color: B.xMuted, margin: "2px 0 0" }}>Monthly · alerts at {b.alert}%</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: s.c, background: s.bg, padding: "2px 8px", borderRadius: 4, border: `1px solid ${s.b}` }}>
          {s.label}
        </span>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: B.text }}>
            ${b.spent.toLocaleString()}
            <span style={{ fontSize: 12, color: B.xMuted, fontWeight: 400, marginLeft: 4 }}>/ ${b.budget.toLocaleString()}</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: s.c, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
        <BudgetBar pct={pct} status={status} />
        <p data-testid={`budget-annotation-${b.id}`} style={{ fontSize: 11, color: B.xMuted, margin: "6px 0 0", display: "flex", justifyContent: "space-between" }}>
          <span>Expected at day {MONTH_DAY}: {EXPECTED_PCT}%</span>
          <span style={{ color: drift > 5 ? B.warn : drift < -5 ? B.good : B.xMuted }}>
            {drift > 0 ? `+${drift}pp ahead` : drift < 0 ? `${drift}pp behind` : "on pace"}
          </span>
        </p>
      </div>
    </div>
  );
}

function ViewsPicker({ activeId, onSelect, onCopyLink }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const active = B_VIEWS.find((v) => v.id === activeId) || B_VIEWS[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="budgets-views-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13,
          background: open ? "#f3f4f6" : B.surface, border: `1px solid ${B.border}`, borderRadius: 6,
          color: B.text, fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: B.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: B.xMuted }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Saved views" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 6, zIndex: 50,
        }}>
          {B_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`budgets-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: on ? "#f3f4f6" : "transparent", cursor: "pointer" }}
              >
                <span style={{ width: 14, color: B.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: B.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: B.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button
                  type="button"
                  title="Copy link"
                  onClick={(e) => { e.stopPropagation(); onCopyLink(v); }}
                  style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: B.muted, cursor: "pointer" }}
                >
                  🔗
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  const [params, setParams] = useSearchParams();
  const viewId = params.get("view") || "all";
  const period = params.get("period") || "month";
  const [newBudgetOpen, setNewBudgetOpen] = useState(false);

  const setView = (v) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("view", v.id); return np; });
  const setPeriod = (p) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("period", p); return np; });

  const onCopyLink = useCallback((view) => {
    const url = new URL(window.location.href);
    if (view?.id) url.searchParams.set("view", view.id);
    try { navigator.clipboard?.writeText(url.toString()); } catch { /* noop */ }
  }, []);

  const view = B_VIEWS.find((v) => v.id === viewId) || B_VIEWS[0];
  const filtered = useMemo(() => {
    const scale = period === "qtr" ? 3 : period === "year" ? 12 : 1;
    const scaled = BUDGETS.map((b) => ({
      ...b,
      budget: b.budget * scale,
      spent: Math.round(b.spent * (scale === 1 ? 1 : scale * 0.9)),
    }));
    if (view.filter === "at-risk") return scaled.filter((b) => deriveStatus(b) !== "on-track");
    if (view.filter === "mine") return scaled.filter((b) => b.team === "Engineering");
    return scaled;
  }, [view, period]);

  const total = filtered.reduce((a, b) => a + b.budget, 0);
  const spent = filtered.reduce((a, b) => a + b.spent, 0);
  const overCount = filtered.filter((b) => deriveStatus(b) === "over").length;
  const atRiskCount = filtered.filter((b) => deriveStatus(b) === "at-risk").length;
  const pctOverall = total > 0 ? Math.round((spent / total) * 100) : 0;

  return (
    <div
      data-testid="budgets-page"
      style={{ padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box", background: B.bg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: B.text, margin: 0 }}>Budgets</h1>
          <p data-testid="budgets-subtitle" style={{ fontSize: 13, color: B.muted, margin: "4px 0 0" }}>
            <b style={{ color: B.text2, fontWeight: 600 }}>${spent.toLocaleString()}</b> spent of{" "}
            <b style={{ color: B.text2, fontWeight: 600 }}>${total.toLocaleString()}</b> ({pctOverall}%)
            <span style={{ color: B.xMuted }}> · </span>
            <b style={{ color: B.danger, fontWeight: 600 }}>{overCount}</b> over
            <span style={{ color: B.xMuted }}> · </span>
            <b style={{ color: B.warn, fontWeight: 600 }}>{atRiskCount}</b> at risk
            <span style={{ color: B.xMuted }}> · </span>
            day {MONTH_DAY} of {MONTH_TOTAL}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" data-testid="budgets-rescan" style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>⟳ Rescan</span>
            <span style={{ color: B.xMuted, fontWeight: 400 }}>· last 2h ago</span>
          </button>
          <button type="button" data-testid="budgets-new" onClick={() => setNewBudgetOpen(true)} style={btnPrimary}>+ New budget</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <ViewsPicker activeId={viewId} onSelect={setView} onCopyLink={onCopyLink} />
        <button type="button" data-testid="budgets-share" onClick={() => onCopyLink(null)} style={btnGhost}>🔗 Share link</button>
        <button type="button" style={btnGhost}>Save as…</button>
        <span style={{ flex: 1 }} />
        <div data-testid="budgets-period-selector" style={{ display: "inline-flex", border: `1px solid ${B.border}`, borderRadius: 6, overflow: "hidden", background: B.surface }}>
          {PERIODS.map((p) => {
            const on = p.id === period;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`budgets-period-${p.id}`}
                aria-selected={on}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: "5px 12px", fontSize: 12,
                  background: on ? B.text : B.surface,
                  color: on ? "#fff" : B.muted,
                  border: "none", borderRight: `1px solid ${B.border}`,
                  fontWeight: on ? 500 : 400, cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div data-testid="budgets-empty" style={{ padding: "60px 20px", textAlign: "center", color: B.muted, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 10 }}>
          No budgets match this view.
        </div>
      ) : (
        <div data-testid="budgets-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map((b) => <BudgetCard key={b.id} b={b} />)}
        </div>
      )}

      {newBudgetOpen && (
        <div
          data-testid="budgets-new-stub"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setNewBudgetOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}
        >
          <div style={{ width: 440, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: B.text, margin: 0 }}>New budget</h2>
            <p style={{ fontSize: 13, color: B.muted, margin: "10px 0 16px" }}>
              The budget creation wizard is being built. Track in <code style={{ fontFamily: "JetBrains Mono, monospace" }}>ia_v2_be_budgets</code>.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setNewBudgetOpen(false)} style={btnPrimary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
