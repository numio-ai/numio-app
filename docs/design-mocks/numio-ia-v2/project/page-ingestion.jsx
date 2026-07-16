// page-ingestion.jsx — Faithful recreation of pages/Ingestion/IngestionPage.jsx
// Header + run trigger + CUR runs table (one row per account x run).

const ING_STATUS = {
  success: { bg: "#f0fdf4", color: "#15803d", dot: "#16a34a" },
  running: { bg: "#eff6ff", color: "#0369a1", dot: "#0284c7" },
  failed:  { bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626" },
  skipped: { bg: "#f3f4f6", color: "#4b5563", dot: "#9ca3af" },
};

const ING_RUNS = [
  { time: "2h ago", status: "success", account: "123456789012 · production", rows: "2.4M", duration: "4m 18s", source: "s3://numio-cur-prod/", note: "Run succeeded — 2,412,029 rows across 1 account." },
  { time: "2h ago", status: "success", account: "987654321098 · staging", rows: "412k", duration: "1m 12s", source: "s3://numio-cur-stg/" },
  { time: "8h ago", status: "success", account: "123456789012 · production", rows: "2.4M", duration: "4m 22s", source: "s3://numio-cur-prod/" },
  { time: "8h ago", status: "failed", account: "201818384402 · finance-shared", rows: "—", duration: "12s", source: "s3://numio-cur-fin/", note: "AccessDenied · iam role numio-service missing s3:GetObject on cur prefix." },
  { time: "14h ago", status: "success", account: "123456789012 · production", rows: "2.3M", duration: "4m 09s", source: "s3://numio-cur-prod/" },
  { time: "14h ago", status: "skipped", account: "404119928812 · sandbox", rows: "—", duration: "—", source: "—", note: "No CUR manifest found in last 24h." },
  { time: "20h ago", status: "success", account: "123456789012 · production", rows: "2.3M", duration: "4m 02s", source: "s3://numio-cur-prod/" },
  { time: "1d ago",  status: "success", account: "987654321098 · staging", rows: "390k", duration: "1m 04s", source: "s3://numio-cur-stg/" },
];

function IngBadge({ status }) {
  const s = ING_STATUS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: s.dot }} />
      {status}
    </span>
  );
}

function IngestionPage() {
  return (
    <div style={{
      padding: 32, maxWidth: 1200,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Data Ingestion</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>CUR ingestion jobs and their status across connected AWS accounts</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            ⟳ Refresh
          </button>
          <button style={{ fontSize: 12, color: "#fff", background: "#111827", border: "none", borderRadius: 6, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            ▶ Run CUR ingestion now
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div style={{
        background: "#fff", border: "1px solid #e5e5e5", borderLeft: "4px solid #16a34a",
        borderRadius: 12, padding: "14px 20px", marginBottom: 24,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0 }}>Last successful run: 2 hours ago</p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
            2 of 4 accounts succeeded · 1 failed · 1 skipped. Next scheduled run in ~4 hours.
          </p>
        </div>
        <a style={{ fontSize: 12, color: "#3B5BDB", fontWeight: 500 }}>View account permissions →</a>
      </div>

      <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
        CUR INGESTION RUNS · LAST 7 DAYS
      </p>

      <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "120px 110px 1fr 100px 100px 1fr",
          gap: 12, padding: "12px 16px",
          background: "#fafafa", borderBottom: "1px solid #f3f4f6",
          fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <span>STARTED</span><span>STATUS</span><span>ACCOUNT</span><span>ROWS</span><span>DURATION</span><span>SOURCE / NOTES</span>
        </div>
        {ING_RUNS.map((r, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "120px 110px 1fr 100px 100px 1fr",
            gap: 12, alignItems: "center", padding: "14px 16px",
            borderBottom: i < ING_RUNS.length - 1 ? "1px solid #f3f4f6" : "none",
          }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{r.time}</span>
            <span><IngBadge status={r.status} /></span>
            <span style={{ fontSize: 12, color: "#111827", fontFamily: "JetBrains Mono, monospace" }}>{r.account}</span>
            <span style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>{r.rows}</span>
            <span style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>{r.duration}</span>
            <span style={{ fontSize: 12, color: r.status === "failed" ? "#dc2626" : "#6b7280", fontFamily: r.source.startsWith("s3") ? "JetBrains Mono, monospace" : "inherit" }}>
              {r.note || r.source}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
        Auto-refreshes every 30s · <a style={{ color: "#3B5BDB" }}>Configure CUR sources in Settings →</a>
      </p>
    </div>
  );
}

Object.assign(window, { IngestionPage });
