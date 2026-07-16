// tags-grid-expand.jsx — Direction A3: inline row expand
// Compact resource list. Click a row → it expands inline to show ALL tags
// with edit chips. Multiple rows can be open. No side panel, no modal.
// Bulk bar still works for selection. The "I want to fix THIS resource" task
// gets dramatically faster — one keystroke from list to edit.
const { useState: useStateE } = React;

function GridInlineExpand({ tweaks = {} }) {
  const [selected, setSelected] = useStateE(new Set());
  const [expanded, setExpanded] = useStateE(new Set(["r-008", "r-031"])); // 2 pre-open for demo
  const [overrides, setOverrides] = useStateE({});
  const [filter, setFilter] = useStateE("issues"); // all | issues | mine

  const cols = TAG_KEYS.slice(0, 6);
  const allCols = TAG_KEYS;
  const rowsAll = RESOURCES;
  const rows = filter === "issues"
    ? rowsAll.filter(r => cols.some(c => c.required && (overrides[r.id]?.[c.key] ?? r.tags[c.key]) == null) || r.tags.env === "prod")
    : rowsAll;

  const tagsOf = (r) => ({ ...r.tags, ...(overrides[r.id] || {}) });

  const totalGaps = rowsAll.reduce((a, r) => a + cols.filter(c => c.required && tagsOf(r)[c.key] == null).length, 0);

  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AppShell crumb="Tags / Resources · inline" actions={
      <>
        <Btn icon="grid">Switch to grid</Btn>
        <Btn icon="filter">Saved views</Btn>
      </>
    }>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* HEADER */}
        <div style={{ padding: "20px 28px 14px", background: "#fdfdfc", borderBottom: `1px solid ${TAG.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Resources</h1>
              <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                {rows.length} shown · <b style={{ color: totalGaps ? TAG.danger : TAG.success }}>{totalGaps} required gaps</b> · click a row to edit tags inline
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <SegBtnE options={[["issues","Needs attention"],["mine","Mine"],["all","All resources"]]} value={filter} onChange={setFilter} />
            </div>
          </div>

          {/* Tab summary row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: TAG.muted }}>
            <span><span style={{ color: TAG.danger, fontWeight: 600 }}>•</span> 9 missing required</span>
            <span><span style={{ color: TAG.warn, fontWeight: 600 }}>•</span> 1 drift</span>
            <span><span style={{ color: TAG.xMuted, fontWeight: 600 }}>•</span> 1 untagged</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: TAG.xMuted }}>{expanded.size} row{expanded.size===1?"":"s"} expanded</span>
            <button onClick={() => setExpanded(new Set())} style={{
              border: "none", background: "transparent", color: TAG.muted,
              fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit",
            }}>Collapse all</button>
          </div>
        </div>

        {/* LIST */}
        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          {rows.map((r, ri) => {
            const isExp = expanded.has(r.id);
            const isSel = selected.has(r.id);
            const tags = tagsOf(r);
            const gaps = cols.filter(c => c.required && tags[c.key] == null).length;
            const hasDrift = tags.env === "prod";
            return (
              <div key={r.id} style={{
                background: isExp ? "#fdfcfa" : (isSel ? "#f5f8ff" : "#fff"),
                borderBottom: `1px solid ${TAG.border}`,
              }}>
                {/* Row header */}
                <div
                  onClick={() => toggleExpand(r.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 28px",
                    cursor: "pointer",
                  }}>
                  <input type="checkbox" checked={isSel} onClick={e => e.stopPropagation()} onChange={() => toggleSel(r.id)} />
                  <Icon name={isExp ? "chevron" : "chevronR"} size={12} color={TAG.muted} />
                  <TypeChip t={r.type} />
                  <div style={{ minWidth: 0, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TAG.text }}>{r.name}</div>
                    <div style={{ fontSize: 10.5, color: TAG.xMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r.id}</div>
                  </div>

                  {/* tag preview chips (collapsed state) */}
                  {!isExp && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", paddingLeft: 8 }}>
                      {cols.slice(0, 4).map(c => {
                        const v = tags[c.key];
                        const drift = c.key === "env" && v === "prod";
                        if (v == null && !c.required) return null;
                        return v != null
                          ? <TagPill key={c.key} k={c.key} v={v} drift={drift} size={10} />
                          : <TagPill key={c.key} k={c.key} v="" missing size={10} />;
                      })}
                      {Object.keys(tags).filter(k => !cols.slice(0, 4).map(c=>c.key).includes(k)).length > 0 && (
                        <span style={{ fontSize: 10.5, color: TAG.xMuted }}>+{Object.keys(tags).filter(k => !cols.slice(0, 4).map(c=>c.key).includes(k)).length}</span>
                      )}
                    </div>
                  )}
                  {isExp && <div style={{ flex: 1 }} />}

                  {/* indicators */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {gaps > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: TAG.danger,
                        background: TAG.dangerBg, border: `1px solid #fecaca`,
                        borderRadius: 999, padding: "1px 7px",
                      }}>{gaps} missing</span>
                    )}
                    {hasDrift && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: TAG.warn,
                        background: TAG.warnBg, border: `1px solid #fde68a`,
                        borderRadius: 999, padding: "1px 7px",
                      }}>drift</span>
                    )}
                    <span style={{ fontSize: 11, color: TAG.muted, fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>${r.spend.toLocaleString()}/mo</span>
                  </div>
                </div>

                {/* Expanded body */}
                {isExp && (
                  <div style={{
                    padding: "4px 28px 18px 76px",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
                  }}>
                    {/* Left: tag list */}
                    <div>
                      <div style={{ fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontWeight: 600 }}>
                        Tags · {Object.keys(tags).length} set, {allCols.length - Object.keys(tags).length} unset
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {allCols.map(c => {
                          const v = tags[c.key];
                          const isDrift = c.key === "env" && v === "prod";
                          return (
                            <TagEditChipRow
                              key={c.key} keyDef={c} value={v}
                              drift={isDrift}
                              onPick={(val) => setOverrides(o => ({ ...o, [r.id]: { ...(o[r.id] || {}), [c.key]: val } }))}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: context + AI */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {gaps > 0 && (
                        <div style={{
                          background: TAG.aiBg, border: `1px solid #e0e7ff`,
                          borderRadius: 8, padding: "10px 12px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <Icon name="sparkle" size={11} color={TAG.ai2} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: TAG.ai2 }}>Numio suggests</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: TAG.text2, lineHeight: 1.5, marginBottom: 8 }}>
                            Based on peer resources in this project:
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {cols.filter(c => c.required && tags[c.key] == null).map(c => {
                              // pick first peer value
                              const peerVal = c.values[0];
                              return (
                                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                                  <TagKeyPill k={c.key} size={10} />
                                  <Icon name="arrow" size={9} color={TAG.muted} />
                                  <TagPill k="" v={peerVal} size={10} />
                                  <button onClick={() => setOverrides(o => ({ ...o, [r.id]: { ...(o[r.id] || {}), [c.key]: peerVal } }))} style={miniAcceptE}>
                                    <Icon name="check" size={9} color={TAG.ai2} /> accept
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <Btn ai style={{ padding: "3px 8px", fontSize: 11 }}>Accept all</Btn>
                            <Btn ghost style={{ padding: "3px 8px", fontSize: 11, color: TAG.muted }}>Refine</Btn>
                          </div>
                        </div>
                      )}

                      <div style={{ border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontWeight: 600 }}>Resource</div>
                        <div style={{ fontSize: 11.5, color: TAG.text2, lineHeight: 1.7 }}>
                          <Row label="Region"><Mono style={{ fontSize: 11 }}>us-east-1</Mono></Row>
                          <Row label="Created"><span style={{ fontSize: 11 }}>Apr 18, 2026</span></Row>
                          <Row label="Spend"><span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>${r.spend.toLocaleString()}/mo</span></Row>
                          <Row label="Source"><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TAG.muted }}>{r.id}</span></Row>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
            <button style={bulkBtnE}>Expand all</button>
            <button style={bulkBtnE}>Bulk apply…</button>
            <button onClick={() => setSelected(new Set())} style={{ ...bulkBtnE, background: "transparent" }}>
              <Icon name="x" size={11} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TagEditChipRow({ keyDef, value, drift, onPick }) {
  const [open, setOpen] = useStateE(false);
  const missing = value == null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 8px",
      borderRadius: 6,
      background: missing && keyDef.required ? TAG.dangerBg : drift ? TAG.warnBg : "transparent",
      border: missing && keyDef.required ? `1px solid #fecaca` : drift ? `1px solid #fde68a` : `1px solid transparent`,
    }}>
      <TagKeyPill k={keyDef.key} size={11} style={{ minWidth: 88, justifyContent: "flex-start", flexShrink: 0 }} />
      {keyDef.required && <span style={{
        fontSize: 9, fontWeight: 700, color: missing ? TAG.danger : TAG.muted,
        background: missing ? "#fff" : "transparent",
        border: `1px solid ${missing ? "#fecaca" : TAG.border}`,
        padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em",
      }}>REQ</span>}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {value != null ? (
          <TagPill k="" v={value} drift={drift} size={11} />
        ) : missing && keyDef.required ? (
          <span style={{ fontSize: 11, color: TAG.danger, fontStyle: "italic" }}>required</span>
        ) : (
          <span style={{ fontSize: 11, color: TAG.xMuted, fontStyle: "italic" }}>not set</span>
        )}
      </div>
      {open ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end", maxWidth: 280 }}>
          {keyDef.values.slice(0, 6).map(v => (
            <button key={v} onClick={() => { onPick(v); setOpen(false); }} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
              padding: "2px 6px", borderRadius: 4,
              background: v === value ? TAG.text : "#fff",
              color: v === value ? "#fff" : TAG.text2,
              border: `1px solid ${v === value ? TAG.text : TAG.border}`,
              cursor: "pointer",
            }}>{v}</button>
          ))}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 10.5, color: missing && keyDef.required ? TAG.danger : TAG.muted,
          background: "transparent", border: "none",
          padding: "2px 6px", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          <Icon name="edit" size={10} color="currentColor" />
          {missing ? "set" : "edit"}
        </button>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <span style={{ width: 60, fontSize: 11, color: TAG.muted, flexShrink: 0 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function SegBtnE({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${TAG.border}`, borderRadius: 6, background: "#fff", overflow: "hidden", fontFamily: "inherit" }}>
      {options.map(([v, l], i) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: "4px 12px", fontSize: 11.5, fontWeight: 500,
          border: "none", background: value === v ? TAG.text : "transparent",
          color: value === v ? "#fff" : TAG.text2, cursor: "pointer", fontFamily: "inherit",
          borderRight: i < options.length-1 ? `1px solid ${TAG.border}` : "none",
        }}>{l}</button>
      ))}
    </div>
  );
}

const miniAcceptE = {
  display: "inline-flex", alignItems: "center", gap: 3,
  fontSize: 10, color: TAG.ai2, background: "#fff",
  border: `1px solid #e0e7ff`, borderRadius: 4,
  padding: "1px 6px", cursor: "pointer", fontFamily: "inherit",
};
const bulkBtnE = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: "4px 9px",
  cursor: "pointer", fontFamily: "inherit",
};

Object.assign(window, { GridInlineExpand });
