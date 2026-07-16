// tags-schema.jsx — Schema tab (the "Library" view) + AWS Org sync modal
// Lives at /tag-governance under a "Schema" tab next to "Resources".
const { useState: useStateSc } = React;

const SC = {
  border: "#efefef", borderStrong: "#e5e5e5",
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  bg: "#f7f7f7", surface: "#ffffff", surfaceMuted: "#fafafa",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  success: "#16a34a", successBg: "#f0fdf4",
  warn: "#d97706", warnBg: "#fffbeb",
  danger: "#dc2626", dangerBg: "#fef2f2",
  aws: "#c2410c", awsBg: "#fff7ed", awsBd: "#fed7aa",
};

// ============================================================
// SCHEMA TAB
// ============================================================
function SchemaTabContent({ onShowConflict }) {
  const [activeTab, setActiveTab] = useStateSc("schema");
  const [selectedKey, setSelectedKey] = useStateSc("cost-center");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: SC.bg }}>

      {/* PAGE HEADER */}
      <div style={{ background: SC.surface, borderBottom: `1px solid ${SC.border}`, padding: "16px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: SC.text, margin: 0 }}>Tag Governance</h1>
            <p style={{ fontSize: 13, color: SC.muted, margin: "4px 0 0" }}>Review resources, assign tags, and curate the tag schema.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnGhostS} onClick={onShowConflict}>
              <LIcon name="zap" size={12} color={SC.aws} strokeWidth={2} /> 1 AWS Org conflict
            </button>
            <button style={btnPrimaryS}><LIcon name="plus" size={12} color="#fff" strokeWidth={2} /> Define key</button>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 0 }}>
          <TabBtn label="Resources" count="22" active={activeTab === "resources"} onClick={() => setActiveTab("resources")} />
          <TabBtn label="Schema" count="8" active={activeTab === "schema"} onClick={() => setActiveTab("schema")} />
          <TabBtn label="Audit log" count="128" active={activeTab === "audit"} onClick={() => setActiveTab("audit")} />
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* LEFT — Key list */}
        <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "16px 24px 24px" }}>
          {/* AWS Org banner */}
          <div style={{
            background: SC.awsBg, border: `1px solid ${SC.awsBd}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: SC.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <LIcon name="server" size={16} color={SC.aws} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: SC.text }}>
                Linked to AWS Organizations <span style={{ color: SC.muted, fontWeight: 400 }}>· 2 of 8 keys inherited</span>
              </div>
              <div style={{ fontSize: 11.5, color: SC.text2, marginTop: 2 }}>
                <code style={awsCodeS}>arn:aws:organizations::tagPolicy/acme-prod-required</code> · synced 1h ago
              </div>
            </div>
            <button style={{ ...btnGhostS, padding: "5px 10px", fontSize: 11 }}>Re-sync</button>
            <button style={{ ...btnGhostS, padding: "5px 10px", fontSize: 11 }} onClick={onShowConflict}>Resolve 1 conflict</button>
          </div>

          {/* Section: Required */}
          <SectionLabel>Required keys <span style={{ color: SC.muted, fontWeight: 400 }}>· 4</span></SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            <KeyRow keyName="env" desc="Deployment environment" source="numio" coverage={93}
              valueCount={3} drift selected={selectedKey==="env"} onClick={() => setSelectedKey("env")} />
            <KeyRow keyName="team" desc="Owning team or business unit" source="numio" coverage={84}
              valueCount={6} selected={selectedKey==="team"} onClick={() => setSelectedKey("team")} />
            <KeyRow keyName="cost-center" desc="Budget code for cost allocation" source="aws-org" coverage={72}
              valueCount={4} conflict selected={selectedKey==="cost-center"} onClick={() => setSelectedKey("cost-center")} />
            <KeyRow keyName="owner" desc="Individual owner (email)" source="numio" coverage={78}
              valueCount={7} selected={selectedKey==="owner"} onClick={() => setSelectedKey("owner")} />
          </div>

          {/* Section: Optional */}
          <SectionLabel>Optional keys <span style={{ color: SC.muted, fontWeight: 400 }}>· 4</span></SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            <KeyRow keyName="project" desc="Project or initiative name" source="numio" coverage={41}
              valueCount={5} selected={selectedKey==="project"} onClick={() => setSelectedKey("project")} />
            <KeyRow keyName="service" desc="Application or micro-service" source="numio" coverage={62}
              valueCount={13} selected={selectedKey==="service"} onClick={() => setSelectedKey("service")} />
            <KeyRow keyName="ai-model" desc="AI/ML model identifier" source="numio" coverage={50}
              valueCount={2} selected={selectedKey==="ai-model"} onClick={() => setSelectedKey("ai-model")} />
            <KeyRow keyName="compliance" desc="Regulatory classification" source="aws-org" coverage={18}
              valueCount={3} selected={selectedKey==="compliance"} onClick={() => setSelectedKey("compliance")} />
          </div>

          {/* Section: Discovered (not yet promoted) */}
          <SectionLabel>
            <LIcon name="sparkles" size={11} color={SC.ai2} strokeWidth={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Discovered in cloud · not yet in schema <span style={{ color: SC.muted, fontWeight: 400 }}>· 3</span>
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <DiscoveredRow keyName="region-override" usage="3 EC2 instances" />
            <DiscoveredRow keyName="purchased-via" usage="12 resources, 2 distinct values" />
            <DiscoveredRow keyName="temp-do-not-use" usage="1 S3 bucket (likely abandoned)" />
          </div>
        </div>

        {/* RIGHT — Key detail */}
        <KeyDetailPanel keyName={selectedKey} onShowConflict={onShowConflict} />
      </div>
    </div>
  );
}

function TabBtn({ label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none",
      padding: "10px 16px", marginBottom: -1,
      borderBottom: active ? `2px solid ${SC.text}` : "2px solid transparent",
      fontSize: 13, fontWeight: active ? 600 : 500,
      color: active ? SC.text : SC.muted, cursor: "pointer", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {label}
      <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: active ? SC.muted : SC.xMuted }}>{count}</span>
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: SC.xMuted,
      textTransform: "uppercase", letterSpacing: "0.08em",
      margin: "0 0 8px 0",
    }}>{children}</div>
  );
}

function KeyRow({ keyName, desc, source, coverage, valueCount, drift, conflict, selected, onClick }) {
  const cov = coverage >= 85 ? SC.success : coverage >= 60 ? SC.warn : SC.danger;
  return (
    <div onClick={onClick} style={{
      background: selected ? SC.surface : SC.surface,
      border: `1px solid ${selected ? SC.text : SC.border}`,
      boxShadow: selected ? "0 0 0 3px rgba(17,24,39,0.04)" : "none",
      borderRadius: 8, padding: "10px 14px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500,
        background: "#f3f0ff", color: SC.text, border: "1px solid #e9e3ff",
        padding: "1px 7px", borderRadius: 4, minWidth: 110, textAlign: "left",
      }}>{keyName}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "0.03em",
        color: source === "aws-org" ? SC.aws : SC.muted,
        background: source === "aws-org" ? SC.awsBg : SC.surface,
        border: `1px solid ${source === "aws-org" ? SC.awsBd : SC.border}`,
        padding: "0 5px", borderRadius: 3,
      }}>{source === "aws-org" ? "AWS ORG" : "NUMIO"}</span>
      <span style={{ flex: 1, fontSize: 12, color: SC.muted, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{desc}</span>
      <span style={{ fontSize: 11, color: SC.muted }}>{valueCount} values</span>
      {drift && <span style={{ fontSize: 10, fontWeight: 700, color: SC.warn, background: SC.warnBg, border: `1px solid #fde68a`, padding: "1px 5px", borderRadius: 4 }}>1 drift</span>}
      {conflict && <span style={{ fontSize: 10, fontWeight: 700, color: SC.aws, background: SC.awsBg, border: `1px solid ${SC.awsBd}`, padding: "1px 5px", borderRadius: 4 }}>conflict</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80, justifyContent: "flex-end" }}>
        <div style={{ width: 48, height: 3, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
          <div style={{ width: `${coverage}%`, height: "100%", background: cov, borderRadius: 9999 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: cov, fontVariantNumeric: "tabular-nums", minWidth: 26, textAlign: "right" }}>{coverage}%</span>
      </div>
    </div>
  );
}

function DiscoveredRow({ keyName, usage }) {
  return (
    <div style={{
      border: `1px dashed ${SC.borderStrong}`, borderRadius: 8,
      padding: "9px 14px", display: "flex", alignItems: "center", gap: 10,
      background: "transparent",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500,
        color: SC.muted, background: SC.surfaceMuted, border: `1px solid ${SC.border}`,
        padding: "1px 7px", borderRadius: 4, minWidth: 130,
      }}>{keyName}</span>
      <span style={{ flex: 1, fontSize: 12, color: SC.muted }}>{usage}</span>
      <button style={{ ...btnGhostS, padding: "3px 9px", fontSize: 11 }}>Promote to schema</button>
      <button style={{ background: "transparent", border: "none", color: SC.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Ignore</button>
    </div>
  );
}

// ---------- DETAIL PANEL ----------
function KeyDetailPanel({ keyName, onShowConflict }) {
  // Mocked detail for a few keys
  const data = {
    "cost-center": {
      desc: "Budget code for cost allocation",
      source: "aws-org",
      required: true,
      coverage: 72,
      valueType: "enum",
      pattern: "^CC-[A-Z]+$",
      values: [
        { v: "CC-ENG", n: 8 }, { v: "CC-ML", n: 4 },
        { v: "CC-DATA", n: 3 }, { v: "CC-OPS", n: 1 },
      ],
      conflict: true,
    },
    env: {
      desc: "Deployment environment",
      source: "numio",
      required: true,
      coverage: 93,
      valueType: "enum",
      pattern: "lowercase",
      values: [
        { v: "production", n: 8 }, { v: "staging", n: 5 },
        { v: "dev", n: 7 }, { v: "prod", n: 1, drift: true },
      ],
    },
  };
  const k = data[keyName] || data["cost-center"];

  return (
    <aside style={{
      width: 380, flexShrink: 0, borderLeft: `1px solid ${SC.border}`,
      background: SC.surface, display: "flex", flexDirection: "column",
    }}>
      {/* head */}
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${SC.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600,
            background: "#f3f0ff", color: SC.text, border: "1px solid #e9e3ff",
            padding: "2px 8px", borderRadius: 5,
          }}>{keyName}</span>
          {k.required && <span style={{ fontSize: 9, fontWeight: 700, color: SC.danger, background: SC.dangerBg, border: `1px solid #fecaca`, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em" }}>REQ</span>}
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.03em", color: k.source === "aws-org" ? SC.aws : SC.muted, background: k.source === "aws-org" ? SC.awsBg : SC.surface, border: `1px solid ${k.source === "aws-org" ? SC.awsBd : SC.border}`, padding: "1px 5px", borderRadius: 3 }}>
            {k.source === "aws-org" ? "AWS ORG" : "NUMIO"}
          </span>
          <div style={{ flex: 1 }} />
          <button style={{ background: "transparent", border: "none", color: SC.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
        </div>
        <p style={{ fontSize: 12, color: SC.text2, margin: "0 0 12px", lineHeight: 1.5 }}>{k.desc}</p>

        {k.conflict && (
          <div onClick={onShowConflict} style={{
            background: SC.awsBg, border: `1px solid ${SC.awsBd}`,
            borderRadius: 6, padding: "7px 10px", marginBottom: 4,
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          }}>
            <LIcon name="zap" size={11} color={SC.aws} strokeWidth={2} />
            <span style={{ fontSize: 11.5, color: SC.aws, flex: 1 }}>
              AWS Org allowed values don't match yours
            </span>
            <span style={{ fontSize: 10, color: SC.aws }}>Resolve →</span>
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 20px 20px" }}>
        <DetailSection title="Allowed values">
          <div style={{ background: SC.surface, border: `1px solid ${SC.border}`, borderRadius: 8, overflow: "hidden" }}>
            {k.values.map((vc, i) => (
              <div key={vc.v} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderTop: i ? `1px solid ${SC.border}` : "none",
                background: vc.drift ? SC.warnBg : "transparent",
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  color: SC.text2, background: SC.surfaceMuted,
                  border: `1px solid ${SC.border}`, padding: "1px 6px", borderRadius: 4,
                }}>{vc.v}</span>
                {vc.drift && <span style={{ fontSize: 10, color: SC.warn, fontWeight: 500 }}>drift</span>}
                <div style={{ flex: 1, height: 3, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ width: `${vc.n / 22 * 100}%`, height: "100%", background: SC.text }} />
                </div>
                <span style={{ fontSize: 11, color: SC.muted, minWidth: 20, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{vc.n}</span>
              </div>
            ))}
            <button style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 12px", borderTop: `1px solid ${SC.border}`,
              background: "transparent", border: "none", color: SC.muted,
              fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", width: "100%",
            }}>+ Add allowed value</button>
          </div>
        </DetailSection>

        <DetailSection title="Validation">
          <KV label="Type">enum</KV>
          <KV label="Pattern"><code style={inlineCodeS}>{k.pattern}</code></KV>
          <KV label="Applies to">
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {["EC2", "RDS", "S3", "Lambda", "K8s"].map(t => (
                <span key={t} style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
                  background: "#f3f4f6", color: SC.text2,
                  padding: "1px 5px", borderRadius: 3,
                }}>{t}</span>
              ))}
            </div>
          </KV>
        </DetailSection>

        {k.source === "aws-org" && (
          <DetailSection title="Inherited from">
            <div style={{ background: SC.surface, border: `1px solid ${SC.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <LIcon name="server" size={12} color={SC.aws} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>AWS Organizations tag policy</span>
              </div>
              <code style={{ ...inlineCodeS, fontSize: 10.5, color: SC.muted, display: "block", wordBreak: "break-all", marginTop: 4, padding: 0, background: "transparent" }}>
                arn:aws:organizations::tagPolicy/acme-prod-required
              </code>
              <div style={{ display: "flex", gap: 6, marginTop: 8, fontSize: 10.5, color: SC.xMuted, alignItems: "center" }}>
                <button style={{ ...btnGhostS, padding: "3px 8px", fontSize: 11 }}>View source</button>
                <span>read-only · sync'd 1h ago</span>
              </div>
            </div>
          </DetailSection>
        )}
      </div>
    </aside>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: SC.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function KV({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${SC.border}`, fontSize: 12 }}>
      <span style={{ width: 80, color: SC.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: SC.text2, flex: 1, display: "flex", justifyContent: "flex-end" }}>{children}</span>
    </div>
  );
}

// ============================================================
// AWS ORG SYNC CONFLICT MODAL
// ============================================================
function AwsOrgConflictModal({ onClose }) {
  const [resolution, setResolution] = useStateSc("aws-wins");
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 580, maxWidth: "90%",
        background: SC.surface, borderRadius: 12,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", maxHeight: "90%",
      }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${SC.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: SC.awsBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LIcon name="zap" size={14} color={SC.aws} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: SC.text, margin: 0 }}>Schema conflict with AWS Organizations</h2>
          </div>
          <p style={{ fontSize: 12.5, color: SC.muted, margin: "0 0 0 38px", lineHeight: 1.5 }}>
            AWS Org's tag policy and your Numio schema both define <code style={inlineCodeS}>cost-center</code>, but with different rules.
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 22px" }}>
          {/* Diff */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <DiffCol title="Numio schema" source="numio" values={["CC-ENG", "CC-ML", "CC-DATA", "CC-OPS"]} />
            <DiffCol title="AWS Org policy" source="aws-org" values={["CC-ENG", "CC-ML", "CC-DATA", "CC-OPS", "CC-FIN", "CC-HR"]} extra={["CC-FIN", "CC-HR"]} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: SC.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            How should we resolve this?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ResolveOption
              id="aws-wins" current={resolution} onSelect={setResolution}
              title="Use AWS Org as source of truth"
              desc="Adopt AWS values (adds CC-FIN, CC-HR). Numio schema mirrors AWS automatically going forward."
              recommended />
            <ResolveOption
              id="numio-wins" current={resolution} onSelect={setResolution}
              title="Keep Numio schema, ignore AWS additions"
              desc="CC-FIN and CC-HR remain rejected by Numio. Resources using them will be flagged as invalid."
              warn="May cause new compliance failures on 0 current resources" />
            <ResolveOption
              id="manual" current={resolution} onSelect={setResolution}
              title="Pick which values to adopt manually"
              desc="Choose CC-FIN / CC-HR individually. Future drift on either side will re-open this prompt." />
          </div>
        </div>

        <div style={{ padding: "12px 22px", borderTop: `1px solid ${SC.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: SC.muted }}>This decision is logged to the audit log.</span>
          <div style={{ flex: 1 }} />
          <button style={btnGhostS} onClick={onClose}>Cancel</button>
          <button style={btnPrimaryS}>Apply resolution</button>
        </div>
      </div>
    </div>
  );
}

function DiffCol({ title, source, values, extra = [] }) {
  return (
    <div style={{ border: `1px solid ${SC.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        padding: "8px 12px", borderBottom: `1px solid ${SC.border}`,
        background: source === "aws-org" ? SC.awsBg : SC.surfaceMuted,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: source === "aws-org" ? SC.aws : SC.text }}>{title}</span>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.03em",
          color: source === "aws-org" ? SC.aws : SC.muted,
          background: SC.surface,
          border: `1px solid ${source === "aws-org" ? SC.awsBd : SC.border}`,
          padding: "0 5px", borderRadius: 3,
        }}>{source === "aws-org" ? "AWS ORG" : "NUMIO"}</span>
      </div>
      <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 3 }}>
        {values.map(v => (
          <span key={v} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: extra.includes(v) ? SC.aws : SC.text2,
            background: extra.includes(v) ? SC.awsBg : SC.surfaceMuted,
            border: `1px solid ${extra.includes(v) ? SC.awsBd : SC.border}`,
            padding: "1px 6px", borderRadius: 4, fontWeight: extra.includes(v) ? 600 : 400,
          }}>{v}{extra.includes(v) && " +"}</span>
        ))}
      </div>
    </div>
  );
}

function ResolveOption({ id, current, onSelect, title, desc, recommended, warn }) {
  const selected = current === id;
  return (
    <label onClick={() => onSelect(id)} style={{
      display: "flex", gap: 12, padding: "10px 12px",
      border: `1px solid ${selected ? SC.text : SC.border}`,
      borderRadius: 8, cursor: "pointer", background: selected ? "#fafaf9" : SC.surface,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        border: `1.5px solid ${selected ? SC.text : SC.borderStrong}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
      }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: SC.text }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: SC.text }}>{title}</span>
          {recommended && <span style={{ fontSize: 9, fontWeight: 700, color: SC.success, background: SC.successBg, border: "1px solid #d1fae5", padding: "0 5px", borderRadius: 3, letterSpacing: "0.04em" }}>RECOMMENDED</span>}
        </div>
        <p style={{ fontSize: 11.5, color: SC.muted, margin: 0, lineHeight: 1.45 }}>{desc}</p>
        {warn && (
          <p style={{ fontSize: 11, color: SC.warn, margin: "4px 0 0", lineHeight: 1.4 }}>
            <LIcon name="zap" size={10} color={SC.warn} strokeWidth={2} style={{ verticalAlign: "middle", marginRight: 3 }} />{warn}
          </p>
        )}
      </div>
    </label>
  );
}

// ---------- atoms ----------
const btnPrimaryS = {
  background: SC.text, color: "#fff", border: "none", borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const btnGhostS = {
  background: SC.surface, color: SC.text2, border: `1px solid ${SC.border}`,
  borderRadius: 6, fontSize: 12, fontWeight: 500, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 5,
};
const inlineCodeS = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  background: SC.aiBg, color: SC.ai2, padding: "1px 5px", borderRadius: 3,
};
const awsCodeS = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  background: SC.surface, color: SC.aws, padding: "1px 5px", borderRadius: 3,
  border: `1px solid ${SC.awsBd}`,
};

Object.assign(window, { SchemaTabContent, AwsOrgConflictModal });
