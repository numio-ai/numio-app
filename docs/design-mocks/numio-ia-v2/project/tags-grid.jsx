// tags-grid.jsx — Direction A: spreadsheet-style bulk tag editor
const { useState: useStateA, useMemo: useMemoA } = React;

function DirectionGrid({ tweaks = {} }) {
  const [selected, setSelected] = useStateA(new Set(["r-008", "r-011", "r-012", "r-030", "r-031", "r-037", "r-042"]));
  const [filterEnv, setFilterEnv] = useStateA("all");
  const [showPanel, setShowPanel] = useStateA(true);
  const [activeCell, setActiveCell] = useStateA(null); // {rid, key}

  const cols = TAG_KEYS.slice(0, 6); // env, team, cost-center, owner, project, service
  const rows = useMemoA(() => RESOURCES.filter(r => filterEnv === "all" || r.tags.env === filterEnv || (filterEnv==="production" && r.tags.env==="prod")), [filterEnv]);

  const toggle = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };

  // Coverage per column among visible rows
  const colCoverage = cols.map(c => {
    const n = rows.filter(r => r.tags[c.key] != null).length;
    return rows.length ? n / rows.length : 0;
  });

  const totalGaps = rows.reduce((acc, r) => acc + cols.filter(c => c.required && r.tags[c.key] == null).length, 0);

  const FilterChip = ({ label, value, active, onClick, kind = "default" }) => (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 500,
      border: `1px solid ${active ? TAG.text : TAG.border}`,
      background: active ? TAG.text : TAG.surface,
      color: active ? "#fff" : TAG.text2, cursor: "pointer",
      fontFamily: "inherit",
    }}>{label}{value != null && <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{value}</span>}</button>
  );

  return (
    <AppShell crumb="Tags / Resources" actions={
      <>
        <div style={{ position: "relative" }}>
          <Icon name="search" size={12} color={TAG.muted} style={{ position: "absolute", left: 8, top: 7 }} />
          <input placeholder="Search resources, tags, values…" style={{
            width: 280, height: 26, padding: "0 8px 0 26px",
            border: `1px solid ${TAG.border}`, borderRadius: 6,
            fontFamily: "inherit", fontSize: 12, color: TAG.text2, background: "#fff",
          }} />
        </div>
        <Btn icon="filter">Saved views</Btn>
        <Btn primary icon="plus">Apply tags</Btn>
      </>
    }>
      <div style={{ display: "flex", height: "100%" }}>
        {/* MAIN TABLE COLUMN */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* page header strip */}
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${TAG.border}`, background: "#fdfdfc" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>My resources</h1>
                <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                  {rows.length} resources · {totalGaps} required tags missing · last synced 2 min ago
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tag coverage</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <CoverageBar value={0.78} w={96} h={5} />
                    <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: TAG.warn }}>78%</span>
                  </div>
                </div>
              </div>
            </div>
            {/* filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Filter</span>
              <FilterChip label="All" value={RESOURCES.length} active={filterEnv === "all"} onClick={() => setFilterEnv("all")} />
              <FilterChip label="production" value={9} active={filterEnv === "production"} onClick={() => setFilterEnv("production")} />
              <FilterChip label="staging" value={5} active={filterEnv === "staging"} onClick={() => setFilterEnv("staging")} />
              <FilterChip label="dev" value={7} active={filterEnv === "dev"} onClick={() => setFilterEnv("dev")} />
              <div style={{ width: 1, height: 16, background: TAG.border, margin: "0 6px" }} />
              <FilterChip label="Missing required" value={9} active={false} onClick={() => {}} />
              <FilterChip label="Drift" value={1} active={false} onClick={() => {}} />
              <FilterChip label="Untagged" value={1} active={false} onClick={() => {}} />
              <div style={{ flex: 1 }} />
              <Btn ghost icon="download" style={{ color: TAG.muted }}>Export CSV</Btn>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 68 }} />
                <col style={{ width: 84 }} />
                {cols.map(c => <col key={c.key} />)}
              </colgroup>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={thA(36)}>
                    <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} />
                  </th>
                  <th style={thA()}>Resource</th>
                  <th style={thA()}>Type</th>
                  <th style={{ ...thA(), textAlign: "right" }}>Spend / mo</th>
                  {cols.map((c, i) => (
                    <th key={c.key} style={{ ...thA(), borderRight: i === cols.length - 1 ? "none" : `1px solid ${TAG.border}` }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <TagKeyPill k={c.key} size={11} />
                          {c.required && <span title="required" style={{ width: 5, height: 5, borderRadius: 3, background: TAG.danger }} />}
                          <Icon name="chevron" size={10} color={TAG.xMuted} style={{ marginLeft: "auto" }} />
                        </div>
                        <CoverageBar value={colCoverage[cols.indexOf(c)]} w={88} h={3} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => {
                  const isSel = selected.has(r.id);
                  return (
                    <tr key={r.id} style={{
                      background: isSel ? "#f5f8ff" : ri % 2 ? "#fafaf9" : "#fff",
                    }}>
                      <td style={tdA(true)}>
                        <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} />
                      </td>
                      <td style={tdA()}>
                        <div style={{ fontWeight: 500, fontSize: 12.5 }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: TAG.xMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r.id}</div>
                      </td>
                      <td style={tdA()}><TypeChip t={r.type} /></td>
                      <td style={{ ...tdA(), textAlign: "right", fontVariantNumeric: "tabular-nums", color: TAG.text2 }}>${r.spend.toLocaleString()}</td>
                      {cols.map((c, ci) => {
                        const v = r.tags[c.key];
                        const drift = c.key === "env" && v === "prod";
                        const active = activeCell && activeCell.rid === r.id && activeCell.key === c.key;
                        return (
                          <td key={c.key} style={{
                            ...tdA(),
                            borderRight: ci === cols.length - 1 ? "none" : `1px solid ${TAG.border}`,
                            cursor: "text",
                            boxShadow: active ? `inset 0 0 0 1.5px ${TAG.accent}` : "none",
                          }} onClick={() => setActiveCell({ rid: r.id, key: c.key })}>
                            {v != null ? (
                              <TagPill k={c.key} v={v} drift={drift} />
                            ) : (
                              c.required ? <TagPill k={c.key} v="" missing /> :
                              <span style={{ fontSize: 11, color: TAG.xMuted, fontStyle: "italic" }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BULK BAR */}
          {selected.size > 0 && (
            <div style={{
              position: "absolute", left: 220, right: showPanel ? 360 : 24, bottom: 24,
              display: "flex", alignItems: "center", gap: 10,
              background: "#1f2024", color: "#fff",
              padding: "8px 10px 8px 14px", borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
              fontSize: 12,
            }}>
              <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.8 }}>${rows.filter(r => selected.has(r.id)).reduce((a,b) => a+b.spend, 0).toLocaleString()}/mo</span>
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 6px" }} />
              <button style={bulkBtn}>Set tag…</button>
              <button style={bulkBtn}>Clear tag…</button>
              <button style={bulkBtn}>Open in detail</button>
              <button style={bulkBtn}>Suggest with AI <Icon name="sparkle" size={11} color="#c4b5fd" /></button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setSelected(new Set())} style={{ ...bulkBtn, background: "transparent" }}>
                <Icon name="x" size={11} color="#fff" />
              </button>
            </div>
          )}
        </div>

        {/* SIDE PANEL (Bulk apply) */}
        {showPanel && (
          <aside style={{
            width: 336, flexShrink: 0,
            borderLeft: `1px solid ${TAG.border}`,
            background: "#fdfdfc", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${TAG.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Apply tags</div>
              <span style={{ fontSize: 11, color: TAG.muted }}>to {selected.size || 0} resources</span>
              <div style={{ flex: 1 }} />
              <Icon name="x" size={12} color={TAG.muted} style={{ cursor: "pointer" }} onClick={() => setShowPanel(false)} />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "14px 18px 18px" }}>

              {/* AI suggestion banner */}
              <div style={{
                border: `1px solid ${TAG.aiBg}`, background: TAG.aiBg,
                borderRadius: 8, padding: "10px 12px", marginBottom: 14,
                position: "relative",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon name="sparkle" size={11} color={TAG.ai2} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: TAG.ai2, letterSpacing: "0.01em" }}>Suggestion from Numio</span>
                </div>
                <p style={{ fontSize: 12, color: TAG.text2, margin: "0 0 8px 0", lineHeight: 1.45 }}>
                  6 of your selection are dev/staging EC2 with no <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3, border: `1px solid ${TAG.border}` }}>cost-center</Mono>. Inferred from peer resources: <b>CC-ENG</b>.
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn ai style={{ padding: "3px 8px", fontSize: 11 }}>Accept &amp; preview</Btn>
                  <Btn ghost style={{ padding: "3px 8px", fontSize: 11, color: TAG.muted }}>Dismiss</Btn>
                </div>
              </div>

              {/* Form */}
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Tag key</FieldLabel>
                <div style={selectFieldA}>
                  <TagKeyPill k="cost-center" size={11} />
                  <span style={{ marginLeft: 8, fontSize: 11, color: TAG.muted }}>required · budget code</span>
                  <Icon name="chevron" size={11} color={TAG.muted} style={{ marginLeft: "auto" }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <FieldLabel>Value</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {["CC-ENG", "CC-ML", "CC-DATA", "CC-OPS"].map(v => (
                    <button key={v} style={{
                      ...selectFieldA, width: "auto", padding: "4px 9px",
                      background: v === "CC-ENG" ? TAG.accent : "#fff",
                      borderColor: v === "CC-ENG" ? TAG.accent : TAG.border,
                      color: v === "CC-ENG" ? "#fff" : TAG.text2,
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    }}>{v}</button>
                  ))}
                  <button style={{ ...selectFieldA, width: "auto", padding: "4px 9px", fontSize: 11, color: TAG.muted }}>+ New</button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <FieldLabel>Mode</FieldLabel>
                <div style={{ display: "flex", border: `1px solid ${TAG.border}`, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  {[["set","Set"],["fill","Fill empty only"],["clear","Clear"]].map(([k,l], i) => (
                    <button key={k} style={{
                      flex: 1, padding: "5px 6px", fontSize: 11, fontWeight: 500,
                      background: k === "fill" ? TAG.accentBg : "transparent",
                      color: k === "fill" ? TAG.accent : TAG.text2,
                      border: "none",
                      borderRight: i < 2 ? `1px solid ${TAG.border}` : "none",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <FieldLabel>Preview (7 resources)</FieldLabel>
              <div style={{
                border: `1px solid ${TAG.border}`, borderRadius: 8,
                background: "#fff", overflow: "hidden",
              }}>
                {RESOURCES.filter(r => selected.has(r.id)).slice(0, 7).map((r, i) => {
                  const has = r.tags["cost-center"];
                  return (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px",
                      borderTop: i ? `1px solid ${TAG.border}` : "none",
                      fontSize: 11.5,
                    }}>
                      <TypeChip t={r.type} />
                      <span style={{ flex: 1, color: TAG.text2 }}>{r.name}</span>
                      {has ? (
                        <TagPill k="cost-center" v={has} size={10} style={{ opacity: 0.5 }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 10, color: TAG.xMuted, fontStyle: "italic" }}>—</span>
                          <Icon name="arrow" size={10} color={TAG.muted} />
                          <TagPill k="cost-center" v="CC-ENG" size={10} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                <Btn primary style={{ flex: 1, justifyContent: "center", padding: "7px 12px", fontSize: 12.5 }}>Apply to {selected.size}</Btn>
                <Btn>Dry-run</Btn>
              </div>
              <p style={{ fontSize: 10.5, color: TAG.xMuted, margin: "10px 0 0 0", lineHeight: 1.5 }}>
                Tags will be written via cloud-native APIs. Numio audits every change; you can revert from the campaign history.
              </p>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}

const thA = (w) => ({
  fontSize: 10, fontWeight: 500, color: TAG.xMuted,
  textTransform: "uppercase", letterSpacing: "0.06em",
  textAlign: "left", padding: "8px 10px",
  borderBottom: `1px solid ${TAG.border}`,
  borderRight: `1px solid ${TAG.border}`,
  background: "#fafafa", position: "sticky", top: 0, zIndex: 1,
  ...(w ? { width: w } : {}),
});
const tdA = (narrow) => ({
  fontSize: 12, color: TAG.text, padding: narrow ? "6px 10px" : "7px 10px",
  borderBottom: `1px solid ${TAG.border}`,
  verticalAlign: "middle",
});
const bulkBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: "4px 9px",
  cursor: "pointer", fontFamily: "inherit",
};
const selectFieldA = {
  display: "flex", alignItems: "center", width: "100%",
  background: "#fff", border: `1px solid ${TAG.border}`,
  borderRadius: 6, padding: "5px 8px", fontFamily: "inherit",
};
function FieldLabel({ children }) {
  return <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 4 }}>{children}</div>;
}

Object.assign(window, { DirectionGrid });
