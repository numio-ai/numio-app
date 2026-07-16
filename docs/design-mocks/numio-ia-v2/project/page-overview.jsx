// page-overview.jsx — Faithful recreation of pages/Overview.jsx
// 4 stacked cards: Total Spend, Tag Compliance, Daily Spend chart, Top Cost Drivers,
// plus a 2-col grid for Anomalies and Action Items.
// Mirrors styles + layout from numio-app/frontend/src/pages/Overview.jsx.

const { useState: useStateOv } = React;

// ------------------- Shared inline styles ---------------------
const ovCard = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  padding: "20px 24px",
};
const ovSectionLabel = {
  fontSize: 12,
  fontWeight: 500,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 12,
};

// Simple SVG area chart (replaces recharts in the prototype).
function OvAreaChart({ data, height = 200, color = "#6366f1" }) {
  const w = 880, h = height, pl = 48, pr = 8, pt = 8, pb = 24;
  const innerW = w - pl - pr, innerH = h - pt - pb;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = innerW / (data.length - 1);
  const xy = data.map((v, i) => [pl + i * stepX, pt + innerH - ((v - min) / range) * innerH]);
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pl},${pt + innerH} ${line} ${pl + innerW},${pt + innerH}`;
  const gridY = [0.25, 0.5, 0.75, 1].map((p) => pt + p * innerH);
  const yLabel = (v) => `$${(v / 1000).toFixed(0)}k`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridY.map((y, i) => (
        <g key={i}>
          <line x1={pl} x2={pl + innerW} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={pl - 6} y={y + 3} fontSize={10} fill="#9ca3af" textAnchor="end" fontFamily="Inter, system-ui">
            {yLabel(max - (max - min) * ((y - pt) / innerH))}
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#ovGrad)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* x labels: first / middle / last */}
      {[0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((3 * data.length) / 4), data.length - 1].map((i) => (
        <text key={i} x={pl + i * stepX} y={h - 6} fontSize={10} fill="#9ca3af" textAnchor="middle" fontFamily="Inter, system-ui">
          {`${(i + 1)}/${Math.floor(i / 5) + 2}`}
        </text>
      ))}
    </svg>
  );
}

// ------------------- Widgets ---------------------
function OvTotalSpend() {
  return (
    <div style={{ ...ovCard, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
      <div>
        <p style={ovSectionLabel}>
          TOTAL SPEND · MTD <span style={{ fontWeight: 400, color: "#9ca3af", textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>· from CUR · 2h ago</span>
        </p>
        <p style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 }}>$284,172</p>
        <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>−9.2% vs previous period</p>
      </div>
    </div>
  );
}

function OvCompliance() {
  return (
    <div style={{ ...ovCard, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", borderLeft: "4px solid #d97706" }}>
      <div>
        <p style={ovSectionLabel}>TAG COMPLIANCE</p>
        <p style={{ fontSize: 22, fontWeight: 600, color: "#d97706", margin: 0 }}>73%</p>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Cost-weighted compliance score</p>
      </div>
      <div style={{ display: "flex", gap: 32 }}>
        {[
          { label: "Resources", val: "1,284", color: "#111827" },
          { label: "Compliant", val: "938", color: "#16a34a" },
          { label: "Non-compliant", val: "346", color: "#dc2626" },
          { label: "Untagged spend", val: "$18,420", color: "#d97706" },
        ].map((m) => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: m.color, margin: 0 }}>{m.val}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{m.label}</p>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#3B5BDB" }}>View details →</span>
    </div>
  );
}

function OvSpendTrend() {
  // synthesized 30-day series, slight downward drift
  const data = Array.from({ length: 30 }, (_, i) => 9200 + Math.sin(i / 2.3) * 380 + Math.cos(i / 1.7) * 220 - i * 12);
  return (
    <div style={ovCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ ...ovSectionLabel, marginBottom: 0 }}>DAILY SPEND</p>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>CUR · synced 2h ago</span>
      </div>
      <OvAreaChart data={data} height={200} color="#6366f1" />
    </div>
  );
}

function OvCostDrivers() {
  const rows = [
    { name: "Amazon EC2", pct: 38, amount: 108_125 },
    { name: "Amazon RDS", pct: 19, amount: 54_140 },
    { name: "Amazon S3 + CloudFront", pct: 12, amount: 33_290 },
    { name: "AWS Lambda", pct: 9,  amount: 25_180 },
    { name: "Amazon OpenSearch", pct: 7,  amount: 19_842 },
    { name: "ElastiCache (Redis)", pct: 5,  amount: 14_010 },
    { name: "Amazon EKS", pct: 4,  amount: 11_402 },
    { name: "DynamoDB", pct: 3,  amount: 8_240 },
  ];
  return (
    <div style={ovCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <p style={{ ...ovSectionLabel, marginBottom: 0 }}>TOP COST DRIVERS · MTD</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>CUR · synced 2h ago</span>
          <div style={{
            fontSize: 12, color: "#6b7280",
            background: "#fff", border: "1px solid #e5e5e5",
            borderRadius: 6, padding: "4px 8px",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>AWS Service ▾</div>
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={r.name} style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingBottom: i < rows.length - 1 ? 10 : 0,
          marginBottom: i < rows.length - 1 ? 10 : 0,
          borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none",
        }}>
          <span style={{ fontSize: 12, color: "#374151", width: 180, flexShrink: 0 }}>{r.name}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{ height: 6, borderRadius: 9999, width: `${r.pct}%`, background: "#6366f1" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#111827", width: 72, textAlign: "right" }}>
            ${r.amount.toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af", width: 36, textAlign: "right" }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function OvSmallStat({ label, val, color }) {
  return (
    <div style={ovCard}>
      <p style={ovSectionLabel}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>{val.count}</p>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{val.sub}</p>
    </div>
  );
}

function OverviewPage() {
  return (
    <div style={{
      padding: 32,
      maxWidth: 960,
      background: "#f9fafb",
      width: "100%",
      minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Overview</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, margin: 0 }}>Cloud cost posture at a glance</p>
        </div>
        <div style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {["7D", "30D", "MTD", "QTD", "YTD", "Custom"].map((t) => (
            <button key={t} style={{
              padding: "6px 12px", fontSize: 12,
              background: t === "MTD" ? "#111827" : "#fff",
              color: t === "MTD" ? "#fff" : "#6b7280",
              border: "none", cursor: "pointer", borderRight: "1px solid #e5e5e5",
              fontWeight: t === "MTD" ? 500 : 400,
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <OvTotalSpend />
        <OvCompliance />
        <OvSpendTrend />
        <OvCostDrivers />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <OvSmallStat label="ANOMALIES" val={{ count: 2, sub: "Active anomalies" }} color="#d97706" />
          <OvSmallStat label="ACTION ITEMS" val={{ count: 14, sub: "Open findings & recommendations" }} color="#d97706" />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewPage });
