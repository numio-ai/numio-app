// tags-catalogue.jsx — Direction C: tag schema/library + AWS Org inheritance
const { useState: useStateC } = React;

function DirectionCatalogue({ tweaks = {} }) {
  const [tab, setTab] = useStateC("keys");
  const [selectedKey, setSelectedKey] = useStateC("cost-center");

  return (
    <AppShell crumb="Tags / Library" actions={
      <>
        <Btn icon="upload">Import from AWS Org</Btn>
        <Btn primary icon="plus">Define tag</Btn>
      </>
    }>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

        {/* Page header */}
        <div style={{ padding: "20px 28px 0", background: "#fdfdfc", borderBottom: `1px solid ${TAG.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Tag library</h1>
              <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                The canonical set of tag keys Numio recognizes — defined here or inherited from your cloud accounts.
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <Kpi label="Defined keys" value={TAG_KEYS.length} />
            <Kpi label="From AWS Org" value={2} sub="inherited" />
            <Kpi label="Required" value={TAG_KEYS.filter(k=>k.required).length} />
            <Kpi label="Overall coverage" value="78%" tone="warn" />
          </div>
          <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
            {[["keys","Keys",TAG_KEYS.length], ["values","Values",47], ["inherit","Inheritance",2], ["audit","Audit log",128]].map(([k,l,n]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: "transparent", border: "none",
                padding: "8px 14px", marginBottom: -1,
                borderBottom: tab === k ? `2px solid ${TAG.text}` : "2px solid transparent",
                fontSize: 12.5, fontWeight: tab === k ? 600 : 500,
                color: tab === k ? TAG.text : TAG.muted, cursor: "pointer", fontFamily: "inherit",
              }}>{l} <span style={{ fontSize: 10.5, color: TAG.xMuted, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>{n}</span></button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
              <Icon name="search" size={12} color={TAG.muted} />
              <input placeholder="Search keys, values, descriptions…" style={{
                width: 240, height: 24, border: "none", outline: "none",
                fontFamily: "inherit", fontSize: 12, color: TAG.text2, background: "transparent",
              }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* GRID */}
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "20px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {TAG_KEYS.map(k => (
                <KeyCard key={k.key} k={k}
                  selected={selectedKey === k.key}
                  onClick={() => setSelectedKey(k.key)} />
              ))}
              {/* Add card */}
              <button onClick={() => {}} style={{
                border: `1.5px dashed ${TAG.borderStrong}`, borderRadius: 12,
                background: "transparent", padding: 20, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: TAG.muted, gap: 8, minHeight: 180, fontFamily: "inherit",
              }}>
                <Icon name="plus" size={18} color={TAG.muted} />
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>Define a new tag key</div>
                <div style={{ fontSize: 11, color: TAG.xMuted, textAlign: "center", lineHeight: 1.4, maxWidth: 200 }}>
                  Or import from <b>AWS Organizations</b> tag policies
                </div>
              </button>
            </div>
          </div>

          {/* DETAIL DRAWER */}
          <aside style={{
            width: 380, flexShrink: 0, borderLeft: `1px solid ${TAG.border}`,
            background: "#fdfdfc", display: "flex", flexDirection: "column",
          }}>
            <KeyDetail k={TAG_KEYS.find(x => x.key === selectedKey)} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, sub, tone }) {
  const color = tone === "warn" ? TAG.warn : tone === "danger" ? TAG.danger : TAG.text;
  return (
    <div>
      <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: TAG.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const isAws = source === "AWS Org";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
      color: isAws ? "#c2410c" : TAG.muted,
      background: isAws ? "#fff7ed" : TAG.surface,
      border: `1px solid ${isAws ? "#fed7aa" : TAG.border}`,
      borderRadius: 4, padding: "1px 6px",
    }}>{isAws ? <><Icon name="cloud" size={9} color="#c2410c"/>AWS ORG</> : "NUMIO"}</span>
  );
}

function KeyCard({ k, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "#fff",
      border: `1px solid ${selected ? TAG.text : TAG.border}`,
      borderRadius: 12, padding: 16, cursor: "pointer",
      boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.04), 0 0 0 3px rgba(17,24,39,0.04)" : "0 1px 2px rgba(0,0,0,0.02)",
      position: "relative", minHeight: 180,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* head */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <TagKeyPill k={k.key} size={12} style={{ fontSize: 13, padding: "2px 7px" }} />
            {k.required && <span title="required" style={{
              fontSize: 9, fontWeight: 700, color: TAG.danger, background: TAG.dangerBg,
              border: `1px solid #fecaca`, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em",
            }}>REQ</span>}
          </div>
          <p style={{ fontSize: 11.5, color: TAG.muted, margin: 0, lineHeight: 1.4, height: 32, overflow: "hidden" }}>{k.desc}</p>
        </div>
        <Donut value={k.coverage} size={42} stroke={4} />
      </div>

      {/* values preview */}
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, alignContent: "flex-start", overflow: "hidden", maxHeight: 50 }}>
        {k.values.slice(0, 5).map(v => <TagPill key={v} k="" v={v} size={10} style={{ padding: "1px 5px" }} />)}
        {k.values.length > 5 && (
          <span style={{ fontSize: 10, color: TAG.xMuted, alignSelf: "center" }}>+{k.values.length - 5}</span>
        )}
      </div>

      {/* footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: `1px solid ${TAG.border}` }}>
        <SourceBadge source={k.source} />
        <span style={{ fontSize: 10.5, color: TAG.muted }}>{k.values.length} values</span>
        <div style={{ flex: 1 }} />
        <Icon name="dots" size={14} color={TAG.muted} />
      </div>
    </div>
  );
}

function KeyDetail({ k }) {
  if (!k) return null;
  const valueCounts = k.values.map(v => ({
    v, n: RESOURCES.filter(r => r.tags[k.key] === v).length,
  }));
  const drift = k.key === "env" ? { from: "prod", to: "production" } : null;

  return (
    <>
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${TAG.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <TagKeyPill k={k.key} size={13} style={{ fontSize: 14, padding: "3px 9px" }} />
          {k.required && <span style={{
            fontSize: 9, fontWeight: 700, color: TAG.danger, background: TAG.dangerBg,
            border: `1px solid #fecaca`, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em",
          }}>REQ</span>}
          <SourceBadge source={k.source} />
          <div style={{ flex: 1 }} />
          <Icon name="edit" size={13} color={TAG.muted} style={{ cursor: "pointer" }} />
        </div>
        <p style={{ fontSize: 12, color: TAG.text2, margin: "0 0 10px 0", lineHeight: 1.5 }}>{k.desc}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Donut value={k.coverage} size={56} stroke={6} />
          <div>
            <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Coverage</div>
            <div style={{ fontSize: 13, color: TAG.text2 }}>
              <b>{Math.round(k.coverage * 100)}%</b> of applicable resources
            </div>
            <div style={{ fontSize: 11, color: TAG.muted, marginTop: 2 }}>{Math.round(RESOURCES.length * k.coverage)}/{RESOURCES.length} resources</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "14px 20px 20px" }}>

        {drift && (
          <div style={{
            background: TAG.warnBg, border: `1px solid #fde68a`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Icon name="warn" size={11} color={TAG.warn} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: TAG.warn }}>Value drift detected</span>
            </div>
            <p style={{ fontSize: 11.5, color: TAG.text2, margin: "0 0 8px 0", lineHeight: 1.4 }}>
              1 resource uses <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3 }}>prod</Mono> instead of canonical <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3 }}>production</Mono>.
            </p>
            <Btn style={{ fontSize: 11, padding: "3px 8px" }}>Auto-fix 1 resource</Btn>
          </div>
        )}

        <SectionLabelC>Allowed values</SectionLabelC>
        <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8, overflow: "hidden" }}>
          {valueCounts.map((vc, i) => {
            const pct = RESOURCES.length ? vc.n / RESOURCES.length : 0;
            const isDrift = drift && vc.v === drift.from;
            return (
              <div key={vc.v} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 12px", borderTop: i ? `1px solid ${TAG.border}` : "none",
                background: isDrift ? TAG.warnBg : "#fff",
              }}>
                <TagPill k="" v={vc.v} size={11} drift={isDrift} style={{ padding: "1px 6px" }} />
                <div style={{ flex: 1, height: 3, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100}%`, height: "100%", background: TAG.text }} />
                </div>
                <span style={{ fontSize: 11, color: TAG.muted, fontVariantNumeric: "tabular-nums", minWidth: 18, textAlign: "right" }}>{vc.n}</span>
              </div>
            );
          })}
          <button style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderTop: `1px solid ${TAG.border}`,
            background: "transparent", border: "none", color: TAG.muted,
            fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", width: "100%",
          }}>
            <Icon name="plus" size={11} color={TAG.muted} /> Add allowed value
          </button>
        </div>

        <SectionLabelC style={{ marginTop: 20 }}>Validation</SectionLabelC>
        <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "10px 12px" }}>
          <Row label="Type"><span style={{ fontSize: 12 }}>enum</span></Row>
          <Row label="Case"><span style={{ fontSize: 12 }}>lowercase only</span></Row>
          <Row label="Pattern"><Mono style={{ fontSize: 11, color: TAG.text2 }}>^CC-[A-Z]+$</Mono></Row>
          <Row label="Applies to" last>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {["EC2","GPU","RDS","S3","Lambda","K8s"].map(t => <TypeChip key={t} t={t} />)}
            </div>
          </Row>
        </div>

        {k.source === "AWS Org" && (
          <>
            <SectionLabelC style={{ marginTop: 20 }}>Inherited from</SectionLabelC>
            <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Icon name="cloud" size={12} color="#c2410c" />
                <span style={{ fontSize: 12, fontWeight: 500 }}>AWS Organizations policy</span>
              </div>
              <Mono style={{ fontSize: 11, color: TAG.muted }}>arn:aws:organizations::tagPolicy/acme-prod-required</Mono>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Btn style={{ fontSize: 11, padding: "3px 8px" }}>View source</Btn>
                <span style={{ fontSize: 10.5, color: TAG.xMuted, alignSelf: "center" }}>read-only · sync'd 1h ago</span>
              </div>
            </div>
          </>
        )}

        <SectionLabelC style={{ marginTop: 20 }}>Coverage by resource type</SectionLabelC>
        <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "4px 12px" }}>
          {["EC2","RDS","S3","Lambda","K8s"].map((t, i) => {
            const ofType = RESOURCES.filter(r => r.type === t);
            const cov = ofType.length ? ofType.filter(r => r.tags[k.key] != null).length / ofType.length : 0;
            return (
              <Row key={t} label={<TypeChip t={t} />} last={i === 4}>
                <CoverageBar value={cov} w={120} h={4} showLabel />
              </Row>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Row({ label, children, last }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0", borderBottom: last ? "none" : `1px solid ${TAG.border}`,
    }}>
      <span style={{ fontSize: 11, color: TAG.muted, width: 88, flexShrink: 0 }}>
        {typeof label === "string" ? label : label}
      </span>
      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{children}</span>
    </div>
  );
}

function SectionLabelC({ children, style }) {
  return <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 0", ...style }}>{children}</div>;
}

Object.assign(window, { DirectionCatalogue });
