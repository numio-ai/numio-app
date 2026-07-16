// tags-shared.jsx — mock data + primitives for tag-management directions

const TAG = {
  bg: "#f7f7f7",
  surface: "#ffffff",
  surfaceMuted: "#fafafa",
  border: "#ececea",
  borderStrong: "#dcdcd7",
  text: "#111827",
  text2: "#374151",
  muted: "#6b7280",
  xMuted: "#9ca3af",
  accent: "#2563eb",
  accentBg: "#eff5ff",
  ai: "#6366f1",
  aiBg: "#eef2ff",
  ai2: "#4f46e5",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warn: "#d97706",
  warnBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  // tag value pill swatches (hue rotation, soft)
  pillHues: [
    { bg: "#eef2ff", fg: "#4338ca", bd: "#e0e7ff" }, // indigo
    { bg: "#ecfdf5", fg: "#047857", bd: "#d1fae5" }, // emerald
    { bg: "#fff7ed", fg: "#c2410c", bd: "#fed7aa" }, // orange
    { bg: "#fdf4ff", fg: "#a21caf", bd: "#f5d0fe" }, // fuchsia
    { bg: "#f0f9ff", fg: "#0369a1", bd: "#bae6fd" }, // sky
    { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" }, // rose
  ],
};

// ---------- MOCK DATA ----------
const TAG_KEYS = [
  { key: "env",         desc: "Deployment environment", required: true,  source: "Numio",    values: ["production","staging","dev","prod"], coverage: 0.93 },
  { key: "team",        desc: "Owning team or business unit", required: true, source: "Numio",    values: ["engineering","ml-platform","ml","data-analytics","devops","qa"], coverage: 0.84 },
  { key: "cost-center", desc: "Budget code for cost allocation", required: true, source: "AWS Org", values: ["CC-ENG","CC-ML","CC-DATA","CC-OPS"], coverage: 0.72 },
  { key: "owner",       desc: "Individual owner (email)", required: true, source: "Numio", values: ["jchen@acme.com","mwong@acme.com","dkim@acme.com","szhang@acme.com","agarcia@acme.com","ktaylor@acme.com","rlee@acme.com"], coverage: 0.78 },
  { key: "project",     desc: "Project or initiative name", required: false, source: "Numio", values: ["web-platform","data-pipeline","llm-training","inference-api","feature-store"], coverage: 0.41 },
  { key: "service",     desc: "Application or micro-service", required: false, source: "Numio", values: ["api-gateway","auth-svc","batch-processor","analytics-warehouse","training-cluster","model-serving","etl","monitoring","ci-cd","notifications","media-processor","user-db","feature-db"], coverage: 0.62 },
  { key: "ai-model",    desc: "AI/ML model identifier", required: false, source: "Numio", values: ["gpt-4-finetune","claude-3"], coverage: 0.50 },
  { key: "compliance",  desc: "Regulatory classification (SOC2, PII…)", required: false, source: "AWS Org", values: ["soc2","pii","none"], coverage: 0.18 },
];

const RESOURCES = [
  { id: "r-001", name: "web-api-prod-1",     type: "EC2",    spend: 4820, mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", project: "web-platform", service: "api-gateway" } },
  { id: "r-002", name: "web-api-prod-2",     type: "EC2",    spend: 4710, mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", service: "api-gateway" } },
  { id: "r-003", name: "auth-service-prod",  type: "EC2",    spend: 3120, mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "mwong@acme.com", project: "web-platform", service: "auth-svc" } },
  { id: "r-005", name: "staging-api-01",     type: "EC2",    spend: 920,  mine: true,  tags: { env: "staging", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", service: "api-gateway" } },
  { id: "r-006", name: "staging-api-02",     type: "EC2",    spend: 880,  mine: true,  tags: { env: "staging", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com" } },
  { id: "r-007", name: "dev-worker-01",      type: "EC2",    spend: 210,  mine: true,  tags: { env: "dev", team: "engineering", owner: "rlee@acme.com" } },
  { id: "r-008", name: "dev-worker-02",      type: "EC2",    spend: 195,  mine: true,  tags: { env: "dev", owner: "rlee@acme.com" } },
  { id: "r-011", name: "bastion-host",       type: "EC2",    spend: 142,  mine: true,  tags: { env: "prod", team: "devops", owner: "ktaylor@acme.com" } },
  { id: "r-012", name: "load-test-01",       type: "EC2",    spend: 88,   mine: true,  tags: { team: "qa" } },
  { id: "r-019", name: "user-db-primary",    type: "RDS",    spend: 2840, mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "mwong@acme.com", project: "web-platform", service: "user-db" } },
  { id: "r-022", name: "staging-db-01",      type: "RDS",    spend: 740,  mine: true,  tags: { env: "staging", team: "engineering", owner: "jchen@acme.com" } },
  { id: "r-023", name: "dev-db-01",          type: "RDS",    spend: 180,  mine: true,  tags: { env: "dev", team: "engineering", owner: "rlee@acme.com" } },
  { id: "r-024", name: "app-assets-prod",    type: "S3",     spend: 410,  mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", project: "web-platform" } },
  { id: "r-029", name: "staging-uploads",    type: "S3",     spend: 64,   mine: true,  tags: { env: "staging", team: "engineering" } },
  { id: "r-030", name: "dev-scratch-01",     type: "S3",     spend: 12,   mine: true,  tags: { team: "engineering" } },
  { id: "r-031", name: "temp-exports",       type: "S3",     spend: 28,   mine: true,  tags: {} },
  { id: "r-032", name: "api-authorizer",     type: "Lambda", spend: 320,  mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "mwong@acme.com", project: "web-platform", service: "auth-svc" } },
  { id: "r-033", name: "image-resize",       type: "Lambda", spend: 180,  mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", service: "media-processor" } },
  { id: "r-037", name: "dev-webhook-test",   type: "Lambda", spend: 6,    mine: true,  tags: { env: "dev", team: "engineering" } },
  { id: "r-038", name: "ns-web-prod",        type: "K8s",    spend: 1840, mine: true,  tags: { env: "production", team: "engineering", "cost-center": "CC-ENG", owner: "jchen@acme.com", project: "web-platform", service: "web-cluster" } },
  { id: "r-041", name: "ns-staging",         type: "K8s",    spend: 420,  mine: true,  tags: { env: "staging", team: "engineering" } },
  { id: "r-042", name: "ns-dev-sandbox",     type: "K8s",    spend: 90,   mine: true,  tags: { env: "dev" } },
];

// drift / inconsistency hot-spots
const DRIFT = [
  { key: "env",  values: ["prod", "production"], canonical: "production", count: 1 },
  { key: "team", values: ["ml", "ml-platform"],  canonical: "ml-platform", count: 0 },
];

// stable hash → color for value pills
function pillHueFor(v) {
  if (v == null) return TAG.pillHues[0];
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return TAG.pillHues[Math.abs(h) % TAG.pillHues.length];
}

// ---------- PRIMITIVES ----------

const Mono = ({ children, style }) => (
  <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: 12, ...style }}>{children}</span>
);

// Tag key pill, e.g. `env`
const TagKeyPill = ({ k, size = 12, style }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    fontSize: size, color: TAG.text, background: "#f3f0ff",
    border: "1px solid #e9e3ff", borderRadius: 5,
    padding: "1px 6px", lineHeight: 1.5, fontWeight: 500,
    ...style,
  }}>{k}</span>
);

// key:value combined pill
const TagPill = ({ k, v, size = 11, missing = false, drift = false, onClick, style }) => {
  if (missing) {
    return (
      <span onClick={onClick} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
        fontSize: size, color: TAG.danger,
        border: `1px dashed ${TAG.danger}55`, background: "transparent",
        borderRadius: 5, padding: "1px 6px", cursor: onClick ? "pointer" : "default",
        ...style,
      }}>
        <span style={{ color: TAG.danger, opacity: 0.7 }}>{k}</span>
        <span style={{ opacity: 0.5 }}>:</span>
        <span style={{ fontStyle: "italic", opacity: 0.7 }}>missing</span>
      </span>
    );
  }
  const hue = pillHueFor(v);
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
      fontSize: size, background: hue.bg, color: hue.fg,
      border: `1px solid ${hue.bd}`, borderRadius: 5,
      padding: "1px 6px", lineHeight: 1.5,
      cursor: onClick ? "pointer" : "default",
      position: "relative",
      ...style,
    }}>
      <span style={{ opacity: 0.6 }}>{k}</span>
      <span style={{ opacity: 0.4, margin: "0 1px" }}>:</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
      {drift && (
        <span title="value differs from canonical" style={{
          marginLeft: 5, width: 6, height: 6, borderRadius: 3, background: TAG.warn,
          display: "inline-block",
        }} />
      )}
    </span>
  );
};

// Coverage bar (0..1)
const CoverageBar = ({ value, w = 64, h = 4, showLabel = false, style }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? TAG.success : pct >= 60 ? TAG.warn : TAG.danger;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <div style={{ width: w, height: h, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 9999 }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: TAG.muted, minWidth: 22, textAlign: "right" }}>{pct}%</span>
      )}
    </div>
  );
};

// Donut for catalogue cards
const Donut = ({ value, size = 44, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const color = pct >= 0.85 ? TAG.success : pct >= 0.6 ? TAG.warn : TAG.danger;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eceae6" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${c*pct} ${c}`} strokeDashoffset={c*0.25} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.34em"
        fontSize={size*0.28} fontWeight={600} fill={TAG.text}
        style={{ fontFamily: "Inter, sans-serif", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(pct*100)}
      </text>
    </svg>
  );
};

// Resource-type glyph (tiny chip)
const TypeChip = ({ t }) => {
  const map = {
    EC2:   { bg: "#fff7ed", fg: "#c2410c" },
    GPU:   { bg: "#fdf4ff", fg: "#a21caf" },
    RDS:   { bg: "#eef2ff", fg: "#4338ca" },
    S3:    { bg: "#ecfdf5", fg: "#047857" },
    Lambda:{ bg: "#fef9c3", fg: "#854d0e" },
    K8s:   { bg: "#f0f9ff", fg: "#0369a1" },
  };
  const c = map[t] || { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
      background: c.bg, color: c.fg, padding: "1px 6px",
      borderRadius: 4, textTransform: "uppercase",
    }}>{t}</span>
  );
};

// Tiny icon set (stroke svg)
const Icon = ({ name, size = 14, color = "currentColor", style }) => {
  const p = {
    search:   <><circle cx="7" cy="7" r="5"/><path d="M14 14L10.5 10.5"/></>,
    plus:     <><path d="M8 2v12M2 8h12"/></>,
    x:        <><path d="M3 3l10 10M13 3L3 13"/></>,
    chevron:  <><path d="M5 6l3 3 3-3"/></>,
    chevronR: <><path d="M6 5l3 3-3 3"/></>,
    chevronL: <><path d="M10 5l-3 3 3 3"/></>,
    filter:   <><path d="M2 3h12l-4.5 6v4l-3 1V9z"/></>,
    sparkle:  <><path d="M8 1.5l1.4 3.7 3.7 1.4-3.7 1.4L8 11.7 6.6 8 2.9 6.6 6.6 5.2z"/></>,
    check:    <><path d="M3 8l3 3 7-7"/></>,
    warn:     <><path d="M8 2L1.5 13.5h13z"/><path d="M8 6v3.5M8 11.5v.5"/></>,
    info:     <><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></>,
    trash:    <><path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9"/></>,
    edit:     <><path d="M2 14l3-1 8-8-2-2-8 8z"/></>,
    arrow:    <><path d="M3 8h10M9 4l4 4-4 4"/></>,
    user:     <><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 3-5 6-5s6 2 6 5"/></>,
    box:      <><path d="M2 5l6-3 6 3-6 3z"/><path d="M2 5v6l6 3M14 5v6l-6 3"/></>,
    book:     <><path d="M2 3h5a2 2 0 012 2v9a2 2 0 00-2-2H2zM14 3H9a2 2 0 00-2 2v9a2 2 0 012-2h5z"/></>,
    grid:     <><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/></>,
    list:     <><path d="M5 4h9M5 8h9M5 12h9"/><circle cx="2" cy="4" r="0.5"/><circle cx="2" cy="8" r="0.5"/><circle cx="2" cy="12" r="0.5"/></>,
    download: <><path d="M8 2v9M4 7l4 4 4-4M2 14h12"/></>,
    upload:   <><path d="M8 14V5M4 9l4-4 4 4M2 2h12"/></>,
    dots:     <><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></>,
    cloud:    <><path d="M4 11a3 3 0 010-6 4 4 0 017.5 1A2.5 2.5 0 0112 11z"/></>,
    settings: <><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></>,
    refresh:  <><path d="M14 8a6 6 0 11-2-4.5"/><path d="M14 2v3.5h-3.5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {p[name]}
    </svg>
  );
};

// ---------- APP CHROME (faux Numio sidebar so designs sit in their world) ----------
const SIDEBAR_ITEMS = [
  { id: "overview",  label: "Overview",   icon: "grid" },
  { id: "resources", label: "Resources",  icon: "box", count: 22 },
  { id: "tags",      label: "Tags",       icon: "book", active: true },
  { id: "costs",     label: "Costs",      icon: "cloud" },
  { id: "govern",    label: "Govern",     icon: "settings" },
];

function AppShell({ children, page = "Tags", crumb = "Tags / Resources", actions }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex",
      background: TAG.bg, color: TAG.text,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 13,
    }}>
      {/* sidebar */}
      <aside style={{
        width: 196, flexShrink: 0, background: "#fafaf9",
        borderRight: `1px solid ${TAG.border}`, padding: "16px 12px",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 16px" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: TAG.text, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>n</div>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Numio</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: TAG.muted, marginLeft: "auto", padding: "1px 5px", border: `1px solid ${TAG.border}`, borderRadius: 4 }}>acme</span>
        </div>
        {SIDEBAR_ITEMS.map(it => (
          <div key={it.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: 6,
            background: it.active ? "#fff" : "transparent",
            boxShadow: it.active ? "0 0 0 1px " + TAG.border + ", 0 1px 2px rgba(0,0,0,0.04)" : "none",
            color: it.active ? TAG.text : TAG.muted,
            fontSize: 12.5, fontWeight: it.active ? 500 : 400,
            cursor: "default",
          }}>
            <Icon name={it.icon} size={14} color={it.active ? TAG.text : TAG.muted} />
            <span>{it.label}</span>
            {it.count != null && (
              <span style={{ marginLeft: "auto", fontSize: 10, color: TAG.xMuted, fontVariantNumeric: "tabular-nums" }}>{it.count}</span>
            )}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderTop: `1px solid ${TAG.border}`, marginTop: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#dfe5ff", color: TAG.ai2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>JC</div>
          <span style={{ fontSize: 12, color: TAG.text2 }}>jchen@acme.com</span>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{
          height: 48, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 16,
          padding: "0 24px", borderBottom: `1px solid ${TAG.border}`,
          background: "#fdfdfc",
        }}>
          <div style={{ fontSize: 12, color: TAG.muted }}>{crumb}</div>
          <div style={{ flex: 1 }} />
          {actions}
        </header>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// generic button
function Btn({ children, primary, ai, ghost, size = "sm", onClick, style, icon }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: `1px solid ${TAG.border}`,
    background: TAG.surface, color: TAG.text,
    fontSize: size === "sm" ? 12 : 13, fontWeight: 500,
    padding: size === "sm" ? "5px 10px" : "7px 12px",
    borderRadius: 6, cursor: "pointer",
    fontFamily: "inherit", lineHeight: 1.3,
  };
  if (primary) Object.assign(base, { background: TAG.text, color: "#fff", borderColor: TAG.text });
  if (ai) Object.assign(base, { background: TAG.ai, color: "#fff", borderColor: TAG.ai });
  if (ghost) Object.assign(base, { background: "transparent", border: "1px solid transparent" });
  return <button onClick={onClick} style={{ ...base, ...style }}>{icon && <Icon name={icon} size={12} />}{children}</button>;
}

Object.assign(window, {
  TAG, TAG_KEYS, RESOURCES, DRIFT, pillHueFor,
  Mono, TagKeyPill, TagPill, CoverageBar, Donut, TypeChip, Icon,
  AppShell, Btn,
});
