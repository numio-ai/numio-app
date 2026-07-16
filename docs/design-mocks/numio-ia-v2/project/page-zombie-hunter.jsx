// page-zombie-hunter.jsx — Faithful recreation of pages/Controls/ZombieHunterPage.jsx
// Summary stats + type-filter chips + finding cards grouped by impact.

const ZH_FILTERS = ["All", "EC2 Instance", "EBS Volume", "Elastic IP", "EBS Snapshot", "Load Balancer", "Idle Resource"];

const ZH_DATA = [
  { type: "EBS Volume", title: "38 unattached EBS volumes (gp3, avg age 41d)",
    rid: "vol-079b3f12c4ad99e + 37 more", cost: 612, severity: "high",
    cli: "aws ec2 delete-volume --volume-id vol-079b3f12c4ad99e",
    detail: "Volumes unattached for >30 days, totaling 4.2 TB gp3. Snapshot-on-detach retained; deletion reversible for 7 days." },
  { type: "Idle Resource", title: "142 dev/sandbox resources at <2% CPU for 14 nights",
    rid: "aws://dev/* + gcp://sandbox/* · 142 resources", cost: 11820, severity: "critical",
    cli: "# Hibernate via tag-based automation rule\nnumio rule run nightly-nonprod-hibernate",
    detail: "Tagged owners last activity > 9 days ago. No active incidents. Wake-on-PR rule re-enables on next branch push." },
  { type: "Elastic IP", title: "5 unassociated Elastic IPs",
    rid: "eip-0c1f9b2e + 4 more", cost: 18, severity: "medium",
    cli: "aws ec2 release-address --allocation-id eipalloc-0c1f9b2e" },
  { type: "EC2 Instance", title: "3 stopped EC2 instances retained > 60 days",
    rid: "i-08fa3c1b9d4e76f02 + 2 more", cost: 0, severity: "low",
    cli: "aws ec2 terminate-instances --instance-ids i-08fa3c1b9d4e76f02" },
  { type: "EBS Snapshot", title: "412 snapshots orphaned (no parent volume)",
    rid: "snap-0d7f… + 411 more", cost: 84, severity: "medium",
    cli: "aws ec2 delete-snapshot --snapshot-id snap-0d7f…" },
];

const ZH_SEV = {
  critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a",
};

function ZHCard({ z }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e5e5",
      borderRadius: 12, borderLeft: `4px solid ${ZH_SEV[z.severity]}`,
      padding: "16px 20px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#374151", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, border: "1px solid #e5e5e5" }}>{z.type}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: ZH_SEV[z.severity], textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ● {z.severity}
            </span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0 }}>{z.title}</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0", fontFamily: "JetBrains Mono, monospace" }}>{z.rid}</p>
          {z.detail && (
            <p style={{ fontSize: 12, color: "#6b7280", margin: "10px 0 0", lineHeight: 1.5 }}>{z.detail}</p>
          )}
          {z.cli && (
            <div style={{
              marginTop: 10, fontSize: 11, color: "#374151",
              background: "#0f172a", borderRadius: 6, padding: "8px 10px",
              fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-wrap",
            }}>
              <span style={{ color: "#a5f3fc" }}>$ </span>
              <span style={{ color: "#e2e8f0" }}>{z.cli}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#dc2626", margin: 0 }}>
            ${z.cost.toLocaleString()}/mo
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>monthly waste</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            <button style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: "#111827", border: "none", borderRadius: 6, padding: "6px 12px" }}>Clean up</button>
            <button style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 12px" }}>Acknowledge</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZombieHunterPage() {
  return (
    <div style={{
      padding: 32, maxWidth: 1100,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box",
    }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Zombie Hunter</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>Idle and orphaned resources costing you money</p>
      </div>

      {/* Summary bar */}
      <div style={{ background: "#fff", borderLeft: "4px solid #dc2626", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { l: "MONTHLY WASTE", v: "$12,534", c: "#dc2626" },
          { l: "ZOMBIE RESOURCES", v: "458", c: "#111827" },
          { l: "IDLE RESOURCES", v: "142", c: "#d97706" },
          { l: "RESOLVED MTD", v: "$3,820", c: "#16a34a", sub: "across 31 actions" },
        ].map((s) => (
          <div key={s.l}>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{s.l}</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: s.c, margin: 0 }}>{s.v}</p>
            {s.sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {ZH_FILTERS.map((f) => {
          const on = f === "All";
          return (
            <button key={f} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
              borderRadius: 6, border: `1px solid ${on ? "#111827" : "#e5e5e5"}`,
              background: on ? "#111827" : "#fff",
              color: on ? "#fff" : "#6b7280",
            }}>{f}</button>
          );
        })}
      </div>

      <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
        OPEN FINDINGS · SORTED BY COST IMPACT
      </p>
      {ZH_DATA.map((z, i) => <ZHCard key={i} z={z} />)}
    </div>
  );
}

Object.assign(window, { ZombieHunterPage });
