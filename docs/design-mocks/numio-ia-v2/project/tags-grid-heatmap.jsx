// tags-grid-heatmap.jsx — Direction A2: heatmap scan view
// Same rows × tag-keys grid, but cells are colored swatches:
//   filled-green = present, dashed-red = required missing, amber = drift, gray = N/A
// Goal: spot coverage gaps across a fleet in <2 seconds, then click squares to drill in.
const { useState: useStateH } = React;

function GridHeatmap({ tweaks = {} }) {
  const [selected, setSelected] = useStateH(new Set());
  const [hover, setHover] = useStateH(null);
  const [keyFilter, setKeyFilter] = useStateH("all"); // all | missing-required | drift
  const [sortBy, setSortBy] = useStateH("gaps"); // gaps | spend | name

  // include all 8 keys for the scan
  const cols = TAG_KEYS;
  const rowsRaw = RESOURCES;

  // per-row score (number of required gaps; ties broken by spend desc)
  const scored = rowsRaw.map(r => {
    const gaps = cols.filter(c => c.required && r.tags[c.key] == null).length;
    const drifts = cols.filter(c => (c.key === "env" && r.tags[c.key] === "prod")).length;
    return { r, gaps, drifts };
  });
  const rows = [...scored].sort((a, b) =>
    sortBy === "gaps" ? (b.gaps - a.gaps) || (b.r.spend - a.r.spend) :
    sortBy === "spend" ? (b.r.spend - a.r.spend) :
    a.r.name.localeCompare(b.r.name)
  );

  // coverage stats per column (across full fleet)
  const colStats = cols.map(c => {
    const total = rowsRaw.length;
    const filled = rowsRaw.filter(r => r.tags[c.key] != null).length;
    return { ...c, filled, total };
  });

  // overall fleet metrics
  const totalCells = rowsRaw.length * cols.filter(c => c.required).length;
  const filledCells = rowsRaw.reduce((acc, r) => acc + cols.filter(c => c.required && r.tags[c.key] != null).length, 0);

  return (
    <AppShell crumb="Tags / Health scan" actions={
      <>
        <Btn icon="list">Switch to table</Btn>
        <Btn primary icon="sparkle">Auto-fill plan</Btn>
      </>
    }>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* HEADER STRIP */}
        <div style={{ padding: "20px 28px 14px", background: "#fdfdfc", borderBottom: `1px solid ${TAG.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Tag health scan</h1>
              <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                {rowsRaw.length} resources across {cols.length} tag keys · sorted by largest gaps first
              </p>
            </div>
            <div style={{ flex: 1 }} />

            {/* Big numbers */}
            <KpiH label="Required coverage" value={`${Math.round(filledCells/totalCells*100)}%`} tone="warn" />
            <KpiH label="Resources with gaps" value={scored.filter(s => s.gaps > 0).length} sub={`of ${rowsRaw.length}`} />
            <KpiH label="Drift incidents" value={scored.reduce((a,s)=>a+s.drifts, 0)} tone="warn" />
            <KpiH label="At-risk spend" value="$11.3k" sub="/mo" tone="danger" />
          </div>

          {/* Legend + filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Legend />
            <div style={{ flex: 1 }} />
            <SegBtn options={[["all","All"],["missing-required","Required missing"],["drift","Drift"]]} value={keyFilter} onChange={setKeyFilter} />
            <SmallSelectH label="Sort" value={sortBy} options={[["gaps","Most gaps"],["spend","Spend"],["name","Name"]]} onChange={setSortBy} />
          </div>
        </div>

        {/* HEATMAP */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 24px", background: "#fff" }}>
          <div style={{
            display: "grid",
            // resource col + 8 key cols
            gridTemplateColumns: `300px repeat(${cols.length}, 86px) 1fr`,
            rowGap: 2, columnGap: 0,
            fontFamily: "inherit",
          }}>
            {/* === HEADER ROW === */}
            <div style={hHead}>
              <span style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Resource</span>
            </div>
            {colStats.map(c => (
              <div key={c.key} style={hHead}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <TagKeyPill k={c.key} size={10} style={{ fontSize: 10, padding: "1px 5px" }} />
                    {c.required && <span title="required" style={{ width: 4, height: 4, borderRadius: 2, background: TAG.danger }} />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      fontSize: 10, fontVariantNumeric: "tabular-nums",
                      color: c.filled/c.total >= 0.85 ? TAG.success : c.filled/c.total >= 0.6 ? TAG.warn : TAG.danger,
                      fontWeight: 600,
                    }}>{Math.round(c.filled/c.total*100)}%</span>
                    <div style={{ flex: 1, height: 2, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
                      <div style={{ width: `${c.filled/c.total*100}%`, height: "100%", background: c.filled/c.total >= 0.85 ? TAG.success : c.filled/c.total >= 0.6 ? TAG.warn : TAG.danger }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={hHead}><span style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</span></div>

            {/* === ROWS === */}
            {rows.map(({ r, gaps, drifts }) => {
              const isSel = selected.has(r.id);
              return (
                <React.Fragment key={r.id}>
                  {/* Resource col */}
                  <div style={{
                    ...hCell,
                    padding: "6px 8px",
                    background: isSel ? "#f5f8ff" : "transparent",
                    borderLeft: `2px solid ${gaps > 1 ? TAG.danger : gaps === 1 ? TAG.warn : "transparent"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  }} onClick={() => setSelected(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}>
                    <input type="checkbox" checked={isSel} onChange={() => {}} style={{ pointerEvents: "none" }} />
                    <TypeChip t={r.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: TAG.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: TAG.xMuted, fontVariantNumeric: "tabular-nums" }}>${r.spend.toLocaleString()}/mo · {r.id}</div>
                    </div>
                  </div>

                  {/* Heatmap cells */}
                  {cols.map(c => {
                    const v = r.tags[c.key];
                    const applicable = c.applicableTypes ? c.applicableTypes.includes(r.type) : true;
                    const drift = c.key === "env" && v === "prod";
                    const isHover = hover && hover.rid === r.id && hover.key === c.key;
                    let state;
                    if (!applicable) state = "na";
                    else if (v == null && c.required) state = "missing-req";
                    else if (v == null) state = "missing-opt";
                    else if (drift) state = "drift";
                    else state = "ok";
                    return (
                      <div
                        key={c.key}
                        onMouseEnter={() => setHover({ rid: r.id, key: c.key, v, state, name: r.name })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          height: 32, margin: "1px 3px",
                          borderRadius: 4,
                          cursor: "pointer", position: "relative",
                          ...heatStyle(state, isHover),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                        title={v != null ? `${c.key}:${v}` : `${c.key} missing`}
                      >
                        {v != null && (
                          <span style={{
                            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", padding: "0 4px",
                            color: state === "drift" ? TAG.warn : heatTextColor(state),
                          }}>{v}</span>
                        )}
                        {state === "missing-req" && <Icon name="warn" size={10} color={TAG.danger} />}
                        {state === "missing-opt" && <span style={{ fontSize: 12, color: "#d4d2cd" }}>·</span>}
                        {state === "na" && <span style={{ fontSize: 9, color: "#cfcdc8" }}>n/a</span>}
                      </div>
                    );
                  })}

                  {/* Score col */}
                  <div style={{ ...hCell, padding: "6px 8px", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    {gaps > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: TAG.danger,
                        background: TAG.dangerBg, border: `1px solid #fecaca`,
                        borderRadius: 4, padding: "1px 5px",
                      }}>{gaps} miss</span>
                    )}
                    {drifts > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: TAG.warn,
                        background: TAG.warnBg, border: `1px solid #fde68a`,
                        borderRadius: 4, padding: "1px 5px",
                      }}>{drifts} drift</span>
                    )}
                    {gaps === 0 && drifts === 0 && (
                      <Icon name="check" size={11} color={TAG.success} />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* HOVER PEEK */}
          {hover && <HoverPeek hover={hover} />}
        </div>

        {/* BULK BAR */}
        {selected.size > 0 && (
          <div style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 18,
            display: "flex", alignItems: "center", gap: 8,
            background: "#1f2024", color: "#fff",
            padding: "7px 8px 7px 14px", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
            fontSize: 12, zIndex: 5,
          }}>
            <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 4px" }} />
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.08)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              fontSize: 11.5, fontWeight: 500, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit",
            }}>Fill all gaps with AI <Icon name="sparkle" size={11} color="#c4b5fd" /></button>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.08)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              fontSize: 11.5, fontWeight: 500, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit",
            }}>Bulk apply…</button>
            <button onClick={() => setSelected(new Set())} style={{
              background: "transparent", color: "#fff", border: "none",
              padding: "4px 6px", cursor: "pointer",
            }}>
              <Icon name="x" size={11} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function HoverPeek({ hover }) {
  const { state, key, v, name } = hover;
  let label, color;
  if (state === "ok") { label = `${key}:${v}`; color = TAG.success; }
  else if (state === "drift") { label = `drift · canonical is "production"`; color = TAG.warn; }
  else if (state === "missing-req") { label = `${key} required — pick a value`; color = TAG.danger; }
  else if (state === "missing-opt") { label = `${key} not set`; color = TAG.muted; }
  else if (state === "na") { label = `${key} not applicable to this type`; color = TAG.muted; }
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "rgba(31,32,36,0.96)", color: "#fff",
      padding: "8px 12px", borderRadius: 8, fontSize: 11.5,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8,
      fontFamily: "'JetBrains Mono', monospace",
      pointerEvents: "none", zIndex: 20,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      <span>{name}</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{label}</span>
    </div>
  );
}

function Legend() {
  const Item = ({ swatch, label }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: TAG.muted }}>
      {swatch}{label}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "inherit" }}>
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#ecfdf5", border: "1px solid #d1fae5" }} />} label="Set" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fef2f2", border: "1px dashed #fecaca" }} />} label="Required missing" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fffbeb", border: "1px solid #fde68a" }} />} label="Drift" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fafaf9", border: "1px solid #ececea" }} />} label="Optional empty" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "transparent", border: "1px solid #ececea", opacity: 0.5 }} />} label="N/A" />
    </div>
  );
}

function KpiH({ label, value, sub, tone }) {
  const color = tone === "danger" ? TAG.danger : tone === "warn" ? TAG.warn : TAG.text;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: TAG.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

function SegBtn({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${TAG.border}`, borderRadius: 6, background: "#fff", overflow: "hidden", fontFamily: "inherit" }}>
      {options.map(([v, l], i) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: "3px 9px", fontSize: 11, fontWeight: 500,
          border: "none", background: value === v ? TAG.text : "transparent",
          color: value === v ? "#fff" : TAG.text2, cursor: "pointer", fontFamily: "inherit",
          borderRight: i < options.length-1 ? `1px solid ${TAG.border}` : "none",
        }}>{l}</button>
      ))}
    </div>
  );
}

function SmallSelectH({ label, value, options, onChange }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: TAG.muted }}>
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        border: `1px solid ${TAG.border}`, borderRadius: 5,
        padding: "3px 6px", fontSize: 11, color: TAG.text2,
        background: "#fff", fontFamily: "inherit",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

// ---------- Heatmap cell style + text color ----------
function heatStyle(state, hover) {
  const ring = hover ? `0 0 0 1.5px ${TAG.text}` : "none";
  if (state === "ok")          return { background: "#ecfdf5", border: "1px solid #d1fae5", boxShadow: ring };
  if (state === "drift")       return { background: "#fffbeb", border: "1px solid #fde68a", boxShadow: ring };
  if (state === "missing-req") return { background: "#fef2f2", border: "1px dashed #fecaca", boxShadow: ring };
  if (state === "missing-opt") return { background: "#fafaf9", border: `1px solid ${TAG.border}`, boxShadow: ring };
  if (state === "na")          return { background: "transparent", border: `1px solid ${TAG.border}`, opacity: 0.5, boxShadow: ring };
  return {};
}
function heatTextColor(state) {
  if (state === "ok") return "#047857";
  if (state === "drift") return TAG.warn;
  return TAG.muted;
}

const hHead = {
  padding: "8px 0 10px 0",
  borderBottom: `1px solid ${TAG.border}`,
  position: "sticky", top: 0, background: "#fff", zIndex: 2,
};
const hCell = {
  borderBottom: `1px solid #f4f3ef`,
};

Object.assign(window, { GridHeatmap });
