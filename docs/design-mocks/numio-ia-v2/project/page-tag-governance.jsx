// page-tag-governance.jsx — IA v2, iteration 2.
// Changes vs prior:
//   (1) Heatmap dropped — won't scale past ~30 resources. Replaced
//       with the dense Resources-style table; each required tag is a
//       column with a colored chip cell.
//   (2) Subtitle signals (coverage / gaps / drift / at-risk spend)
//       replace the colored banner.
//   (3) Standard toolbar: View picker + Share + Save as…
//   (4) Tabs simplified: Resources + Tag schema. Audit removed from
//       tabs; surfaced as a small "Activity →" link in toolbar.
//   (5) "Ask Numio" button removed — global chat lives in the app
//       header.
//   (6) Bulk select + action bar (Apply tag, Suggest with Numio,
//       Export selected).
//   (7) Infinite scroll sentinel at the table footer.

// ============================================================
// Tokens
// ============================================================
const TG = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  success: "#16a34a", successBg: "#f0fdf4", successBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

// ============================================================
// Schema + sample resources (extended for density)
// ============================================================
const TG_KEYS = [
  { key: "env",         required: true,  allowed: ["production", "staging", "dev", "sandbox"], coverage: 91 },
  { key: "team",        required: true,  allowed: ["payments", "ml", "data", "eng", "finance", "sales"], coverage: 84 },
  { key: "cost-center", required: true,  allowed: ["CC-PAY", "CC-ML", "CC-DAT", "CC-ENG", "CC-FIN", "CC-SAL"], coverage: 73 },
  { key: "owner",       required: false, allowed: null, coverage: 56 },
  { key: "service",     required: false, allowed: null, coverage: 41 },
  { key: "criticality", required: false, allowed: ["tier-1", "tier-2", "tier-3"], coverage: 22 },
];

const TG_RES = [
  { id: "i-0a4f8c2d", name: "payments-api-prod-3", svc: "EC2", spend: 842,
    tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "payments-api", criticality: "tier-1" } },
  { id: "i-0fc7b21e", name: "ml-train-worker-04",   svc: "EC2", spend: 3120,
    tags: { env: "staging", team: "ml", owner: null, service: "ml-train", criticality: "tier-2" } },
  { id: "db-fin-1",   name: "finance-prod-1",       svc: "RDS", spend: 2840,
    tags: { env: "production", team: "finance", "cost-center": "CC-FIN", owner: "diana@", service: "finance-svc", criticality: "tier-1" } },
  { id: "vol-079b3",  name: "logs-archive-volume",  svc: "EBS", spend: 96,
    tags: { env: "production", team: null, owner: null, service: null } },
  { id: "i-08fa3c1",  name: "sandbox-dev-runner",   svc: "EC2", spend: 0,
    tags: { env: "sandbox", team: "eng", "cost-center": "CC-ENG", owner: "carl@" } },
  { id: "lf-search",  name: "internal-search-lambda", svc: "Lambda", spend: 318,
    tags: { env: "production", team: "eng", "cost-center": "CC-ENG", owner: "bob@", service: "search-api", criticality: "tier-2" } },
  { id: "eip-0c1f",   name: "—",                       svc: "EIP", spend: 4,
    tags: {} },
  { id: "snap-0d7f",  name: "logs-snapshot-2024-02", svc: "EBS Snapshot", spend: 22,
    tags: { env: "production" } },
  { id: "i-09ce772",  name: "checkout-api-prod-1",   svc: "EC2", spend: 412,
    tags: { env: "prod" /* drift */, team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "checkout", criticality: "tier-1" } },
  { id: "redshift-1", name: "analytics-warehouse",   svc: "Redshift", spend: 4820,
    tags: { env: "production", team: "data", "cost-center": "CC-DAT", criticality: "tier-1" } },
  { id: "os-logs",    name: "logs-search-prod",      svc: "OpenSearch", spend: 660,
    tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "ec-redis-1", name: "session-cache-1",       svc: "ElastiCache", spend: 480,
    tags: { env: "production", team: "eng" } },
  { id: "s3-static",  name: "static-assets-prod",    svc: "S3", spend: 612,
    tags: { env: "production", team: "eng", "cost-center": "CC-ENG" } },
];

// ============================================================
// Cell classification
// ============================================================
function classifyCell(value, schema) {
  if (value == null) return schema.required ? "missing-req" : "missing-opt";
  if (schema.allowed && !schema.allowed.includes(value)) return "drift";
  return "ok";
}
const CELL = {
  ok:            { bg: TG.successBg, border: TG.successBd, color: TG.success },
  drift:         { bg: TG.warnBg,    border: TG.warnBd,    color: TG.warn },
  "missing-req": { bg: TG.dangerBg,  border: TG.dangerBd,  color: TG.danger },
  "missing-opt": { bg: "#f9fafb",    border: "#e5e7eb",    color: TG.xMuted },
};

function TGCell({ value, schema }) {
  const cls = classifyCell(value, schema);
  const c = CELL[cls];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 3,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color,
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 11, fontWeight: 500,
      maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }} title={cls === "drift" ? `Drift: not in allowed values` : cls === "missing-req" ? "Required tag missing" : cls === "missing-opt" ? "Optional tag missing" : value}>
      {value == null ? (schema.required ? "—" : "·") : value}
    </span>
  );
}

// ============================================================
// Atoms — view picker, toolbar chips (mirrors prior pages)
// ============================================================
function FilterChipTG({ kind, dimKey, valuesLabel }) {
  const isTag = kind === "tag";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 4px 4px 8px", fontSize: 12,
      background: isTag ? "#f5f3ff" : TG.surface,
      border: `1px solid ${isTag ? "#ddd6fe" : TG.border}`,
      color: TG.text2, borderRadius: 6, whiteSpace: "nowrap",
    }}>
      {isTag && (
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9",
          background: "#ede9fe", padding: "1px 5px", borderRadius: 3,
        }}>tag</span>
      )}
      <span style={{ color: TG.muted }}>{dimKey}:</span>
      <span style={{ color: TG.text, fontWeight: 500 }}>{valuesLabel}</span>
      <button style={{
        width: 16, height: 16, padding: 0, marginLeft: 2,
        color: TG.xMuted, background: "transparent", border: "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4, fontSize: 13, lineHeight: 1,
      }}>×</button>
    </span>
  );
}

const TG_VIEWS = [
  { id: "missing-req",  label: "Resources missing required tags", owner: "shared", note: "5 resources · $7.4k/mo at risk" },
  { id: "drift",        label: "Drift (invalid values)",          owner: "shared", note: "1 resource flagged" },
  { id: "no-cc",        label: "Missing cost-center",             owner: "shared" },
  { id: "by-svc",       label: "Grouped by service",              owner: "you" },
  { id: "all",          label: "All resources",                   owner: "shared" },
];

function ViewsPickerTG({ activeId, open, onToggle }) {
  const active = TG_VIEWS.find((v) => v.id === activeId) || TG_VIEWS[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : TG.surface,
        border: `1px solid ${TG.border}`, borderRadius: 6,
        color: TG.text, fontWeight: 500,
      }}>
        <span style={{ color: TG.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: TG.xMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 340,
          background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: TG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{ fontSize: 11, color: TG.muted, background: "transparent", border: "none" }}>+ Save current</button>
          </div>
          {TG_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: TG.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TG.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: TG.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: TG.muted }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Resources tab
// ============================================================
function ResourcesTab({ selected, onToggleSelect }) {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const selCount = Object.keys(selected).length;
  const filters = [
    { kind: "tag", key: "env", values: ["production", "staging"] },
  ];

  return (
    <div>
      {/* Row 1: views + share + save */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ViewsPickerTG activeId="missing-req" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: TG.text2,
          background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: TG.muted, background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6 }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <a style={{ fontSize: 12, color: TG.muted }}>Activity →</a>
      </div>

      {/* Row 2: filter chips + columns */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: TG.xMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Filters</span>
        {filters.map((f, i) => (
          <FilterChipTG key={i} kind={f.kind} dimKey={f.key} valuesLabel={`${f.values[0]} +${f.values.length - 1}`} />
        ))}
        <button style={{
          padding: "5px 10px", fontSize: 12, color: TG.muted,
          background: TG.surface, border: "1px dashed #d1d5db", borderRadius: 6,
        }}>+ Filter</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: TG.xMuted }}>
          Status filter:
        </span>
        <div style={{ display: "inline-flex", border: `1px solid ${TG.border}`, borderRadius: 6, overflow: "hidden" }}>
          {[
            { id: "all", l: "All", n: 1284 },
            { id: "missing", l: "Missing required", n: 346, on: true },
            { id: "drift", l: "Drift", n: 18 },
          ].map((f) => {
            const on = f.on;
            return (
              <button key={f.id} style={{
                padding: "5px 10px", fontSize: 12,
                background: on ? TG.text : TG.surface,
                color: on ? "#fff" : TG.muted,
                border: "none", borderRight: `1px solid ${TG.border}`,
                fontWeight: on ? 500 : 400,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>{f.l}<span style={{ color: on ? "#d1d5db" : TG.xMuted, fontWeight: 400, fontSize: 11 }}>{f.n}</span></button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", fontSize: 13,
          background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search by name, ID, or tag value…" style={{
            flex: 1, border: "none", outline: "none", fontSize: 13,
            background: "transparent", color: TG.text, fontFamily: "inherit",
          }} />
        </div>
        {selCount === 0 && <span style={{ fontSize: 11, color: TG.xMuted }}>346 with gaps · scroll for more</span>}
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 8,
          background: TG.aiBg, border: "1px solid #c7d2fe",
          borderRadius: 8, fontSize: 12, color: "#3730a3",
        }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: TG.ai }}>·</span>
          <button style={bulkBtn}>Apply tag…</button>
          <button style={bulkBtn}>✨ Suggest with Numio</button>
          <button style={bulkBtn}>Bulk rename value</button>
          <button style={bulkBtn}>Export</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => onToggleSelect("__clear")} style={{ fontSize: 11, color: TG.ai, background: "transparent", border: "none" }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `28px 1fr 80px ${TG_KEYS.map((k) => k.required ? "120px" : "110px").join(" ")} 80px 28px`,
          gap: 8, padding: "9px 14px",
          background: "#fafafa", borderBottom: `1px solid ${TG.border}`,
          fontSize: 10, fontWeight: 500, color: TG.xMuted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          position: "sticky", top: 0, zIndex: 1,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1px solid #d1d5db`, background: TG.surface,
          }} />
          <span>RESOURCE</span>
          <span>SERVICE</span>
          {TG_KEYS.map((k) => (
            <span key={k.key} style={{
              fontFamily: "JetBrains Mono, monospace",
              color: TG.text2, textTransform: "none",
              fontWeight: 500,
            }}>
              {k.key}
              {k.required && <span style={{ marginLeft: 3, color: TG.danger }}>*</span>}
            </span>
          ))}
          <span style={{ textAlign: "right" }}>SPEND</span>
          <span />
        </div>

        {/* Body */}
        {TG_RES.map((r, idx) => {
          const sel = !!selected[r.id];
          const reqGaps = TG_KEYS.filter((k) => k.required && classifyCell(r.tags[k.key], k) === "missing-req").length;
          return (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: `28px 1fr 80px ${TG_KEYS.map((k) => k.required ? "120px" : "110px").join(" ")} 80px 28px`,
              gap: 8, padding: "10px 14px",
              alignItems: "center",
              minHeight: 38,
              borderBottom: idx < TG_RES.length - 1 ? "1px solid #f3f4f6" : "none",
              background: sel ? "#f5f3ff" : TG.surface,
              boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
            }}>
              <span onClick={() => onToggleSelect(r.id)} style={{
                width: 14, height: 14, borderRadius: 3,
                border: `1px solid ${sel ? TG.ai : "#d1d5db"}`,
                background: sel ? TG.ai : TG.surface,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
              }}>{sel ? "✓" : ""}</span>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 500, color: TG.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200,
                }}>{r.name === "—" ? r.id : r.name}</span>
                {reqGaps > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: TG.danger,
                    background: TG.dangerBg, border: `1px solid ${TG.dangerBd}`,
                    padding: "1px 6px", borderRadius: 9,
                  }}>{reqGaps} {reqGaps === 1 ? "gap" : "gaps"}</span>
                )}
                <span style={{ fontSize: 11, color: TG.xMuted, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.id.length > 18 ? r.id.slice(0, 16) + "…" : r.id}
                </span>
              </div>
              <span style={{ fontSize: 12, color: TG.muted, fontWeight: 500 }}>{r.svc}</span>
              {TG_KEYS.map((k) => (
                <span key={k.key} style={{ minWidth: 0 }}>
                  <TGCell value={r.tags[k.key]} schema={k} />
                </span>
              ))}
              <span style={{ fontSize: 13, fontWeight: 600, color: r.spend === 0 ? TG.xMuted : TG.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                ${r.spend.toLocaleString()}
              </span>
              <button style={{
                width: 22, height: 22, padding: 0,
                background: "transparent", border: "none", borderRadius: 4,
                color: TG.xMuted, fontSize: 14, lineHeight: 1,
              }}>⋯</button>
            </div>
          );
        })}

        {/* Infinite scroll sentinel */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 14px", fontSize: 12, color: TG.xMuted,
          background: "#fafafa", borderTop: `1px solid ${TG.border}`,
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 6,
            border: "2px solid #d1d5db", borderTopColor: TG.ai,
            animation: "tgSpin 700ms linear infinite", display: "inline-block",
          }} />
          <span>Loading more…</span>
        </div>
        <style>{`@keyframes tgSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

const bulkBtn = {
  fontSize: 12, fontWeight: 500, color: "#4338ca",
  background: TG.surface, border: "1px solid #c7d2fe",
  borderRadius: 6, padding: "4px 10px",
};

// ============================================================
// Schema tab — keys CRUD list
// ============================================================
function SchemaTab() {
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, color: TG.muted, margin: 0 }}>
          Define which tags Numio expects on every resource. Required tags drive cost-allocation and policy enforcement.
        </p>
        <span style={{ flex: 1 }} />
        <button style={{ fontSize: 12, color: "#fff", background: TG.text, border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 500 }}>+ New tag key</button>
      </div>

      {/* Schema table */}
      <div style={{ background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "180px 100px 1fr 110px 90px 28px",
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: `1px solid ${TG.border}`,
          fontSize: 10, fontWeight: 500, color: TG.xMuted,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <span>KEY</span>
          <span>REQUIRED</span>
          <span>ALLOWED VALUES</span>
          <span style={{ textAlign: "right" }}>COVERAGE</span>
          <span style={{ textAlign: "right" }}>OWNER</span>
          <span />
        </div>
        {TG_KEYS.map((k, idx) => {
          const coverageColor = k.coverage >= 85 ? TG.success : k.coverage >= 60 ? TG.warn : TG.danger;
          return (
            <div key={k.key} style={{
              display: "grid",
              gridTemplateColumns: "180px 100px 1fr 110px 90px 28px",
              gap: 12, alignItems: "center",
              padding: "12px 14px",
              borderBottom: idx < TG_KEYS.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: TG.text, fontFamily: "JetBrains Mono, monospace" }}>{k.key}</span>
              <span>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: k.required ? TG.danger : TG.muted,
                  background: k.required ? TG.dangerBg : "#f3f4f6",
                  border: `1px solid ${k.required ? TG.dangerBd : TG.border}`,
                  padding: "2px 8px", borderRadius: 4,
                }}>{k.required ? "Required" : "Optional"}</span>
              </span>
              <span style={{ fontSize: 12, color: TG.muted, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {k.allowed ? k.allowed.join(", ") : <span style={{ fontStyle: "italic", fontFamily: "Inter" }}>any value</span>}
              </span>
              <span style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: coverageColor, fontVariantNumeric: "tabular-nums" }}>{k.coverage}%</span>
              </span>
              <span style={{ fontSize: 12, color: TG.muted, textAlign: "right" }}>shared</span>
              <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: TG.xMuted, fontSize: 14 }}>⋯</button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: TG.xMuted, marginTop: 10 }}>
        Schema changes are versioned. <a style={{ color: TG.ai2 }}>Activity →</a>
      </p>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
function TagGovernancePage({ initialTab = "resources" }) {
  const [tab, setTab] = React.useState(initialTab);
  const [selected, setSelected] = React.useState({ "i-0fc7b21e": true, "vol-079b3": true, "eip-0c1f": true });

  const toggleSel = (id) => {
    if (id === "__clear") return setSelected({});
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  };

  // Subtitle signals
  const total = TG_RES.length;
  const reqKeys = TG_KEYS.filter((k) => k.required);
  let filledReq = 0, gaps = 0, drifts = 0, atRisk = 0;
  for (const r of TG_RES) {
    let rg = 0;
    for (const k of TG_KEYS) {
      const v = r.tags[k.key];
      const c = classifyCell(v, k);
      if (k.required && c === "ok") filledReq++;
      if (c === "missing-req") rg++;
      if (c === "drift") drifts++;
    }
    if (rg > 0) { gaps++; atRisk += r.spend; }
  }
  const coverage = Math.round((filledReq / (total * reqKeys.length)) * 100);

  return (
    <div style={{
      padding: 32, maxWidth: 1400,
      background: TG.bg,
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: TG.text, margin: 0 }}>Tag Governance</h1>
          <p style={{ fontSize: 13, color: TG.muted, margin: "4px 0 0" }}>
            <b style={{ color: coverage >= 85 ? TG.success : coverage >= 60 ? TG.warn : TG.danger, fontWeight: 600 }}>{coverage}%</b> required-tag coverage
            <span style={{ color: TG.xMuted }}> · </span>
            <b style={{ color: TG.text2, fontWeight: 600 }}>{gaps}</b> of {total} resources have gaps
            <span style={{ color: TG.xMuted }}> · </span>
            <b style={{ color: TG.warn, fontWeight: 600 }}>{drifts}</b> drift
            <span style={{ color: TG.xMuted }}> · </span>
            <b style={{ color: TG.danger, fontWeight: 600 }}>${(atRisk / 1000).toFixed(1)}k</b>/mo at-risk spend
          </p>
        </div>
        <button style={{
          fontSize: 12, color: TG.text2, background: TG.surface, border: `1px solid ${TG.border}`,
          borderRadius: 6, padding: "6px 12px",
          display: "inline-flex", alignItems: "center", gap: 8,
        }} title="Force a fresh scan of tag coverage">
          <span>⟳ Rescan</span>
          <span style={{ color: TG.xMuted, fontWeight: 400 }}>· last 18m ago</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${TG.border}`, marginBottom: 16 }}>
        {[
          { id: "resources", l: "Resources", count: `${gaps} with gaps · ${total} total` },
          { id: "schema", l: "Tag schema", count: `${TG_KEYS.length} keys · ${reqKeys.length} required` },
        ].map((t) => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", fontSize: 14,
              background: "none", border: "none",
              color: on ? TG.text : TG.muted,
              fontWeight: on ? 500 : 400,
              borderBottom: on ? `2px solid ${TG.text}` : "2px solid transparent",
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              {t.l}
              <span style={{ fontSize: 11, color: TG.xMuted, fontWeight: 400 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "resources" && <ResourcesTab selected={selected} onToggleSelect={toggleSel} />}
      {tab === "schema" && <SchemaTab />}
    </div>
  );
}

Object.assign(window, { TagGovernancePage });
