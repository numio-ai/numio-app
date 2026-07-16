// Shared tokens, primitives, and mock data for Numio dashboards
const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// MOCK DATA
// ============================================================
const MOCK = {
  totalSpend: 284172,
  prevSpend: 312840,
  forecast: 297500,
  budget: 320000,
  savedThisMonth: 41280,
  pendingActions: 7,
  policiesActive: 23,

  services: [
    { name: "EC2 / Compute", provider: "aws", spend: 92140, delta: -8.2, trend: [62,58,55,52,49,47,45,44,46,45,43,42,41,40,40] },
    { name: "RDS / Aurora",  provider: "aws", spend: 41820, delta: +3.1, trend: [38,39,40,40,41,42,41,42,43,42,42,41,42,42,42] },
    { name: "S3 + CloudFront", provider: "aws", spend: 28940, delta: -1.4, trend: [30,30,29,29,30,29,29,28,29,29,29,29,28,29,29] },
    { name: "GKE / Compute",  provider: "gcp", spend: 38210, delta: +12.4, trend: [28,29,30,32,31,33,34,35,36,36,37,37,38,38,38] },
    { name: "BigQuery",       provider: "gcp", spend: 22480, delta: -2.6, trend: [24,24,23,23,23,23,22,22,23,22,22,22,22,22,22] },
    { name: "Azure Functions", provider: "az",  spend: 9120,  delta: +0.8, trend: [9,9,9,9,9,9,9,9,9,9,9,9,9,9,9] },
  ],

  proposals: [
    {
      id: "p-1041",
      severity: "high",
      title: "Hibernate 142 idle non-prod resources",
      saving: 11820,
      scope: "aws://dev/* + gcp://sandbox/*",
      policy: "nightly-nonprod-hibernate",
      reasoning: [
        "Detected 142 resources in dev/sandbox with <2% CPU for 14 nights running.",
        "Tagged owners last activity > 9 days ago. No active incidents.",
        "Hibernation is reversible; wake-on-PR rule will re-enable on next branch push.",
        "Excludes 6 resources flagged production-adjacent by tag governance.",
      ],
      createdAt: "2m ago",
    },
    {
      id: "p-1039",
      severity: "med",
      title: "Block merge: PR #4821 projects +23% us-east-1 cost",
      saving: 4310,
      scope: "github://payments/service-ledger",
      policy: "pr-cost-regression",
      reasoning: [
        "PR introduces r6i.4xlarge replicas in two regions; baseline uses r6i.xlarge.",
        "Projected monthly delta: +$4,310 against payments team budget ceiling.",
        "Suggested: reduce replica count to 3 or pin to us-east-1 only.",
      ],
      createdAt: "14m ago",
    },
    {
      id: "p-1037",
      severity: "low",
      title: "Reclaim 38 unattached EBS volumes (avg age 41d)",
      saving: 612,
      scope: "aws://prod/storage",
      policy: "ebs-orphan-reclaim",
      reasoning: [
        "38 volumes unattached for >30 days, total 4.2 TB gp3.",
        "Snapshot-on-detach already retained; deletion is reversible for 7 days.",
      ],
      createdAt: "1h ago",
    },
  ],

  activity: [
    { t: "2m ago",  agent: "observe", text: "Ingested cost signal: GKE spend +12.4% wk/wk on cluster prod-east-1." },
    { t: "3m ago",  agent: "decide",  text: "Evaluated 11 changes against 23 policies. 1 violation, 2 advisories." },
    { t: "11m ago", agent: "act",     text: "Posted PR comment on payments/service-ledger #4821 with cost projection." },
    { t: "47m ago", agent: "act",     text: "Hibernated 18 idle resources in aws://dev/*. Saved $1,840/mo." },
    { t: "1h ago",  agent: "observe", text: "BigQuery slot consumption normalized after analytics backfill." },
    { t: "2h ago",  agent: "decide",  text: "Approved auto-rightsizing for 4 RDS instances (within risk budget)." },
  ],

  alerts: [
    { tone: "warn", text: "GKE prod-east-1 trending +12% — forecast breaches Q2 budget on May 19." },
    { tone: "info", text: "3 reserved-instance commitments expire in 9 days." },
  ],
};

// ============================================================
// SVG PRIMITIVES
// ============================================================
const Sparkline = ({ data, w = 96, h = 28, stroke = "currentColor", fill = "none", showDots = false }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      {fill !== "none" && <polygon points={area} fill={fill} />}
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      {showDots && data.map((v, i) => (
        <circle key={i} cx={i * stepX} cy={h - ((v - min) / range) * h} r="1.4" fill={stroke} />
      ))}
    </svg>
  );
};

const AreaChart = ({ data, w = 720, h = 180, stroke, fill, gridColor }) => {
  const min = Math.min(...data) * 0.92, max = Math.max(...data) * 1.04;
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  // y gridlines
  const grid = [0.25, 0.5, 0.75].map(p => h * p);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      {grid.map((y, i) => (
        <line key={i} x1="0" x2={w} y1={y} y2={y} stroke={gridColor} strokeDasharray="2 4" />
      ))}
      <polygon points={area} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const ProviderGlyph = ({ p, size = 14, color }) => {
  const c = color || "currentColor";
  if (p === "aws") return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600, color: c, letterSpacing: "0.04em" }}>AWS</span>
  );
  if (p === "gcp") return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600, color: c, letterSpacing: "0.04em" }}>GCP</span>
  );
  return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600, color: c, letterSpacing: "0.04em" }}>AZ</span>
  );
};

const fmtUSD = (n, opts = {}) => {
  const { compact = false } = opts;
  if (compact) {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

// Day series for big chart (synthesized)
const generateSeries = (n, base, drift, noise) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round(base + drift * i + (Math.sin(i / 2.3) * noise) + (Math.cos(i / 1.7) * noise * 0.6)));
  }
  return out;
};

Object.assign(window, {
  MOCK, Sparkline, AreaChart, ProviderGlyph, fmtUSD, generateSeries,
});
