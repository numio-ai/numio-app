// page-resources.jsx — IA v2 — tag-driven, dense Resources page.
// Changes vs prior:
//   (1) View picker + Share link + Save-as, same model as Usage.
//   (2) Filter chips with platform + tag dimensions; "+ Filter" picker.
//   (3) Columns are configurable (Columns ▾ picker). Any tag from the
//       schema can be added as a column. Polymorphic "State" column
//       shows whatever the service's lifecycle field is, and renders
//       "—" for stateless services (S3, Lambda).
//   (4) Density toggle (Compact / Comfortable). Compact is default —
//       single-line rows at ~36px, designed for thousands of resources.
//   (5) Optional Group-by collapses rows by tag/dim (e.g. team, env).
//   (6) Bulk-select column + action bar when any row is selected.

// ============================================================
// Polymorphic state — different services use different lifecycle
// vocabularies. Treat the column as data-shape-aware.
// ============================================================
const STATE_KINDS = {
  good:    { color: "#16a34a", icon: "●" },
  bad:     { color: "#dc2626", icon: "■" },
  warn:    { color: "#d97706", icon: "◐" },
  neutral: { color: "#9ca3af", icon: "—" },
  none:    { color: "#d1d5db", icon: "—" },
};
function stateOf(label) {
  if (!label) return { kind: "none", label: "—" };
  const l = label.toLowerCase();
  if (["running", "available", "in-use", "associated", "active", "healthy"].includes(l)) return { kind: "good", label };
  if (l === "stopped") return { kind: "bad", label };
  if (["unassociated", "orphan", "idle"].includes(l)) return { kind: "warn", label };
  if (["terminated", "deleting"].includes(l)) return { kind: "neutral", label };
  return { kind: "neutral", label };
}

// ============================================================
// Resource sample data — diverse mix to exercise polymorphism.
// ============================================================
const RESOURCES = [
  { id: "i-0a4f8c2d09b3e7a11", name: "payments-api-prod-3", svc: "EC2", type: "m6i.2xlarge", state: "running",  region: "us-east-1", acct: "123456789012", spend: 842, gaps: 0, tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", criticality: "tier-1" } },
  { id: "i-0fc7b21e88a4d09c2", name: "ml-train-worker-04",  svc: "EC2", type: "g5.12xlarge", state: "running",  region: "us-west-2", acct: "987654321098", spend: 3120, gaps: 2, tags: { env: "staging", team: "ml", criticality: "tier-2" } },
  { id: "db-finance-prod-1",   name: "finance-prod-1",      svc: "RDS", type: "db.r6g.4xl",  state: "available", region: "us-east-1", acct: "123456789012", spend: 2840, gaps: 0, tags: { env: "production", team: "finance", "cost-center": "CC-FIN", owner: "diana@" } },
  { id: "vol-079b3f12c4ad99e", name: "logs-archive-volume", svc: "EBS", type: "gp3 · 1.2 TB", state: "unassociated", region: "us-east-1", acct: "123456789012", spend: 96, gaps: 2, tags: { env: "production" } },
  { id: "vol-0a92ed7c1f8b034e", name: "snapshot-attach-1",  svc: "EBS", type: "gp3 · 240 GB", state: "in-use",  region: "us-east-1", acct: "123456789012", spend: 28, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "eip-0c1f9b2e",        name: "—",                   svc: "EIP", type: "Elastic IP",   state: "unassociated", region: "eu-west-1", acct: "123456789012", spend: 4, gaps: 4, tags: {} },
  { id: "i-08fa3c1b9d4e76f02", name: "sandbox-dev-runner",  svc: "EC2", type: "t3.medium",    state: "stopped",  region: "us-east-1", acct: "987654321098", spend: 0, gaps: 0, tags: { env: "sandbox", team: "eng", "cost-center": "CC-ENG" } },
  { id: "arn:lambda:search-api-fn", name: "search-api-fn",  svc: "Lambda", type: "512 MB · py3.11", state: null, region: "us-east-1", acct: "123456789012", spend: 318, gaps: 0, tags: { env: "production", team: "eng", "cost-center": "CC-ENG", service: "search-api" } },
  { id: "s3://numio-static-prod", name: "static-assets-prod", svc: "S3", type: "Standard · 4.2 TB", state: null, region: "us-east-1", acct: "123456789012", spend: 612, gaps: 0, tags: { env: "production", team: "eng", "cost-center": "CC-ENG" } },
  { id: "redis-session-1",     name: "session-cache-1",     svc: "ElastiCache", type: "cache.r6g.large", state: "available", region: "us-east-1", acct: "123456789012", spend: 480, gaps: 1, tags: { env: "production", team: "eng" } },
  { id: "domain-logs-search",  name: "logs-search-prod",    svc: "OpenSearch", type: "m6g.large.search", state: "active", region: "us-east-1", acct: "123456789012", spend: 660, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "cluster-analytics-x", name: "analytics-warehouse", svc: "Redshift", type: "ra3.4xl × 4", state: "available", region: "us-east-1", acct: "123456789012", spend: 4820, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT", criticality: "tier-1" } },
  { id: "i-09ce772ab1f3e0017", name: "checkout-api-prod-1", svc: "EC2", type: "m6i.large", state: "running", region: "us-east-1", acct: "123456789012", spend: 412, gaps: 0, tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "checkout" } },
  { id: "snap-0d7fab1c2",      name: "logs-snapshot-2024-02", svc: "EBS Snapshot", type: "880 GB", state: null, region: "us-east-1", acct: "123456789012", spend: 22, gaps: 1, tags: { env: "production" } },
];

// ============================================================
// Saved views
// ============================================================
const RES_SAVED_VIEWS = [
  { id: "all",       label: "All resources",          owner: "shared" },
  { id: "prod-ec2",  label: "EC2 in production",      owner: "you"    },
  { id: "orphans",   label: "Orphans (waste)",        owner: "you", note: "5 unassoc EBS · 5 EIP · 412 snapshots" },
  { id: "no-cc",     label: "Missing cost-center",    owner: "shared" },
  { id: "by-team",   label: "Grouped by team",        owner: "you"    },
  { id: "expensive", label: "$1k/mo and up",          owner: "shared" },
];

// ============================================================
// Available columns — built-in + every tag from the schema.
// ============================================================
const RES_COLUMNS = [
  // always-on
  { id: "name",    label: "Name / ID",      width: 280, always: true },
  { id: "svc",     label: "Service",        width: 92,  always: true },
  { id: "spend",   label: "Spend/mo",       width: 88,  always: true, align: "right" },
  // defaults
  { id: "type",    label: "Type",           width: 130, default: true },
  { id: "state",   label: "State",          width: 108, default: true },
  { id: "region",  label: "Region",         width: 86,  default: true },
  { id: "acct",    label: "Account",        width: 88,  default: true },
  { id: "gaps",    label: "Tags",           width: 64,  default: true, align: "center" },
  // optional built-ins
  { id: "provider", label: "Provider",      width: 70 },
  { id: "created",  label: "Created",       width: 110 },
  { id: "arn",      label: "ARN",           width: 200 },
  // tag-as-column (mirrors schema in Tag Governance)
  { id: "tag:env",         label: "tag:env",         width: 100, tag: true },
  { id: "tag:team",        label: "tag:team",        width: 100, tag: true },
  { id: "tag:cost-center", label: "tag:cost-center", width: 110, tag: true },
  { id: "tag:owner",       label: "tag:owner",       width: 110, tag: true },
  { id: "tag:service",     label: "tag:service",     width: 110, tag: true },
  { id: "tag:criticality", label: "tag:criticality", width: 96,  tag: true },
];

const TAG_DIM_COUNT = RES_COLUMNS.filter((c) => c.tag).length;

// ============================================================
// Atoms — chips & dropdowns. Lean on the same vocabulary as Usage.
// ============================================================
function FilterChipR({ kind, dimKey, valuesLabel }) {
  const isTag = kind === "tag";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 4px 4px 8px", fontSize: 12,
      background: isTag ? "#f5f3ff" : "#fff",
      border: `1px solid ${isTag ? "#ddd6fe" : "#e5e5e5"}`,
      color: "#374151", borderRadius: 6, whiteSpace: "nowrap",
    }}>
      {isTag && (
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9",
          background: "#ede9fe", padding: "1px 5px", borderRadius: 3,
        }}>tag</span>
      )}
      <span style={{ color: "#6b7280" }}>{dimKey}:</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{valuesLabel}</span>
      <button style={{
        width: 16, height: 16, padding: 0, marginLeft: 2,
        color: "#9ca3af", background: "transparent", border: "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4, fontSize: 13, lineHeight: 1,
      }}>×</button>
    </span>
  );
}

function ToolbarBtn({ children, onClick, active, hint }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", fontSize: 12,
      background: active ? "#f3f4f6" : "#fff",
      border: "1px solid #e5e5e5", borderRadius: 6,
      color: "#374151", fontWeight: 500,
    }}>
      {hint && <span style={{ color: "#9ca3af", fontWeight: 400 }}>{hint}:</span>}
      {children}
      <span style={{ color: "#9ca3af" }}>▾</span>
    </button>
  );
}

// View dropdown — mirrors the Usage version, scoped to resource views.
function ResViewsPicker({ activeId, open, onToggle }) {
  const active = RES_SAVED_VIEWS.find((v) => v.id === activeId) || RES_SAVED_VIEWS[0];
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
          minWidth: 340,
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", padding: "2px 6px" }}>+ Save current</button>
          </div>
          {RES_SAVED_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: "#111827", fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#111827", fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : v.owner === "shared" ? "Shared workspace view" : `Shared by ${v.owner}`}
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
                <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: "#6b7280", fontSize: 16, lineHeight: 1 }}>⋯</button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#6b7280", background: "transparent", border: "none", borderRadius: 6 }}>
            Manage all views…
          </button>
        </div>
      )}
    </div>
  );
}

// Columns picker — every available column with a checkbox.
function ColumnsPicker({ open, onToggle, activeCols }) {
  if (!open) {
    return (
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 12,
        background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        color: "#374151", fontWeight: 500,
      }}>
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>Columns:</span>
        {activeCols.length}
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
    );
  }
  const sections = [
    { title: "Always shown", items: RES_COLUMNS.filter((c) => c.always) },
    { title: "Built-in",     items: RES_COLUMNS.filter((c) => !c.always && !c.tag) },
    { title: "Tag columns",  items: RES_COLUMNS.filter((c) => c.tag) },
  ];
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 12,
        background: "#f3f4f6", border: "1px solid #e5e5e5", borderRadius: 6,
        color: "#111827", fontWeight: 500,
      }}>
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>Columns:</span>
        {activeCols.length}
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      <div style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0,
        minWidth: 280, maxHeight: 460, overflow: "auto",
        background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        padding: 8, zIndex: 50,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px 8px" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Columns</span>
          <button style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none" }}>Reset</button>
        </div>
        {sections.map((s) => (
          <div key={s.title} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", padding: "6px 4px 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.title}</div>
            {s.items.map((c) => {
              const on = activeCols.includes(c.id);
              return (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 6px", fontSize: 12, color: "#374151",
                  borderRadius: 4, cursor: c.always ? "default" : "pointer",
                  opacity: c.always ? 0.6 : 1,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1px solid ${on ? "#111827" : "#d1d5db"}`,
                    background: on ? "#111827" : "#fff",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, lineHeight: 1,
                  }}>{on ? "✓" : ""}</span>
                  <span style={{ fontFamily: c.tag ? "JetBrains Mono, monospace" : "inherit" }}>{c.label}</span>
                  {c.always && <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>required</span>}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
        <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#6d28d9", background: "transparent", border: "none", borderRadius: 6 }}>
          + Add formula column
        </button>
      </div>
    </div>
  );
}

// State cell — colored dot + label.
function StateCell({ state }) {
  const s = stateOf(state);
  const k = STATE_KINDS[s.kind];
  if (s.kind === "none") {
    return <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: k.color }} />
      <span style={{ fontSize: 12, color: "#374151" }}>{s.label}</span>
    </span>
  );
}

// Tag compliance cell — checkmark or warning count.
function TagsCell({ gaps }) {
  if (gaps === 0) {
    return (
      <span title="All required tags present" style={{
        display: "inline-flex", width: 18, height: 18, borderRadius: 9,
        alignItems: "center", justifyContent: "center",
        background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, lineHeight: 1,
      }}>✓</span>
    );
  }
  return (
    <span title={`${gaps} required tag${gaps === 1 ? "" : "s"} missing`} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, color: "#dc2626",
      background: "#fef2f2", border: "1px solid #fecaca",
      padding: "1px 6px", borderRadius: 9, lineHeight: 1.4,
    }}>
      ⚠ {gaps}
    </span>
  );
}

// ============================================================
// Cell renderer per column id
// ============================================================
function renderCell(r, col) {
  switch (col.id) {
    case "name":
      return (
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
            {r.name === "—" ? r.id : r.name}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.name === "—" ? "" : r.id.length > 24 ? r.id.slice(0, 22) + "…" : r.id}
          </span>
        </div>
      );
    case "svc":
      return <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{r.svc}</span>;
    case "type":
      return <span style={{ fontSize: 12, color: "#6b7280" }}>{r.type}</span>;
    case "state":
      return <StateCell state={r.state} />;
    case "region":
      return <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "JetBrains Mono, monospace" }}>{r.region}</span>;
    case "acct":
      return <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "JetBrains Mono, monospace" }}>···{r.acct.slice(-4)}</span>;
    case "spend":
      return <span style={{ fontSize: 13, fontWeight: 600, color: r.spend === 0 ? "#9ca3af" : "#111827", fontVariantNumeric: "tabular-nums" }}>${r.spend.toLocaleString()}</span>;
    case "gaps":
      return <TagsCell gaps={r.gaps} />;
    default:
      if (col.tag) {
        const k = col.id.slice(4); // "tag:env" → "env"
        const v = r.tags?.[k];
        if (v == null) {
          return <span style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "1px 6px", borderRadius: 3, fontFamily: "JetBrains Mono, monospace" }}>—</span>;
        }
        return <span style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", padding: "1px 6px", borderRadius: 3, fontFamily: "JetBrains Mono, monospace" }}>{v}</span>;
      }
      return <span style={{ color: "#d1d5db" }}>—</span>;
  }
}

// ============================================================
// Main page
// ============================================================
function ResourcesPage() {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [density, setDensity] = React.useState("compact"); // compact | comfortable
  const [selected, setSelected] = React.useState({ "i-0fc7b21e88a4d09c2": true, "vol-079b3f12c4ad99e": true, "eip-0c1f9b2e": true });

  const activeCols = React.useMemo(() => RES_COLUMNS.filter((c) => c.always || c.default).map((c) => c.id), []);
  const cols = activeCols.map((id) => RES_COLUMNS.find((c) => c.id === id)).filter(Boolean);

  const rowH = density === "compact" ? 36 : 52;
  const cellPadV = density === "compact" ? 7 : 12;

  const filters = [
    { kind: "tag", key: "env", values: ["production"] },
    { kind: "platform", key: "service", values: ["EC2", "RDS"], multi: 2 },
  ];

  const totalResources = 1284;
  const visibleResources = RESOURCES.length;
  const selCount = Object.keys(selected).length;

  const gridTemplate = cols.map((c) => `${c.width}px`).join(" ");

  return (
    <div style={{
      padding: 32, maxWidth: 1280,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Resources</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>1,284 resources across 4 accounts · synced 18m ago</p>
        </div>
      </div>

      {/* Row 1: Views + share + save + export */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ResViewsPicker activeId="all" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: "#374151",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6 }}>Save as…</button>
        <span style={{ flex: 1 }} />
        <button style={{ padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6 }}>Export CSV</button>
      </div>

      {/* Row 2: toolbar — group / sort / columns / density */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ToolbarBtn hint="Group by">none</ToolbarBtn>
        <ToolbarBtn hint="Sort">spend ↓</ToolbarBtn>
        <ColumnsPicker open={columnsOpen} onToggle={() => setColumnsOpen((v) => !v)} activeCols={activeCols} />
        {/* Density toggle */}
        <div style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
          {[
            { id: "compact", l: "Compact" },
            { id: "comfortable", l: "Comfortable" },
          ].map((d) => {
            const on = d.id === density;
            return (
              <button key={d.id} onClick={() => setDensity(d.id)} style={{
                padding: "5px 10px", fontSize: 12,
                background: on ? "#111827" : "#fff",
                color: on ? "#fff" : "#6b7280",
                border: "none", borderRight: "1px solid #e5e5e5",
                fontWeight: on ? 500 : 400,
              }}>{d.l}</button>
            );
          })}
        </div>
      </div>

      {/* Row 3: filter chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>Filters</span>
        {filters.map((f, i) => (
          <FilterChipR
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
          5 platform · {TAG_DIM_COUNT} tags available
          {" · "}
          <a style={{ color: "#6d28d9", fontWeight: 500 }}>Manage tag schema →</a>
        </span>
      </div>

      {/* Search + result count / bulk action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", fontSize: 13,
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search by ID, name, ARN, or tag value…" style={{
            flex: 1, border: "none", outline: "none", fontSize: 13,
            background: "transparent", color: "#111827", fontFamily: "inherit",
          }} />
        </div>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {selCount > 0 ? null : `Showing ${visibleResources} of ${totalResources.toLocaleString()}`}
        </span>
      </div>

      {/* Bulk action bar — visible when rows selected */}
      {selCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 8,
          background: "#eef2ff", border: "1px solid #c7d2fe",
          borderRadius: 8, fontSize: 12, color: "#3730a3",
        }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: "#6366f1" }}>·</span>
          <button style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px" }}>Apply tag…</button>
          <button style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px" }}>Hibernate</button>
          <button style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px" }}>Send to Recommendations</button>
          <button style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px" }}>Export selected</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => setSelected({})} style={{ fontSize: 11, color: "#6366f1", background: "transparent", border: "none" }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
        {/* Sticky header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `28px ${gridTemplate} 28px`,
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: "1px solid #f3f4f6",
          fontSize: 10, fontWeight: 500, color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.05em",
          position: "sticky", top: 0, zIndex: 1,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: "1px solid #d1d5db", background: "#fff",
          }} />
          {cols.map((c) => (
            <span key={c.id} style={{ textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", fontFamily: c.tag ? "JetBrains Mono, monospace" : "inherit", textTransform: c.tag ? "none" : "uppercase", color: "#9ca3af" }}>
              {c.label}
            </span>
          ))}
          <span />
        </div>

        {/* Body */}
        {RESOURCES.map((r, idx) => {
          const sel = !!selected[r.id];
          return (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: `28px ${gridTemplate} 28px`,
              gap: 12, padding: `${cellPadV}px 14px`,
              alignItems: "center",
              minHeight: rowH, height: rowH,
              borderBottom: idx < RESOURCES.length - 1 ? "1px solid #f3f4f6" : "none",
              background: sel ? "#f5f3ff" : "#fff",
              boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: `1px solid ${sel ? "#6366f1" : "#d1d5db"}`,
                background: sel ? "#6366f1" : "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
              }}>{sel ? "✓" : ""}</span>
              {cols.map((c) => (
                <div key={c.id} style={{
                  fontSize: 12, color: "#111827",
                  textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
                  minWidth: 0,
                  display: c.align === "right" ? "block" : c.align === "center" ? "flex" : "block",
                  justifyContent: c.align === "center" ? "center" : undefined,
                  whiteSpace: "nowrap", overflow: "hidden",
                }}>
                  {renderCell(r, c)}
                </div>
              ))}
              <button style={{
                width: 22, height: 22, padding: 0,
                background: "transparent", border: "none", borderRadius: 4,
                color: "#9ca3af", fontSize: 14, lineHeight: 1,
              }}>⋯</button>
            </div>
          );
        })}

        {/* Infinite scroll sentinel — auto-loads next chunk when in view */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px 14px", fontSize: 12, color: "#9ca3af",
          background: "#fafafa", borderTop: "1px solid #f3f4f6",
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 6,
            border: "2px solid #d1d5db", borderTopColor: "#6366f1",
            animation: "resSpin 700ms linear infinite", display: "inline-block",
          }} />
          <span>Loading more…</span>
        </div>
        <style>{`@keyframes resSpin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Status line — minimal footer for infinite-scroll table */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          Showing 1–{visibleResources} of {totalResources.toLocaleString()} · scroll for more
        </span>
        <button style={{
          padding: "4px 10px", fontSize: 12, color: "#6b7280",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }}>↑ Back to top</button>
      </div>
    </div>
  );
}

Object.assign(window, { ResourcesPage });
