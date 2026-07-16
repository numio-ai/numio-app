// page-usage.jsx — IA v2 — tag-driven Usage page.
// Iteration 2 — addresses feedback:
//   (1) KPI strip removed; total + delta + forecast moved inline above the
//       chart. Saves ~120px of vertical space and ditches non-actionable
//       signals like "GROUPS: 7".
//   (2) Saved views consolidated into a dropdown picker (Views ▾) with
//       per-view Share (URL) and More actions (rename / set default /
//       delete). Active view shown as a sub-title under the page H1.
//   (3) Period labels propagate from the time range selector — the
//       breakdown table now reads "LAST 30 DAYS" when 30D is active,
//       not a hardcoded "MTD".

// ============================================================
// Time range
// ============================================================
const TIME_RANGES = [
  { id: "7D",  label: "7D",  period: "LAST 7 DAYS",  prev: "previous 7 days" },
  { id: "30D", label: "30D", period: "LAST 30 DAYS", prev: "previous 30 days" },
  { id: "MTD", label: "MTD", period: "MTD",          prev: "previous month-to-date" },
  { id: "QTD", label: "QTD", period: "QTD",          prev: "previous quarter-to-date" },
  { id: "YTD", label: "YTD", period: "YTD",          prev: "previous year-to-date" },
];

// ============================================================
// Tag schema (mirrors numio-impl/mocks/mockTagManagement.js)
// ============================================================
const TAG_SCHEMA = [
  { key: "env", required: true },
  { key: "team", required: true },
  { key: "cost-center", required: true },
  { key: "owner", required: false },
  { key: "service", required: false },
  { key: "criticality", required: false },
];
const PLATFORM_DIMS_COUNT = 5;

const SERIES_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const UNTAGGED_COLOR = "#9ca3af";

// ============================================================
// Stacked area chart
// ============================================================
function UsageStackedArea({ series, days = 30, height = 280 }) {
  const data = Array.from({ length: days }, (_, i) =>
    series.map((s) => Math.max(20, s.base + s.drift * i + Math.sin((i + (s.phase || 0)) / 2.1) * s.amp + Math.cos(i / 1.6) * s.amp * 0.6))
  );
  const w = 1180, h = height, pl = 56, pr = 8, pt = 8, pb = 28;
  const innerW = w - pl - pr, innerH = h - pt - pb;
  const totals = data.map((r) => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals);
  const stepX = innerW / (days - 1);
  const accum = data.map(() => 0);
  const polygons = series.map((s, sIdx) => {
    const top = [], bottom = [];
    for (let i = 0; i < days; i++) {
      const x = pl + i * stepX;
      const baseY = pt + innerH - (accum[i] / max) * innerH;
      accum[i] += data[i][sIdx];
      const topY = pt + innerH - (accum[i] / max) * innerH;
      top.push(`${x},${topY}`); bottom.push(`${x},${baseY}`);
    }
    return { color: s.color, points: `${top.join(" ")} ${bottom.reverse().join(" ")}`, untagged: s.untagged };
  });
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pt + p * innerH;
        return (
          <g key={i}>
            <line x1={pl} x2={pl + innerW} y1={y} y2={y} stroke="#f3f4f6" />
            <text x={pl - 6} y={y + 3} fontSize={10} fill="#9ca3af" textAnchor="end" fontFamily="Inter">
              ${Math.round(max * (1 - p) / 1000)}k
            </text>
          </g>
        );
      })}
      {polygons.map((p, i) => (
        <polygon
          key={i} points={p.points} fill={p.color}
          fillOpacity={p.untagged ? 0.45 : 0.88}
          stroke={p.untagged ? UNTAGGED_COLOR : "none"}
          strokeDasharray={p.untagged ? "3 3" : undefined}
          strokeWidth={p.untagged ? 1 : 0}
        />
      ))}
      {[0, 7, 14, 21, 29].map((i) => (
        <text key={i} x={pl + i * stepX} y={h - 8} fontSize={10} fill="#9ca3af" textAnchor="middle" fontFamily="Inter">
          {`Feb ${10 + i}`}
        </text>
      ))}
    </svg>
  );
}

// ============================================================
// Demo scenarios
// ============================================================
const CLOUD_SCENARIO = {
  total: 274_229,
  delta: -6.4, // % vs previous period
  forecast: { value: 297_500, budget: 320_000, status: "on track" },
  groupBy: { kind: "tag", key: "cost-center" },
  filters: [
    { kind: "platform", key: "service", values: ["Amazon Bedrock"] },
    { kind: "tag", key: "env", values: ["production"] },
  ],
  series: [
    { name: "CC-PAY", color: SERIES_COLORS[0], base: 1400, drift: 12, amp: 90, phase: 0 },
    { name: "CC-ML",  color: SERIES_COLORS[1], base: 1020, drift: 18, amp: 80, phase: 2 },
    { name: "CC-ENG", color: SERIES_COLORS[2], base: 820,  drift: 4,  amp: 60, phase: 1 },
    { name: "CC-DAT", color: SERIES_COLORS[3], base: 540,  drift: 6,  amp: 45, phase: 3 },
    { name: "CC-FIN", color: SERIES_COLORS[4], base: 410,  drift: 1,  amp: 32, phase: 4 },
    { name: "CC-SAL", color: SERIES_COLORS[5], base: 280,  drift: 2,  amp: 22, phase: 5 },
    { name: "Untagged", color: UNTAGGED_COLOR, base: 50,   drift: 0,  amp: 6,  phase: 6, untagged: true },
  ],
  breakdown: [
    { name: "CC-PAY", team: "payments", spend: 84_120, share: 31, trend: "−2.1%", up: false },
    { name: "CC-ML",  team: "ml",       spend: 62_840, share: 23, trend: "+8.4%", up: true },
    { name: "CC-ENG", team: "eng",      spend: 51_300, share: 19, trend: "−1.0%", up: false },
    { name: "CC-DAT", team: "data",     spend: 32_180, share: 12, trend: "+3.2%", up: true },
    { name: "CC-FIN", team: "finance",  spend: 24_500, share: 9,  trend: "+0.4%", up: true },
    { name: "CC-SAL", team: "sales",    spend: 16_400, share: 6,  trend: "+1.8%", up: true },
    { name: "Untagged", team: "—",      spend: 2_840,  share: 1,  trend: "+12%",  up: true, untagged: true },
  ],
};

const AI_SCENARIO = {
  total: 8_900,
  delta: 18.0,
  forecast: null,
  groupBy: { kind: "tag", key: "team" },
  filters: [
    { kind: "platform", key: "provider", values: ["OpenAI"] },
  ],
  series: [
    { name: "payments", color: SERIES_COLORS[0], base: 110, drift: 4, amp: 12, phase: 0 },
    { name: "eng",      color: SERIES_COLORS[1], base: 78,  drift: 3, amp: 10, phase: 2 },
    { name: "data",     color: SERIES_COLORS[2], base: 44,  drift: -1,amp: 6,  phase: 1 },
    { name: "sales",    color: SERIES_COLORS[3], base: 22,  drift: 2, amp: 5,  phase: 3 },
    { name: "ml",       color: SERIES_COLORS[4], base: 20,  drift: 0, amp: 4,  phase: 4 },
    { name: "Untagged", color: UNTAGGED_COLOR,   base: 12,  drift: 0, amp: 3,  phase: 5, untagged: true },
  ],
  breakdown: [
    { name: "payments", spend: 3_840, share: 43, trend: "+12%", up: true },
    { name: "eng",      spend: 2_280, share: 26, trend: "+5%",  up: true },
    { name: "data",     spend: 1_240, share: 14, trend: "−3%",  up: false },
    { name: "sales",    spend: 620,   share: 7,  trend: "+42%", up: true },
    { name: "ml",       spend: 580,   share: 7,  trend: "+8%",  up: true },
    { name: "Untagged", spend: 340,   share: 4,  trend: "+25%", up: true, untagged: true },
  ],
};

const SAVED_VIEWS_CLOUD = [
  { id: "by-cc",      label: "By cost-center · prod", owner: "you",        shared: true },
  { id: "by-team",    label: "By team",               owner: "you",        shared: false },
  { id: "by-env",     label: "By environment",        owner: "shared",     shared: true },
  { id: "by-account", label: "By account",            owner: "shared",     shared: true },
  { id: "by-service", label: "By service",            owner: "alice@",     shared: true },
];
const SAVED_VIEWS_AI = [
  { id: "by-team",     label: "By team",          owner: "you",    shared: true  },
  { id: "by-workload", label: "By workload",      owner: "you",    shared: false },
  { id: "by-model",    label: "By model",         owner: "shared", shared: true  },
  { id: "by-cc",       label: "By cost-center",   owner: "shared", shared: true  },
];

// ============================================================
// UI atoms
// ============================================================
const usageCard = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 24px" };
const usageLabel = { fontSize: 12, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 };

function FilterChip({ kind, dimKey, valuesLabel }) {
  const isTag = kind === "tag";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 4px 5px 10px", fontSize: 12,
      background: isTag ? "#f5f3ff" : "#fff",
      border: `1px solid ${isTag ? "#ddd6fe" : "#e5e5e5"}`,
      color: "#374151", borderRadius: 6,
      whiteSpace: "nowrap",
    }}>
      {isTag && (
        <span title="Tag dimension" style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10, color: "#6d28d9",
          background: "#ede9fe", padding: "1px 5px", borderRadius: 3,
        }}>tag</span>
      )}
      <span style={{ color: "#6b7280" }}>{dimKey}:</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{valuesLabel}</span>
      <button style={{
        width: 18, height: 18, padding: 0, marginLeft: 2,
        color: "#9ca3af", background: "transparent", border: "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4, fontSize: 14, lineHeight: 1,
      }} title="Remove filter">×</button>
    </span>
  );
}

function GroupBySelector({ kind, dimKey }) {
  const isTag = kind === "tag";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", fontSize: 12, color: "#111827",
      background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
      cursor: "pointer", fontWeight: 500,
    }}>
      <span style={{ color: "#9ca3af", fontWeight: 400 }}>Group by:</span>
      {isTag && <span style={{
        fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9",
        background: "#ede9fe", padding: "1px 5px", borderRadius: 3,
      }}>tag</span>}
      <span>{dimKey}</span>
      <span style={{ color: "#9ca3af" }}>▾</span>
    </span>
  );
}

function SmallSelect({ label, value }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", fontSize: 12,
      background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
    }}>
      <span style={{ color: "#9ca3af" }}>{label}:</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{value}</span>
      <span style={{ color: "#9ca3af" }}>▾</span>
    </span>
  );
}

// ============================================================
// Views picker (dropdown)
// ============================================================
function ViewsPicker({ views, activeId, open, onToggle }) {
  const active = views.find((v) => v.id === activeId) || views[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : "#fff",
        border: "1px solid #e5e5e5", borderRadius: 6,
        color: "#111827", fontWeight: 500,
      }}>
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320,
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{
              fontSize: 11, color: "#6b7280",
              background: "transparent", border: "none",
              padding: "2px 6px", borderRadius: 4,
            }}>+ Save current</button>
          </div>
          {views.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
                cursor: "pointer",
              }}>
                <span style={{ width: 14, color: "#111827", fontSize: 12, textAlign: "center" }}>
                  {on ? "✓" : ""}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#111827", fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {v.owner === "you" ? "Created by you" : v.owner === "shared" ? "Shared workspace view" : `Shared by ${v.owner}`}
                  </div>
                </div>
                <button title="Copy link" style={{
                  width: 26, height: 26, padding: 0,
                  background: "transparent", border: "none", borderRadius: 4,
                  color: "#6b7280", display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
                <button title="More" style={{
                  width: 22, height: 22, padding: 0,
                  background: "transparent", border: "none", borderRadius: 4,
                  color: "#6b7280", fontSize: 16, lineHeight: 1,
                }}>⋯</button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <button style={{
            width: "100%", textAlign: "left",
            padding: "6px 8px", fontSize: 12, color: "#6b7280",
            background: "transparent", border: "none", borderRadius: 6,
          }}>Manage all views…</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Breakdown table
// ============================================================
function UsageBreakdown({ groupKey, groupKind, rows, scope, periodLabel }) {
  const isTag = groupKind === "tag";
  const dimColLabel = isTag ? `tag:${groupKey}` : groupKey;
  return (
    <div style={usageCard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ ...usageLabel, marginBottom: 0 }}>
          BREAKDOWN BY {isTag ? "TAG · " : ""}<span style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "none", letterSpacing: 0, color: "#374151" }}>{groupKey}</span>
          <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {periodLabel}</span>
        </p>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{rows.length} groups</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: scope === "cloud" ? "1fr 130px 100px 80px 80px 100px" : "1fr 100px 80px 80px 100px",
        gap: 12, fontSize: 10, fontWeight: 500, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.05em",
        padding: "8px 0", borderBottom: "1px solid #f3f4f6",
      }}>
        <span>{dimColLabel}</span>
        {scope === "cloud" && <span>OWNER (TEAM)</span>}
        <span style={{ textAlign: "right" }}>SPEND</span>
        <span style={{ textAlign: "right" }}>SHARE</span>
        <span style={{ textAlign: "right" }}>Δ vs prev</span>
        <span />
      </div>
      {rows.map((r, idx) => (
        <div key={r.name} style={{
          display: "grid",
          gridTemplateColumns: scope === "cloud" ? "1fr 130px 100px 80px 80px 100px" : "1fr 100px 80px 80px 100px",
          gap: 12, alignItems: "center",
          padding: "10px 0", borderBottom: "1px solid #f3f4f6",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: r.untagged ? UNTAGGED_COLOR : SERIES_COLORS[idx % SERIES_COLORS.length], opacity: r.untagged ? 0.55 : 1 }} />
            <span style={{
              fontSize: 13, fontWeight: r.untagged ? 400 : 500,
              color: r.untagged ? "#9ca3af" : "#111827",
              fontFamily: isTag && !r.untagged ? "JetBrains Mono, monospace" : "inherit",
              fontStyle: r.untagged ? "italic" : "normal",
            }}>{r.name}</span>
            {r.untagged && (
              <a style={{ fontSize: 11, color: "#6d28d9", fontWeight: 500 }}>Fix in Tag Governance →</a>
            )}
          </span>
          {scope === "cloud" && <span style={{ fontSize: 12, color: "#6b7280" }}>{r.team || "—"}</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: r.untagged ? "#9ca3af" : "#111827", textAlign: "right" }}>${r.spend.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>{r.share}%</span>
          <span style={{ fontSize: 12, color: r.up ? "#d97706" : "#16a34a", textAlign: "right" }}>{r.trend}</span>
          <span style={{ textAlign: "right" }}>
            <button style={{ fontSize: 11, color: "#3B5BDB", background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px" }}>Inspect →</button>
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Untagged spend callout — slim, action-oriented.
// ============================================================
function UntaggedCallout({ untaggedRow, dimKey }) {
  if (!untaggedRow || untaggedRow.spend === 0) return null;
  return (
    <div style={{
      background: "#fffbeb", border: "1px solid #fde68a",
      borderRadius: 8, padding: "8px 12px",
      marginBottom: 12,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      fontSize: 12,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 9, background: "#fde68a",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#92400e", fontWeight: 700, fontSize: 11, flexShrink: 0,
      }}>!</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>
        ${untaggedRow.spend.toLocaleString()}
      </span>
      <span style={{ color: "#6b7280" }}>has no</span>
      <code style={{ fontFamily: "JetBrains Mono, monospace", background: "#fff", padding: "1px 6px", borderRadius: 3, color: "#374151" }}>{dimKey}</code>
      <span style={{ color: "#6b7280" }}>tag — can't be allocated.</span>
      <span style={{ flex: 1 }} />
      <a style={{ fontSize: 12, color: "#6d28d9", fontWeight: 500 }}>Fix in Tag Governance →</a>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
function UsagePage({ initialScope = "cloud" }) {
  const [scope, setScope] = React.useState(initialScope);
  const [rangeId, setRangeId] = React.useState("30D");
  const [viewsOpen, setViewsOpen] = React.useState(false);

  const isCloud = scope === "cloud";
  const S = isCloud ? CLOUD_SCENARIO : AI_SCENARIO;
  const savedViews = isCloud ? SAVED_VIEWS_CLOUD : SAVED_VIEWS_AI;
  const activeViewId = savedViews[0].id; // first preset is "active" in this demo
  const untagged = S.breakdown.find((r) => r.untagged);
  const range = TIME_RANGES.find((r) => r.id === rangeId) || TIME_RANGES[1];

  const total = S.total;
  const delta = S.delta;
  const deltaUp = delta > 0;
  const totalUp = deltaUp; // for spend, up is bad

  return (
    <div style={{
      padding: 32, maxWidth: 1280,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header: title + time range */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Usage</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Analyze spend across any platform attribute or tag dimension</p>
        </div>
        <div style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {TIME_RANGES.map((t) => {
            const on = t.id === rangeId;
            return (
              <button key={t.id} onClick={() => setRangeId(t.id)} style={{
                padding: "6px 12px", fontSize: 12,
                background: on ? "#111827" : "#fff",
                color: on ? "#fff" : "#6b7280",
                border: "none", borderRight: "1px solid #e5e5e5",
                fontWeight: on ? 500 : 400,
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* Cloud / AI scope tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e5e5", marginBottom: 16 }}>
        {[
          { id: "cloud", label: "Cloud", count: "$274.2k" },
          { id: "ai", label: "AI", count: "$8.9k" },
        ].map((t) => {
          const on = scope === t.id;
          return (
            <button key={t.id} onClick={() => setScope(t.id)} style={{
              padding: "10px 18px", fontSize: 14,
              background: "none", border: "none", cursor: "pointer",
              color: on ? "#111827" : "#6b7280",
              fontWeight: on ? 500 : 400,
              borderBottom: on ? "2px solid #111827" : "2px solid transparent",
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              {t.label}
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Row 1: View picker + Share + Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ViewsPicker views={savedViews} activeId={activeViewId} open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: "#374151",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }} title="Copy view URL">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{
          padding: "5px 10px", fontSize: 12, color: "#6b7280",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <button style={{ padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6 }}>Export CSV</button>
      </div>

      {/* Row 2: Group by + Granularity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <GroupBySelector kind={S.groupBy.kind} dimKey={S.groupBy.key} />
        <SmallSelect label="Granularity" value="Daily" />
        <span style={{ flex: 1 }} />
      </div>

      {/* Row 3: Filter chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>Filters</span>
        {S.filters.map((f, i) => (
          <FilterChip
            key={i} kind={f.kind} dimKey={f.key}
            valuesLabel={f.values.length === 1 ? f.values[0] : `${f.values[0]} +${f.values.length - 1}`}
          />
        ))}
        <button style={{
          padding: "5px 10px", fontSize: 12, color: "#6b7280",
          background: "#fff", border: "1px dashed #d1d5db", borderRadius: 6,
        }}>+ Filter</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {PLATFORM_DIMS_COUNT} platform · {TAG_SCHEMA.length} tags available
          {" · "}
          <a style={{ color: "#6d28d9", fontWeight: 500 }}>Manage tag schema →</a>
        </span>
      </div>

      {/* Untagged callout — slim, inline */}
      <UntaggedCallout untaggedRow={untagged} dimKey={S.groupBy.key} />

      {/* Chart card with inline header: $TOTAL + delta on left, forecast pill on right */}
      <div style={{ ...usageCard, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ ...usageLabel, marginBottom: 6 }}>
              SPEND OVER TIME · {range.period} · BY{" "}
              <span style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "none", letterSpacing: 0, color: "#374151" }}>
                {S.groupBy.kind === "tag" ? `tag:${S.groupBy.key}` : S.groupBy.key}
              </span>
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: "#111827", lineHeight: 1 }}>
                ${total.toLocaleString()}
              </span>
              <span style={{ fontSize: 13, color: totalUp ? "#d97706" : "#16a34a", fontWeight: 500 }}>
                {deltaUp ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% <span style={{ color: "#9ca3af", fontWeight: 400 }}>vs {range.prev}</span>
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {S.forecast && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", fontSize: 12,
                background: "#f0fdf4", color: "#15803d",
                border: "1px solid #bbf7d0", borderRadius: 999,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: "#16a34a" }} />
                Forecast EOM <b style={{ fontWeight: 600 }}>${(S.forecast.value / 1000).toFixed(1)}k</b>
                <span style={{ color: "#15803d", opacity: 0.7 }}>vs ${(S.forecast.budget / 1000).toFixed(0)}k budget · {S.forecast.status}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>CUR · synced 2h ago</span>
          </div>
        </div>

        <UsageStackedArea series={S.series} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
          {S.series.map((s) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: s.color, opacity: s.untagged ? 0.55 : 1,
                border: s.untagged ? `1px dashed ${UNTAGGED_COLOR}` : "none",
              }} />
              <span style={{
                fontSize: 12, color: s.untagged ? "#9ca3af" : "#6b7280",
                fontFamily: s.untagged ? "Inter" : (S.groupBy.kind === "tag" ? "JetBrains Mono, monospace" : "Inter"),
                fontStyle: s.untagged ? "italic" : "normal",
              }}>{s.name}</span>
            </span>
          ))}
        </div>
      </div>

      <UsageBreakdown
        groupKey={S.groupBy.key}
        groupKind={S.groupBy.kind}
        rows={S.breakdown}
        scope={scope}
        periodLabel={range.period}
      />
    </div>
  );
}

Object.assign(window, { UsagePage });
