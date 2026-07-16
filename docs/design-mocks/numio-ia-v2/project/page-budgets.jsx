// page-budgets.jsx — IA v2, iteration 2.
// Standardized look-and-feel:
//   - Banner removed; signals fold into subtitle
//   - View picker + Share + Save as
//   - ⟳ Rescan in header
//   - Standard filter chip + period dropdown
//   - Pulse bar showing month progress for context

const B = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const BUDGETS = [
  { team: "Engineering", budget: 80_000, spent: 64_320, alert: 90, status: "on-track" },
  { team: "Payments", budget: 48_000, spent: 41_280, alert: 90, status: "at-risk" },
  { team: "ML Platform", budget: 24_000, spent: 22_840, alert: 85, status: "over" },
  { team: "Data & Analytics", budget: 18_000, spent: 11_402, alert: 90, status: "on-track" },
  { team: "Finance", budget: 12_000, spent: 8_240, alert: 90, status: "on-track" },
  { team: "Sales", budget: 8_000, spent: 6_980, alert: 85, status: "at-risk" },
  { team: "Marketing", budget: 6_000, spent: 3_120, alert: 90, status: "on-track" },
  { team: "Sandbox / shared", budget: 4_000, spent: 1_280, alert: 90, status: "on-track" },
];

const STATUS_COLOR = {
  "on-track": { c: B.good, bg: B.goodBg, b: B.goodBd, label: "On track" },
  "at-risk":  { c: B.warn, bg: B.warnBg, b: B.warnBd, label: "At risk" },
  "over":     { c: B.danger, bg: B.dangerBg, b: B.dangerBd, label: "Over" },
};

// Day of month progress used as expected-pacing benchmark.
const MONTH_DAY = 15;
const MONTH_TOTAL = 31;
const EXPECTED_PCT = Math.round((MONTH_DAY / MONTH_TOTAL) * 100);

function BudgetBar({ pct, status }) {
  const c = STATUS_COLOR[status].c;
  return (
    <div style={{ position: "relative", height: 6, borderRadius: 9999, background: "#f3f4f6", overflow: "visible" }}>
      <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, pct)}%`, background: c, borderRadius: 9999, overflow: "hidden" }} />
      {pct > 100 && (
        <div style={{ position: "absolute", left: "100%", top: 0, width: 4, height: 6, background: B.danger }} />
      )}
      {/* Expected-pacing marker */}
      <div title={`Expected at day ${MONTH_DAY} of ${MONTH_TOTAL}`} style={{
        position: "absolute", top: -3, left: `${EXPECTED_PCT}%`,
        width: 2, height: 12, background: "#6b7280", opacity: 0.5,
      }} />
    </div>
  );
}

function BudgetCard({ b }) {
  const pct = Math.round((b.spent / b.budget) * 100);
  const s = STATUS_COLOR[b.status];
  const drift = pct - EXPECTED_PCT;
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.border}`,
      borderRadius: 10, padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: B.text, margin: 0 }}>{b.team}</p>
          <p style={{ fontSize: 11, color: B.xMuted, margin: "2px 0 0" }}>Monthly · alerts at {b.alert}%</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, color: s.c,
          background: s.bg, padding: "2px 8px", borderRadius: 4, border: `1px solid ${s.b}`,
        }}>{s.label}</span>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: B.text }}>
            ${b.spent.toLocaleString()}
            <span style={{ fontSize: 12, color: B.xMuted, fontWeight: 400, marginLeft: 4 }}>/ ${b.budget.toLocaleString()}</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: s.c, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
        <BudgetBar pct={pct} status={b.status} />
        <p style={{ fontSize: 11, color: B.xMuted, margin: "6px 0 0", display: "flex", justifyContent: "space-between" }}>
          <span>Expected at day {MONTH_DAY}: {EXPECTED_PCT}%</span>
          <span style={{ color: drift > 5 ? B.warn : drift < -5 ? B.good : B.xMuted }}>
            {drift > 0 ? `+${drift}pp ahead` : drift < 0 ? `${drift}pp behind` : "on pace"}
          </span>
        </p>
      </div>
    </div>
  );
}

const B_VIEWS = [
  { id: "all",       label: "All teams",         owner: "shared" },
  { id: "at-risk",   label: "Teams at risk",     owner: "shared", note: "Over budget or projected to exceed" },
  { id: "mine",      label: "My team",           owner: "you" },
  { id: "by-cc",     label: "By cost-center",    owner: "shared" },
];

function BudgetsViewsPicker({ activeId, open, onToggle }) {
  const active = B_VIEWS.find((v) => v.id === activeId) || B_VIEWS[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : B.surface,
        border: `1px solid ${B.border}`, borderRadius: 6,
        color: B.text, fontWeight: 500,
      }}>
        <span style={{ color: B.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: B.xMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320,
          background: B.surface, border: `1px solid ${B.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: B.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{ fontSize: 11, color: B.muted, background: "transparent", border: "none" }}>+ Save current</button>
          </div>
          {B_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: B.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: B.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: B.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetsPage() {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const total = BUDGETS.reduce((a, b) => a + b.budget, 0);
  const spent = BUDGETS.reduce((a, b) => a + b.spent, 0);
  const overCount = BUDGETS.filter((b) => b.status === "over").length;
  const atRiskCount = BUDGETS.filter((b) => b.status === "at-risk").length;
  const pctOverall = Math.round((spent / total) * 100);

  return (
    <div style={{
      padding: 32, maxWidth: 1280,
      background: B.bg,
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: B.text, margin: 0 }}>Budgets</h1>
          <p style={{ fontSize: 13, color: B.muted, margin: "4px 0 0" }}>
            <b style={{ color: B.text2, fontWeight: 600 }}>${spent.toLocaleString()}</b> spent of <b style={{ color: B.text2, fontWeight: 600 }}>${total.toLocaleString()}</b> ({pctOverall}%)
            <span style={{ color: B.xMuted }}> · </span>
            <b style={{ color: B.danger, fontWeight: 600 }}>{overCount}</b> over
            <span style={{ color: B.xMuted }}> · </span>
            <b style={{ color: B.warn, fontWeight: 600 }}>{atRiskCount}</b> at risk
            <span style={{ color: B.xMuted }}> · </span>
            day {MONTH_DAY} of {MONTH_TOTAL}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            fontSize: 12, color: B.text2, background: B.surface, border: `1px solid ${B.border}`,
            borderRadius: 6, padding: "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span>⟳ Rescan</span>
            <span style={{ color: B.xMuted, fontWeight: 400 }}>· last 2h ago</span>
          </button>
          <button style={{ fontSize: 12, color: "#fff", background: B.text, border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 500 }}>+ New budget</button>
        </div>
      </div>

      {/* Row 1: View picker + share + save + period */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <BudgetsViewsPicker activeId="all" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: B.text2,
          background: B.surface, border: `1px solid ${B.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: B.muted, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 6 }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <span style={{
          padding: "5px 10px", fontSize: 12, color: B.text,
          background: B.surface, border: `1px solid ${B.border}`, borderRadius: 6, fontWeight: 500,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ color: B.xMuted, fontWeight: 400 }}>Period:</span>
          May 2026 <span style={{ color: B.xMuted }}>▾</span>
        </span>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["All", "Over budget", "At risk", "On track"].map((f, i) => {
          const on = i === 0;
          return (
            <button key={f} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
              borderRadius: 6, border: `1px solid ${on ? B.text : B.border}`,
              background: on ? B.text : B.surface,
              color: on ? "#fff" : B.muted,
            }}>{f}</button>
          );
        })}
      </div>

      {/* Budget cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {BUDGETS.map((b) => <BudgetCard key={b.team} b={b} />)}
      </div>
    </div>
  );
}

Object.assign(window, { BudgetsPage });
