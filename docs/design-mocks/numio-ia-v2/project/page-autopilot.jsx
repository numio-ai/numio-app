// page-autopilot.jsx — IA v2 — iteration 2.
// Changes vs prior:
//   (1) Banner removed; status + signals fold into subtitle.
//   (2) Tabs: Rules · History — History promotes the action log from
//       footnote to peer surface, with per-action Undo within window.
//   (3) Per-rule "Edit" label dropped; toggle + ⋯ menu (Edit /
//       Duplicate / View runs / Archive).
//   (4) Bulk action bar (pattern from Resources).
//   (5) "+ New rule" picker with three tabs: From recommendation,
//       From template, From scratch.
//   (6) Delete is gated: Archive is the default off-switch; hard
//       Delete is only available in the archived sub-menu.
//   (7) Safety controls promoted to dedicated modal.
//   (8) Standard view picker / share / save-as / refresh toolbar.

// ============================================================
// Tokens (mirror Recommendations vocabulary)
// ============================================================
const AP = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
};

// ============================================================
// Data
// ============================================================
const RULES = [
  { id: "rule-1", name: "Hibernate idle nonprod overnight",
    desc: "Stops EC2 / EKS in env=dev,sandbox at 8pm local; resumes on PR push or 6am.",
    scope: "env in (dev, sandbox)", schedule: "Nightly 8pm local",
    status: "active", runs7d: 32, saved7d: 4_280, lastRun: "2h ago" },
  { id: "rule-2", name: "Reclaim unattached EBS volumes",
    desc: "Snapshot + delete EBS volumes unattached > 30d. 7-day undelete window.",
    scope: "ebs, age > 30d", schedule: "Daily 03:00 UTC",
    status: "active", runs7d: 4, saved7d: 612, lastRun: "1d ago" },
  { id: "rule-3", name: "Block over-budget PRs",
    desc: "Posts comment + requires approval on PRs projected > 5% over team budget.",
    scope: "github://payments/*", schedule: "On PR open / update",
    status: "active", runs7d: 2, saved7d: 8_620, lastRun: "14m ago" },
  { id: "rule-4", name: "Right-size RDS instances",
    desc: "Proposes smaller class for RDS with p95 CPU < 20% for 14d. Auto-applies at tier-2 or below.",
    scope: "rds, p95 CPU<20% for 14d", schedule: "Weekly Sun 04:00 UTC",
    status: "active", runs7d: 1, saved7d: 1_820, lastRun: "3d ago" },
  { id: "rule-5", name: "Throttle Sales Copilot at 95% budget",
    desc: "Switches GPT-4 calls to GPT-3.5 when monthly spend > 95% of $400 budget.",
    scope: "openai://sales-copilot", schedule: "On budget threshold",
    status: "paused", runs7d: 0, saved7d: 0, lastRun: "—" },
];

const HISTORY = [
  { id: "act-019", t: "12m ago", abs: "Mar 8 · 16:08 UTC", rule: "Block over-budget PRs",
    target: "github://payments/service-ledger#4821",
    outcome: "blocked", saved: 4310, undo: "advisory" /* nothing to undo, advisory action */ },
  { id: "act-018", t: "2h ago", abs: "Mar 8 · 14:22 UTC", rule: "Hibernate idle nonprod overnight",
    target: "18 EC2 in aws://dev/*",
    outcome: "stopped", saved: 1840, undo: { type: "active", left: "6h 12m" } },
  { id: "act-017", t: "8h ago", abs: "Mar 8 · 08:00 UTC", rule: "Hibernate idle nonprod overnight",
    target: "14 EC2 in aws://dev/*",
    outcome: "resumed", saved: null, undo: "auto-resumed" /* by 6am rule itself */ },
  { id: "act-016", t: "1d ago", abs: "Mar 7 · 03:14 UTC", rule: "Reclaim unattached EBS volumes",
    target: "vol-079b3f12c4ad99e + 5",
    outcome: "deleted", saved: 92, undo: { type: "active", left: "5d 21h" } },
  { id: "act-015", t: "2d ago", abs: "Mar 6 · 19:42 UTC", rule: "Block over-budget PRs",
    target: "github://ml/training-runner#221",
    outcome: "blocked", saved: 980, undo: "advisory" },
  { id: "act-014", t: "3d ago", abs: "Mar 5 · 04:00 UTC", rule: "Right-size RDS instances",
    target: "db-staging-1 → db.r6g.large",
    outcome: "resized", saved: 1820, undo: { type: "active", left: "3d 22h" } },
  { id: "act-013", t: "4d ago", abs: "Mar 4 · 03:14 UTC", rule: "Reclaim unattached EBS volumes",
    target: "vol-0a1d…3e8 + 3",
    outcome: "deleted", saved: 48, undo: { type: "expired" } },
  { id: "act-012", t: "5d ago", abs: "Mar 3 · 22:00 UTC", rule: "Hibernate idle nonprod overnight",
    target: "21 EC2 in aws://dev/* + gcp://sandbox/*",
    outcome: "stopped", saved: 2120, undo: { type: "expired" } },
];

const SAVED_VIEWS = [
  { id: "all",      label: "All rules",          owner: "shared" },
  { id: "active",   label: "Active only",        owner: "shared", note: "Currently running" },
  { id: "mine",     label: "Created by me",      owner: "you" },
  { id: "archived", label: "Archived",           owner: "shared", note: "Disabled but kept in history" },
];

// ============================================================
// Atoms
// ============================================================
const labelXS = {
  fontSize: 10, fontWeight: 500, color: AP.xMuted,
  textTransform: "uppercase", letterSpacing: "0.05em",
};

function StatusPill({ paused }) {
  if (paused) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 500, color: AP.warn,
        background: AP.warnBg, border: `1px solid ${AP.warnBd}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: AP.warn }} />
        Paused
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 500, color: AP.good,
      background: AP.goodBg, border: `1px solid ${AP.goodBd}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: AP.good }} />
      Active
    </span>
  );
}

function Toggle({ on }) {
  return (
    <span style={{
      width: 30, height: 18, borderRadius: 9,
      background: on ? AP.text : "#d1d5db",
      position: "relative", display: "inline-block",
      transition: "background 150ms", cursor: "pointer",
    }}>
      <span style={{
        position: "absolute", top: 2,
        left: on ? 14 : 2, width: 14, height: 14, borderRadius: 7,
        background: "#fff", transition: "left 150ms",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }} />
    </span>
  );
}

function APChip({ children, tone = "neutral" }) {
  const p = {
    neutral: { c: AP.text2, bg: "#f3f4f6", b: AP.border },
    good:    { c: AP.good,  bg: AP.goodBg, b: AP.goodBd },
    warn:    { c: AP.warn,  bg: AP.warnBg, b: AP.warnBd },
    danger:  { c: AP.danger, bg: AP.dangerBg, b: AP.dangerBd },
    ai:      { c: AP.ai2,   bg: AP.aiBg, b: AP.aiBd },
  }[tone];
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, color: p.c,
      background: p.bg, border: `1px solid ${p.b}`,
      padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function ToolbarBtn({ children, onClick, hint }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", fontSize: 12,
      background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6,
      color: AP.text2, fontWeight: 500,
    }}>
      {hint && <span style={{ color: AP.xMuted, fontWeight: 400 }}>{hint}:</span>}
      {children}
      <span style={{ color: AP.xMuted }}>▾</span>
    </button>
  );
}

function ViewsPicker({ activeId, open, onToggle, views }) {
  const active = views.find((v) => v.id === activeId) || views[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : AP.surface,
        border: `1px solid ${AP.border}`, borderRadius: 6,
        color: AP.text, fontWeight: 500,
      }}>
        <span style={{ color: AP.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: AP.xMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320,
          background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ ...labelXS }}>Saved views</span>
            <button style={{ fontSize: 11, color: AP.muted, background: "transparent", border: "none" }}>+ Save current</button>
          </div>
          {views.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: AP.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: AP.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: AP.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button title="Copy link" style={{
                  width: 26, height: 26, padding: 0, background: "transparent",
                  border: "none", borderRadius: 4, color: AP.muted,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
                <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: AP.muted, fontSize: 16, lineHeight: 1 }}>⋯</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Header — status pill, signals, page actions
// ============================================================
function AutopilotHeader({ paused, onPauseAll, onSafety, onNewRule }) {
  const stats = {
    rulesActive: 4, rulesTotal: 5,
    actions7d: 39, saved7d: 14_732,
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: AP.text, margin: 0 }}>Autopilot</h1>
          <StatusPill paused={paused} />
        </div>
        <p style={{ fontSize: 13, color: AP.muted, margin: "4px 0 0" }}>
          <b style={{ color: AP.text2, fontWeight: 600 }}>{stats.rulesActive} of {stats.rulesTotal}</b> rules active
          <span style={{ color: AP.xMuted }}> · </span>
          <b style={{ color: AP.text2, fontWeight: 600 }}>{stats.actions7d}</b> actions this week saved <b style={{ color: AP.good, fontWeight: 600 }}>${stats.saved7d.toLocaleString()}</b>
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={onPauseAll} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: AP.muted, background: AP.surface,
          border: `1px solid ${AP.border}`, borderRadius: 6, padding: "6px 12px",
        }}>{paused ? "▶ Resume all" : "⏸ Pause all"}</button>
        <button onClick={onSafety} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: AP.text2, background: AP.surface,
          border: `1px solid ${AP.border}`, borderRadius: 6, padding: "6px 12px",
        }}>⚙ Safety controls</button>
        <button onClick={onNewRule} style={{
          fontSize: 12, color: "#fff", background: AP.text, border: "none",
          borderRadius: 6, padding: "6px 14px", fontWeight: 500,
        }}>+ New rule</button>
      </div>
    </div>
  );
}

// ============================================================
// Tabs
// ============================================================
function Tabs({ active, onChange }) {
  const tabs = [
    { id: "rules", label: "Rules", count: 5 },
    { id: "history", label: "History", count: "39 this week" },
  ];
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${AP.border}`, marginBottom: 16 }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: "10px 18px", fontSize: 14,
            background: "none", border: "none",
            color: on ? AP.text : AP.muted,
            fontWeight: on ? 500 : 400,
            borderBottom: on ? `2px solid ${AP.text}` : "2px solid transparent",
            marginBottom: -1,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            {t.label}
            <span style={{ fontSize: 11, color: AP.xMuted, fontWeight: 400 }}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Rules tab
// ============================================================
function RulesTab({ selected, onToggleSelect }) {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const filters = ["All", "Active", "Paused", "Archived"];
  const activeFilter = "All";
  const selCount = Object.keys(selected).length;

  return (
    <div>
      {/* Toolbar row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <ViewsPicker activeId="all" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} views={SAVED_VIEWS} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: AP.text2,
          background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: AP.muted, background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6 }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <button style={{ padding: "5px 10px", fontSize: 12, color: AP.text2, background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6 }}>⟳ Refresh</button>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {filters.map((f) => {
          const on = f === activeFilter;
          return (
            <button key={f} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
              borderRadius: 6, border: `1px solid ${on ? AP.text : AP.border}`,
              background: on ? AP.text : AP.surface,
              color: on ? "#fff" : AP.muted,
            }}>{f}</button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 8,
          background: AP.aiBg, border: `1px solid ${AP.aiBd}`,
          borderRadius: 8, fontSize: 12, color: "#3730a3",
        }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: AP.ai }}>·</span>
          <button style={btnGhostSmall}>Pause selected</button>
          <button style={btnGhostSmall}>Resume selected</button>
          <button style={btnGhostSmall}>Archive selected</button>
          <button style={btnGhostSmall}>Export</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => onToggleSelect("__clear")} style={{ fontSize: 11, color: AP.ai, background: "transparent", border: "none" }}>Clear</button>
        </div>
      )}

      {/* Rules table */}
      <div style={{ background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 130px 70px 90px 90px 30px 28px",
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: `1px solid ${AP.border}`,
          ...labelXS,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1px solid #d1d5db`, background: AP.surface,
          }} />
          <span>RULE</span>
          <span>SCHEDULE</span>
          <span style={{ textAlign: "right" }}>RUNS 7D</span>
          <span style={{ textAlign: "right" }}>SAVED 7D</span>
          <span>LAST RUN</span>
          <span>ON</span>
          <span />
        </div>
        {RULES.map((r, idx) => {
          const sel = !!selected[r.id];
          const paused = r.status === "paused";
          return (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 130px 70px 90px 90px 30px 28px",
              gap: 12, padding: "12px 14px",
              alignItems: "center",
              borderBottom: idx < RULES.length - 1 ? "1px solid #f3f4f6" : "none",
              background: sel ? "#f5f3ff" : AP.surface,
              boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
            }}>
              <span onClick={() => onToggleSelect(r.id)} style={{
                width: 14, height: 14, borderRadius: 3,
                border: `1px solid ${sel ? AP.ai : "#d1d5db"}`,
                background: sel ? AP.ai : AP.surface,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
              }}>{sel ? "✓" : ""}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: AP.text, display: "flex", alignItems: "center", gap: 8 }}>
                  {r.name}
                  {paused && <APChip tone="warn">paused</APChip>}
                </div>
                <div style={{ fontSize: 11, color: AP.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: AP.xMuted }}>scope: {r.scope}</span>
                  <span style={{ color: AP.xMuted }}> · </span>
                  {r.desc}
                </div>
              </div>
              <span style={{ fontSize: 12, color: AP.muted }}>{r.schedule}</span>
              <span style={{ fontSize: 13, color: AP.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.runs7d}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: r.saved7d > 0 ? AP.good : AP.xMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                ${r.saved7d.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: AP.muted }}>{r.lastRun}</span>
              <Toggle on={!paused} />
              <button title="Actions" style={{
                width: 22, height: 22, padding: 0,
                background: "transparent", border: "none", borderRadius: 4,
                color: AP.xMuted, fontSize: 14, lineHeight: 1,
              }}>⋯</button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: AP.xMuted, marginTop: 10 }}>
        Showing 5 of 5 rules · <a style={{ color: AP.ai2 }}>View archived (2)</a>
      </p>
    </div>
  );
}

const btnGhostSmall = {
  fontSize: 12, fontWeight: 500, color: "#4338ca",
  background: AP.surface, border: `1px solid ${AP.aiBd}`,
  borderRadius: 6, padding: "4px 10px",
};

// ============================================================
// History tab
// ============================================================
function HistoryTab() {
  return (
    <div>
      {/* Filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ToolbarBtn hint="Rule">All</ToolbarBtn>
        <ToolbarBtn hint="Time">Last 7 days</ToolbarBtn>
        <ToolbarBtn hint="Outcome">All</ToolbarBtn>
        <ToolbarBtn hint="Target">Anywhere</ToolbarBtn>
        <span style={{ flex: 1 }} />
        <button style={{ padding: "5px 10px", fontSize: 12, color: AP.text2, background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6 }}>Export CSV</button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: AP.text2, background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6 }}>⟳ Refresh</button>
      </div>

      {/* Summary line */}
      <div style={{ fontSize: 12, color: AP.muted, marginBottom: 8 }}>
        <b style={{ color: AP.text2 }}>{HISTORY.length}</b> actions in the last 7 days
        <span style={{ color: AP.xMuted }}> · </span>
        <b style={{ color: AP.good }}>${HISTORY.reduce((a, b) => a + (b.saved || 0), 0).toLocaleString()}</b> saved
        <span style={{ color: AP.xMuted }}> · </span>
        <a style={{ color: AP.ai2 }}>Full audit log →</a>
      </div>

      {/* Action log table */}
      <div style={{ background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr 1fr 90px 90px 150px 28px",
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: `1px solid ${AP.border}`,
          ...labelXS,
        }}>
          <span>WHEN</span>
          <span>RULE</span>
          <span>TARGET</span>
          <span>OUTCOME</span>
          <span style={{ textAlign: "right" }}>SAVED</span>
          <span style={{ textAlign: "right" }}>UNDO</span>
          <span />
        </div>
        {HISTORY.map((a, idx) => {
          const outcomeTone = a.outcome === "blocked" || a.outcome === "deleted"
            ? "warn" : a.outcome === "stopped" || a.outcome === "resized" ? "ai" : a.outcome === "resumed" ? "good" : "neutral";
          return (
            <div key={a.id} style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 1fr 90px 90px 150px 28px",
              gap: 12, padding: "11px 14px",
              alignItems: "center",
              borderBottom: idx < HISTORY.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <span style={{ fontSize: 12, color: AP.muted, whiteSpace: "nowrap" }} title={a.abs}>{a.t}</span>
              <span style={{ fontSize: 13, color: AP.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.rule}</span>
              <span style={{ fontSize: 12, color: AP.muted, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.target}</span>
              <APChip tone={outcomeTone}>{a.outcome}</APChip>
              <span style={{ fontSize: 13, fontWeight: 600, color: a.saved != null ? AP.good : AP.xMuted, textAlign: "right" }}>
                {a.saved != null ? `$${a.saved.toLocaleString()}` : "—"}
              </span>
              <span style={{ textAlign: "right" }}>
                {a.undo === "advisory" && <span style={{ fontSize: 11, color: AP.xMuted }}>advisory only</span>}
                {a.undo === "auto-resumed" && <span style={{ fontSize: 11, color: AP.xMuted }}>auto-resumed</span>}
                {typeof a.undo === "object" && a.undo.type === "active" && (
                  <button style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", fontSize: 11, fontWeight: 500,
                    background: AP.surface, color: AP.text,
                    border: `1px solid ${AP.text}`, borderRadius: 6,
                  }}>↶ Undo · {a.undo.left} left</button>
                )}
                {typeof a.undo === "object" && a.undo.type === "expired" && (
                  <span style={{ fontSize: 11, color: AP.xMuted }}>undo expired</span>
                )}
              </span>
              <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: AP.xMuted, fontSize: 14 }}>⋯</button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: AP.xMuted, marginTop: 10, textAlign: "center" }}>
        Loading older history… <span style={{ color: AP.ai2 }}>scroll for more</span>
      </p>
    </div>
  );
}

// ============================================================
// + New rule modal — 3-tab picker
// ============================================================
function NewRuleModal({ onClose }) {
  const [tab, setTab] = React.useState("from-rec");
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: "rgba(17, 24, 39, 0.35)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 40,
    }}>
      <div style={{
        width: 720, maxWidth: "calc(100% - 40px)",
        maxHeight: "calc(100% - 80px)", overflow: "auto",
        background: AP.surface, border: `1px solid ${AP.border}`,
        borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${AP.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={labelXS}>New Autopilot rule</p>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: AP.text, margin: "4px 0 0" }}>Start from a recommendation, template, or scratch</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: AP.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${AP.border}`, padding: "0 20px" }}>
          {[
            { id: "from-rec", label: "From recommendation", note: "audited · evidence-backed", on: true },
            { id: "from-template", label: "From template", note: "common patterns" },
            { id: "from-scratch", label: "From scratch", note: "for power users" },
          ].map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "12px 14px", fontSize: 13,
                background: "none", border: "none",
                color: on ? AP.text : AP.muted,
                fontWeight: on ? 500 : 400,
                borderBottom: on ? `2px solid ${AP.text}` : "2px solid transparent",
                marginBottom: -1,
              }}>
                {t.label}
                <span style={{ fontSize: 11, color: AP.xMuted, marginLeft: 6, fontWeight: 400 }}>· {t.note}</span>
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        <div style={{ padding: "16px 20px", minHeight: 340 }}>
          {tab === "from-rec" && (
            <div>
              <p style={{ fontSize: 13, color: AP.muted, margin: "0 0 12px" }}>
                3 approved recommendations are ready to enable as Autopilot rules.
              </p>
              {[
                { title: "Hibernate 142 idle dev/sandbox resources nightly", save: 11820, cat: "Idle resource" },
                { title: "Reclaim 38 unattached EBS volumes", save: 612, cat: "Orphan reclaim" },
                { title: "Block PRs projected > 5% over team budget", save: 4310, cat: "PR cost regression" },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", marginBottom: 8,
                  background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                      <APChip>{r.cat}</APChip>
                      <APChip tone="ai">✨ AI</APChip>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: AP.text, margin: 0 }}>{r.title}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: AP.good, margin: 0 }}>${r.save.toLocaleString()}/mo</p>
                    <button style={{ marginTop: 4, fontSize: 12, color: "#fff", background: AP.text, border: "none", borderRadius: 6, padding: "5px 12px" }}>Configure →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === "from-template" && (
            <div>
              <p style={{ fontSize: 13, color: AP.muted, margin: "0 0 12px" }}>Common patterns — fill in scope and review the rule before enabling.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { title: "Nightly nonprod hibernate", desc: "Stop dev/sandbox at night; resume on PR push." },
                  { title: "EBS orphan reclaim", desc: "Snapshot + delete unattached volumes after N days." },
                  { title: "PR cost regression guard", desc: "Block PRs projected over team budget by X%." },
                  { title: "RDS right-sizing", desc: "Propose smaller class for low-CPU instances." },
                  { title: "AI model spend cap", desc: "Throttle workload at N% of monthly token budget." },
                  { title: "Region lock", desc: "Block resource creation outside allowed regions." },
                ].map((t, i) => (
                  <div key={i} style={{
                    padding: "12px 14px", background: AP.surface,
                    border: `1px solid ${AP.border}`, borderRadius: 8,
                    cursor: "pointer",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: AP.text, margin: 0 }}>{t.title}</p>
                    <p style={{ fontSize: 12, color: AP.muted, margin: "4px 0 0" }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "from-scratch" && (
            <div>
              <p style={{ fontSize: 13, color: AP.muted, margin: "0 0 12px" }}>Author a rule from scratch. Requires dry-run + approval before enabling.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <p style={labelXS}>Name</p>
                  <input placeholder="e.g. Hibernate idle nonprod" style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: `1px solid ${AP.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit" }} />
                </div>
                <div>
                  <p style={labelXS}>Rule (DSL)</p>
                  <div style={{ marginTop: 4, background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px", fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.7 }}>
                    <div><span style={{ color: "#a5b4fc", fontWeight: 600, width: 74, display: "inline-block" }}>WHEN</span>// condition</div>
                    <div><span style={{ color: "#a5b4fc", fontWeight: 600, width: 74, display: "inline-block" }}>DO</span>// action</div>
                    <div><span style={{ color: "#a5b4fc", fontWeight: 600, width: 74, display: "inline-block" }}>EXCEPT</span>// exclusions</div>
                  </div>
                  <p style={{ fontSize: 11, color: AP.xMuted, marginTop: 4 }}>Reference: <a style={{ color: AP.ai2 }}>Autopilot DSL docs →</a></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${AP.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 12, color: AP.muted, margin: 0 }}>
            New rules require a dry-run + explicit approval before they fire.
          </p>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ fontSize: 12, color: AP.muted, background: AP.surface, border: `1px solid ${AP.border}`, borderRadius: 6, padding: "6px 12px" }}>Cancel</button>
          <button style={{ fontSize: 12, color: "#fff", background: AP.text, border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 500 }}>Continue →</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
function AutopilotPage({ initialTab = "rules", showNewRule = false }) {
  const [tab, setTab] = React.useState(initialTab);
  const [paused, setPaused] = React.useState(false);
  const [selected, setSelected] = React.useState({});
  const [newRuleOpen, setNewRuleOpen] = React.useState(showNewRule);

  const toggleSel = (id) => {
    if (id === "__clear") return setSelected({});
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  };

  return (
    <div style={{
      padding: 32, maxWidth: 1280,
      background: AP.bg,
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box", position: "relative",
    }}>
      <AutopilotHeader
        paused={paused}
        onPauseAll={() => setPaused((p) => !p)}
        onSafety={() => {}}
        onNewRule={() => setNewRuleOpen(true)}
      />
      <Tabs active={tab} onChange={setTab} />
      {tab === "rules" && <RulesTab selected={selected} onToggleSelect={toggleSel} />}
      {tab === "history" && <HistoryTab />}
      {newRuleOpen && <NewRuleModal onClose={() => setNewRuleOpen(false)} />}
    </div>
  );
}

Object.assign(window, { AutopilotPage });
