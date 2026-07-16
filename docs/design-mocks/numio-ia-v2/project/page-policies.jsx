// page-policies.jsx — IA v2, iteration 2.
// Standardized look-and-feel:
//   - Banner removed; signals fold into subtitle
//   - View picker + Share + Save as
//   - ⟳ Rescan in header
//   - Per-row ⋯ menu replaces "Edit" button
//   - Bulk-select action bar
//   - Standard filter chips + mode dropdown

const PL = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const POLICIES = [
  { id: "p-1", name: "Required tags on production resources",
    desc: "Resources in env:production must have cost-center, team, owner.",
    type: "Tag governance", mode: "block", violations: 6, scope: "env:production · all providers", enabled: true },
  { id: "p-2", name: "PR cost regression guard",
    desc: "Block PRs projected to increase team monthly spend by >5%.",
    type: "CI guard", mode: "block", violations: 1, scope: "github://payments/* · +2 repos", enabled: true },
  { id: "p-3", name: "Region lock — production data",
    desc: "Prod data resources may only run in us-east-1 and us-west-2.",
    type: "Placement", mode: "warn", violations: 0, scope: "rds, s3, opensearch · env:production", enabled: true },
  { id: "p-4", name: "GPU instance approval",
    desc: "g5.* and p4.* instances require approval from ML Platform.",
    type: "Approval", mode: "block", violations: 0, scope: "ec2 g5.*, p4.* · all accounts", enabled: true },
  { id: "p-5", name: "Auto-delete unattached EBS after 30 days",
    desc: "Snapshot then delete EBS volumes unattached for 30+ days.",
    type: "Lifecycle", mode: "auto", violations: 38, scope: "ebs · all accounts", enabled: true },
  { id: "p-6", name: "Disallow public S3 buckets in prod",
    desc: "Block creation of S3 buckets with public ACLs in production.",
    type: "Security", mode: "block", violations: 0, scope: "s3 · env:production", enabled: true },
  { id: "p-7", name: "AI model spend caps",
    desc: "Workloads must declare a monthly token budget; throttle at 95%.",
    type: "AI governance", mode: "warn", violations: 2, scope: "openai://*, anthropic://*", enabled: false },
];

const MODE_COLOR = {
  block: { c: PL.danger, bg: PL.dangerBg, b: PL.dangerBd, label: "Block" },
  warn:  { c: PL.warn,   bg: PL.warnBg,   b: PL.warnBd,   label: "Warn" },
  auto:  { c: PL.ai2,    bg: PL.aiBg,     b: "#ddd6fe",   label: "Auto-remediate" },
};

function Toggle({ on }) {
  return (
    <span style={{
      width: 30, height: 18, borderRadius: 9,
      background: on ? PL.text : "#d1d5db",
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

function PolicyRow({ p, selected, onSelect }) {
  const m = MODE_COLOR[p.mode];
  const sel = selected;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "28px 1fr 120px 120px 70px 30px 28px",
      gap: 12, alignItems: "center",
      padding: "12px 14px", borderBottom: "1px solid #f3f4f6",
      background: sel ? "#f5f3ff" : PL.surface,
      boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
    }}>
      <span onClick={onSelect} style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1px solid ${sel ? PL.ai : "#d1d5db"}`,
        background: sel ? PL.ai : PL.surface,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
      }}>{sel ? "✓" : ""}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: PL.text, display: "flex", alignItems: "center", gap: 8 }}>
          {p.name}
          {p.violations > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: PL.danger, background: PL.dangerBg, padding: "1px 7px", borderRadius: 9, border: `1px solid ${PL.dangerBd}` }}>
              {p.violations} violation{p.violations === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: PL.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
        <div style={{ fontSize: 11, color: PL.xMuted, fontFamily: "JetBrains Mono, monospace", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.scope}</div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 500, color: PL.text2,
        background: "#f3f4f6", padding: "3px 10px", borderRadius: 4,
        border: `1px solid ${PL.border}`, width: "fit-content",
      }}>{p.type}</span>
      <span style={{
        fontSize: 11, fontWeight: 500, color: m.c,
        background: m.bg, padding: "3px 10px", borderRadius: 4,
        border: `1px solid ${m.b}`, width: "fit-content",
      }}>{m.label}</span>
      <span style={{ fontSize: 12, color: p.enabled ? PL.good : PL.warn }}>
        {p.enabled ? "Enabled" : "Disabled"}
      </span>
      <Toggle on={p.enabled} />
      <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: PL.xMuted, fontSize: 14 }}>⋯</button>
    </div>
  );
}

const PL_VIEWS = [
  { id: "all",         label: "All policies",       owner: "shared" },
  { id: "violations",  label: "With open violations", owner: "shared", note: "3 policies · 47 violations" },
  { id: "block",       label: "Blocking policies",  owner: "shared" },
  { id: "disabled",    label: "Disabled",           owner: "shared" },
  { id: "mine",        label: "Created by me",      owner: "you" },
];

function PoliciesViewsPicker({ activeId, open, onToggle }) {
  const active = PL_VIEWS.find((v) => v.id === activeId) || PL_VIEWS[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : PL.surface,
        border: `1px solid ${PL.border}`, borderRadius: 6,
        color: PL.text, fontWeight: 500,
      }}>
        <span style={{ color: PL.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: PL.xMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320,
          background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: PL.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{ fontSize: 11, color: PL.muted, background: "transparent", border: "none" }}>+ Save current</button>
          </div>
          {PL_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: PL.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: PL.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: PL.xMuted }}>
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

function PoliciesPage() {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState({});

  const toggleSel = (id) => {
    if (id === "__clear") return setSelected({});
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  };

  const violations = POLICIES.reduce((a, p) => a + p.violations, 0);
  const blocking = POLICIES.filter((p) => p.mode === "block" && p.enabled).length;
  const autoR = POLICIES.filter((p) => p.mode === "auto" && p.enabled).length;
  const selCount = Object.keys(selected).length;

  return (
    <div style={{
      padding: 32, maxWidth: 1280,
      background: PL.bg,
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: PL.text, margin: 0 }}>Policies</h1>
          <p style={{ fontSize: 13, color: PL.muted, margin: "4px 0 0" }}>
            <b style={{ color: PL.text2, fontWeight: 600 }}>{POLICIES.filter((p) => p.enabled).length}</b> active policies
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: PL.text2, fontWeight: 600 }}>{blocking}</b> blocking
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: PL.ai2, fontWeight: 600 }}>{autoR}</b> auto-remediate
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: violations > 0 ? PL.danger : PL.good, fontWeight: 600 }}>{violations}</b> open violation{violations === 1 ? "" : "s"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            fontSize: 12, color: PL.text2, background: PL.surface, border: `1px solid ${PL.border}`,
            borderRadius: 6, padding: "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span>⟳ Rescan</span>
            <span style={{ color: PL.xMuted, fontWeight: 400 }}>· last 12m ago</span>
          </button>
          <button style={{ fontSize: 12, color: "#fff", background: PL.text, border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 500 }}>+ New policy</button>
        </div>
      </div>

      {/* Row 1: views + share + save */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <PoliciesViewsPicker activeId="all" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: PL.text2,
          background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: PL.muted, background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 6 }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <a style={{ fontSize: 12, color: PL.muted }}>Policy library →</a>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["All", "Tag governance", "CI guard", "Placement", "Approval", "Lifecycle", "Security", "AI governance"].map((f, i) => {
          const on = i === 0;
          return (
            <button key={f} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
              borderRadius: 6, border: `1px solid ${on ? PL.text : PL.border}`,
              background: on ? PL.text : PL.surface,
              color: on ? "#fff" : PL.muted,
            }}>{f}</button>
          );
        })}
        <span style={{ flex: 1 }} />
        <span style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${PL.border}`, fontSize: 12, color: PL.muted, background: PL.surface, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: PL.xMuted }}>Mode:</span> All <span style={{ color: PL.xMuted }}>▾</span>
        </span>
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 8,
          background: PL.aiBg, border: "1px solid #c7d2fe",
          borderRadius: 8, fontSize: 12, color: "#3730a3",
        }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: PL.ai }}>·</span>
          <button style={bulkBtnPL}>Enable</button>
          <button style={bulkBtnPL}>Disable</button>
          <button style={bulkBtnPL}>Change mode…</button>
          <button style={bulkBtnPL}>Export</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => toggleSel("__clear")} style={{ fontSize: 11, color: PL.ai, background: "transparent", border: "none" }}>Clear</button>
        </div>
      )}

      {/* Policies table */}
      <div style={{ background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 120px 120px 70px 30px 28px",
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: `1px solid ${PL.border}`,
          fontSize: 10, fontWeight: 500, color: PL.xMuted, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: "1px solid #d1d5db", background: PL.surface,
          }} />
          <span>POLICY</span>
          <span>TYPE</span>
          <span>MODE</span>
          <span>STATUS</span>
          <span>ON</span>
          <span />
        </div>
        {POLICIES.map((p) => (
          <PolicyRow key={p.id} p={p} selected={!!selected[p.id]} onSelect={() => toggleSel(p.id)} />
        ))}
      </div>

      <p style={{ fontSize: 12, color: PL.xMuted, marginTop: 10 }}>
        Showing {POLICIES.length} of {POLICIES.length} policies
      </p>
    </div>
  );
}

const bulkBtnPL = {
  fontSize: 12, fontWeight: 500, color: "#4338ca",
  background: PL.surface, border: "1px solid #c7d2fe",
  borderRadius: 6, padding: "4px 10px",
};

Object.assign(window, { PoliciesPage });
