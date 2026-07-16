// page-cloud-usage.jsx — Faithful recreation of pages/CloudUsage/CloudUsagePage.jsx
// Filters row + spend summary + stacked-area trend chart + breakdown panel.

const CU_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const cuCard = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  padding: "20px 24px",
};
const cuLabel = {
  fontSize: 12, fontWeight: 500, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12,
};

// Stacked area chart, 8 categories x 30 days
function CuStackedArea({ height = 280 }) {
  const days = 30;
  const series = [
    { name: "EC2", color: CU_COLORS[0], base: 3600, drift: -22, amp: 280 },
    { name: "RDS", color: CU_COLORS[1], base: 1700, drift: 4, amp: 120 },
    { name: "S3 + CloudFront", color: CU_COLORS[2], base: 1100, drift: -3, amp: 80 },
    { name: "Lambda", color: CU_COLORS[3], base: 840, drift: 6, amp: 60 },
    { name: "OpenSearch", color: CU_COLORS[4], base: 660, drift: 1, amp: 50 },
    { name: "ElastiCache", color: CU_COLORS[5], base: 470, drift: 1, amp: 40 },
    { name: "EKS", color: CU_COLORS[6], base: 380, drift: 2, amp: 35 },
  ];
  // generate data
  const data = Array.from({ length: days }, (_, i) =>
    series.map((s) => Math.max(50, s.base + s.drift * i + Math.sin(i / 2.1) * s.amp + Math.cos(i / 1.6) * s.amp * 0.6))
  );
  const w = 1180, h = height, pl = 56, pr = 8, pt = 8, pb = 28;
  const innerW = w - pl - pr, innerH = h - pt - pb;
  const totals = data.map((row) => row.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals);
  const stepX = innerW / (days - 1);

  // build polygons per series, accumulating from bottom up
  const accum = data.map(() => 0);
  const polygons = series.map((s, sIdx) => {
    const top = [];
    const bottom = [];
    for (let i = 0; i < days; i++) {
      const x = pl + i * stepX;
      const baseY = pt + innerH - (accum[i] / max) * innerH;
      accum[i] += data[i][sIdx];
      const topY = pt + innerH - (accum[i] / max) * innerH;
      top.push(`${x},${topY}`);
      bottom.push(`${x},${baseY}`);
    }
    return { name: s.name, color: s.color, points: `${top.join(" ")} ${bottom.reverse().join(" ")}` };
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
      {polygons.map((p) => (
        <polygon key={p.name} points={p.points} fill={p.color} opacity={0.85} stroke="none" />
      ))}
      {[0, 7, 14, 21, 29].map((i) => (
        <text key={i} x={pl + i * stepX} y={h - 8} fontSize={10} fill="#9ca3af" textAnchor="middle" fontFamily="Inter">
          {`Feb ${10 + i}`}
        </text>
      ))}
    </svg>
  );
}

function CuLegend() {
  const legend = [
    { l: "Amazon EC2", c: CU_COLORS[0] }, { l: "Amazon RDS", c: CU_COLORS[1] },
    { l: "S3 + CloudFront", c: CU_COLORS[2] }, { l: "AWS Lambda", c: CU_COLORS[3] },
    { l: "OpenSearch", c: CU_COLORS[4] }, { l: "ElastiCache", c: CU_COLORS[5] },
    { l: "Amazon EKS", c: CU_COLORS[6] },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
      {legend.map((g) => (
        <div key={g.l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: g.c }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>{g.l}</span>
        </div>
      ))}
    </div>
  );
}

function CuBreakdownTable() {
  const rows = [
    { name: "Amazon EC2", spend: 108_125, pct: 38, trend: "−4.2%", up: false },
    { name: "Amazon RDS", spend: 54_140, pct: 19, trend: "+1.8%", up: true },
    { name: "Amazon S3 + CloudFront", spend: 33_290, pct: 12, trend: "−1.4%", up: false },
    { name: "AWS Lambda", spend: 25_180, pct: 9, trend: "+6.1%", up: true },
    { name: "Amazon OpenSearch", spend: 19_842, pct: 7, trend: "+0.2%", up: true },
    { name: "ElastiCache (Redis)", spend: 14_010, pct: 5, trend: "+1.0%", up: true },
    { name: "Amazon EKS", spend: 11_402, pct: 4, trend: "+2.4%", up: true },
    { name: "DynamoDB", spend: 8_240, pct: 3, trend: "−0.4%", up: false },
  ];
  return (
    <div style={cuCard}>
      <p style={cuLabel}>SERVICE BREAKDOWN · MTD</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 100px", gap: 12, fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span>SERVICE</span>
        <span style={{ textAlign: "right" }}>SPEND</span>
        <span style={{ textAlign: "right" }}>SHARE</span>
        <span style={{ textAlign: "right" }}>Δ vs prev</span>
        <span style={{ textAlign: "right" }}></span>
      </div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 100px", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 13, color: "#111827" }}>{r.name}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right" }}>${r.spend.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>{r.pct}%</span>
          <span style={{ fontSize: 12, color: r.up ? "#d97706" : "#16a34a", textAlign: "right" }}>{r.trend}</span>
          <span style={{ textAlign: "right" }}>
            <button style={{ fontSize: 11, color: "#3B5BDB", background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px" }}>Inspect →</button>
          </span>
        </div>
      ))}
    </div>
  );
}

function CloudUsagePage() {
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
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Cloud Usage</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, margin: "4px 0 0" }}>AWS spend across all connected accounts</p>
        </div>
        <div style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {["7D", "30D", "MTD", "QTD", "YTD"].map((t) => (
            <button key={t} style={{
              padding: "6px 12px", fontSize: 12,
              background: t === "30D" ? "#111827" : "#fff",
              color: t === "30D" ? "#fff" : "#6b7280",
              border: "none", borderRight: "1px solid #e5e5e5",
              fontWeight: t === "30D" ? 500 : 400,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { l: "Account", v: "All (4)" },
          { l: "Dimension", v: "Service" },
          { l: "Granularity", v: "Daily" },
          { l: "Region", v: "All" },
          { l: "Environment", v: "All" },
        ].map((f) => (
          <div key={f.l} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 10px", fontSize: 12, color: "#6b7280",
            background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
          }}>
            <span style={{ color: "#9ca3af" }}>{f.l}:</span>
            <span style={{ color: "#111827", fontWeight: 500 }}>{f.v}</span>
            <span style={{ color: "#9ca3af" }}>▾</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{
          padding: "6px 12px", fontSize: 12, color: "#374151",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
        }}>Export CSV</button>
      </div>

      {/* Total spend card */}
      <div style={{ ...cuCard, display: "flex", alignItems: "center", gap: 40, marginBottom: 16 }}>
        <div>
          <p style={cuLabel}>TOTAL SPEND · LAST 30 DAYS · CUR · synced 2h ago</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 }}>$274,229</p>
          <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>−6.4% vs previous 30 days</p>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "#f3f4f6" }} />
        <div>
          <p style={cuLabel}>FORECAST · END OF MONTH</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 }}>$297,500</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>vs $320k budget · on track</p>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "#f3f4f6" }} />
        <div>
          <p style={cuLabel}>SAVED MTD</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#16a34a", margin: 0 }}>$41,280</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>across 9 automated actions</p>
        </div>
      </div>

      {/* Stacked area chart */}
      <div style={{ ...cuCard, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ ...cuLabel, marginBottom: 0 }}>SPEND OVER TIME · DAILY · BY SERVICE</p>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>CUR · synced 2h ago</span>
        </div>
        <CuStackedArea height={280} />
        <CuLegend />
      </div>

      <CuBreakdownTable />
    </div>
  );
}

Object.assign(window, { CloudUsagePage });
