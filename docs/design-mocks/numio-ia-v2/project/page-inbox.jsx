// page-inbox.jsx — IA v2 — renamed Feed. Same content, "Inbox" framing.
// Adds a small "Items needing attention" framing line and pinning controls.

const INBOX_SEV = {
  critical: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  high:     { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  medium:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  low:      { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7" },
  info:     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};
const INBOX_STATUS = {
  open:         { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  acknowledged: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  resolved:     { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7" },
};

function InboxBadge({ value, palette }) {
  const s = palette[value] || { bg: "#f3f4f6", color: "#374151", border: "#e5e5e5" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, borderRadius: 4,
      padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{value}</span>
  );
}

const INBOX_DATA = [
  { sev: "critical", type: "anomaly", status: "open", title: "EC2 spend in us-east-1 spiked +218% on Mar 8",
    rid: "i-0a4f8c2d…  · ec2 · us-east-1", time: "12m ago", cost: 1840 },
  { sev: "high", type: "zombie", status: "open", title: "38 unattached EBS volumes detected (4.2 TB gp3)",
    rid: "vol-079b3… +37 more  · ebs · multiple", time: "1h ago", cost: 612 },
  { sev: "high", type: "policy_violation", status: "open", title: "PR #4821 projects +23% cost in payments/service-ledger",
    rid: "github://payments/service-ledger#4821", time: "14m ago", cost: 4310 },
  { sev: "medium", type: "tag_violation", status: "acknowledged", title: "6 production resources missing cost-center tag",
    rid: "i-0fc7… +5 · ec2 · us-east-1 · acknowledged by james@", time: "3h ago", cost: null },
  { sev: "medium", type: "idle", status: "open", title: "142 dev/sandbox resources at <2% CPU for 14 nights",
    rid: "aws://dev/* + gcp://sandbox/* · 142 resources", time: "2h ago", cost: 11820 },
  { sev: "low", type: "anomaly", status: "resolved", title: "BigQuery slot consumption normalized after backfill",
    rid: "gcp://prod/analytics · resolved automatically", time: "1d ago", cost: null },
];

function InboxCard({ f, expanded }) {
  const sev = INBOX_SEV[f.sev];
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e5e5",
      borderRadius: 12,
      marginBottom: 8,
      borderLeft: `4px solid ${sev.color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <InboxBadge value={f.sev} palette={INBOX_SEV} />
            <InboxBadge value={f.type.replace("_", " ")} palette={{ [f.type.replace("_", " ")]: { bg: "#f3f4f6", color: "#374151", border: "#e5e5e5" } }} />
            <InboxBadge value={f.status} palette={INBOX_STATUS} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0 }}>{f.title}</p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>{f.rid} · {f.time}</p>
        </div>
        {f.cost != null && (
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#dc2626", margin: 0 }}>${f.cost.toLocaleString()}/mo</p>
          </div>
        )}
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 16px", borderTop: "1px solid #e5e5e5" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 14 }}>
            {[
              { l: "DETECTION SOURCE", v: "cur_anomaly_detector" },
              { l: "DETECTED", v: "Mar 8, 2026 14:22 UTC" },
              { l: "LAST SEEN", v: "Mar 8, 2026 16:08 UTC" },
              { l: "COST IMPACT", v: "$1,840 / mo", color: "#dc2626", bold: true },
            ].map((d) => (
              <div key={d.l}>
                <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>{d.l}</p>
                <p style={{ fontSize: 13, color: d.color || "#111827", fontWeight: d.bold ? 600 : 400, margin: 0 }}>{d.v}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={{ fontSize: 12, fontWeight: 500, color: "#3B5BDB", background: "none", border: "1px solid #3B5BDB", borderRadius: 6, padding: "6px 14px" }}>Investigate →</button>
            <button style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: "#111827", border: "none", borderRadius: 6, padding: "6px 14px" }}>Acknowledge</button>
            <button style={{ fontSize: 12, fontWeight: 500, color: "#16a34a", background: "none", border: "1px solid #16a34a", borderRadius: 6, padding: "6px 14px" }}>Resolve</button>
          </div>
        </div>
      )}
    </div>
  );
}

const INBOX_TABS = [
  { k: "all", l: "All", n: 11 }, { k: "anomaly", l: "Anomaly", n: 2 },
  { k: "zombie", l: "Zombie", n: 1 }, { k: "idle", l: "Idle", n: 1 },
  { k: "policy_violation", l: "Policy", n: 1 }, { k: "tag_violation", l: "Tag", n: 6 },
];

function InboxPage() {
  const active = "all";
  return (
    <div style={{
      padding: 32, maxWidth: 960,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Inbox</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>11 findings need attention · $18,582/mo in detected waste</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 12px" }}>Bulk acknowledge</button>
          <button style={{ fontSize: 12, color: "#fff", background: "#111827", border: "none", borderRadius: 6, padding: "6px 12px" }}>✨ Triage with Numio</button>
        </div>
      </div>

      {/* Compact summary strip */}
      <section style={{
        background: "#fff", border: "1px solid #e5e5e5",
        borderRadius: 12, padding: "12px 20px",
        marginBottom: 20, display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap",
      }}>
        {[
          { l: "OPEN", v: 11, c: "#dc2626" },
          { l: "CRITICAL", v: 3, c: "#dc2626" },
          { l: "ACKNOWLEDGED", v: 5, c: "#2563eb" },
          { l: "RESOLVED · 7D", v: 13, c: "#16a34a" },
          { l: "DETECTED WASTE", v: "$18,582/mo", c: "#111827" },
        ].map((s) => (
          <div key={s.l}>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>{s.l}</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: s.c, margin: "2px 0 0" }}>{s.v}</p>
          </div>
        ))}
      </section>

      {/* Tabs + severity dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {INBOX_TABS.map((t) => {
            const on = t.k === active;
            return (
              <button key={t.k} style={{
                padding: "4px 12px", fontSize: 13,
                fontWeight: on ? 500 : 400, borderRadius: 6,
                border: `1px solid ${on ? "#111827" : "#e5e5e5"}`,
                background: on ? "#111827" : "#fff",
                color: on ? "#fff" : "#6b7280",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {t.l}
                <span style={{ fontSize: 10, color: on ? "#d1d5db" : "#9ca3af", fontWeight: 400 }}>{t.n}</span>
              </button>
            );
          })}
        </div>
        <div style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e5e5",
          fontSize: 13, color: "#6b7280", background: "#fff",
        }}>All severities ▾</div>
        <div style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e5e5",
          fontSize: 13, color: "#6b7280", background: "#fff",
        }}>Newest first ▾</div>
      </div>

      {INBOX_DATA.map((f, i) => <InboxCard key={i} f={f} expanded={i === 0} />)}
    </div>
  );
}

Object.assign(window, { InboxPage });
