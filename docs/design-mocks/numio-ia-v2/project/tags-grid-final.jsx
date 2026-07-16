// tags-grid-final.jsx — The proposal
// A2 heatmap as the base, with two additions:
//   1) Click a row's resource cell → expands inline below (A3 pattern)
//      to show full tag editor with allowed-value chips + AI suggestions
//   2) Click any heatmap cell → opens a small floating popover to pick a
//      value for THAT one tag without expanding the row (fast path)
const { useState: useStateF } = React;

function GridFinal({ tweaks = {} }) {
  const [selected, setSelected] = useStateF(new Set());
  const [expanded, setExpanded] = useStateF(new Set(["r-008"])); // demo: one open
  const [editing, setEditing] = useStateF(null); // {rid, key}
  const [overrides, setOverrides] = useStateF({});
  const [hover, setHover] = useStateF(null);
  const [keyFilter, setKeyFilter] = useStateF("all");
  const [sortBy, setSortBy] = useStateF("gaps");

  const cols = TAG_KEYS;
  const rowsRaw = RESOURCES;

  const tagsOf = (r) => ({ ...r.tags, ...(overrides[r.id] || {}) });
  const stateOf = (r, c) => {
    const v = tagsOf(r)[c.key];
    const applicable = c.applicableTypes ? c.applicableTypes.includes(r.type) : true;
    if (!applicable) return { state: "na", v };
    const drift = c.key === "env" && v === "prod";
    if (v == null && c.required) return { state: "missing-req", v };
    if (v == null) return { state: "missing-opt", v };
    if (drift) return { state: "drift", v };
    return { state: "ok", v };
  };

  const scored = rowsRaw.map(r => {
    const gaps = cols.filter(c => c.required && tagsOf(r)[c.key] == null).length;
    const drifts = cols.filter(c => stateOf(r, c).state === "drift").length;
    return { r, gaps, drifts };
  });
  const rows = [...scored].sort((a, b) =>
    sortBy === "gaps"  ? (b.gaps - a.gaps) || (b.r.spend - a.r.spend) :
    sortBy === "spend" ? (b.r.spend - a.r.spend) :
                         a.r.name.localeCompare(b.r.name)
  );

  const colStats = cols.map(c => {
    const total = rowsRaw.length;
    const filled = rowsRaw.filter(r => tagsOf(r)[c.key] != null).length;
    return { ...c, filled, total };
  });

  const totalCells = rowsRaw.length * cols.filter(c => c.required).length;
  const filledCells = rowsRaw.reduce((acc, r) => acc + cols.filter(c => c.required && tagsOf(r)[c.key] != null).length, 0);

  const setTag = (rid, key, val) => setOverrides(o => ({ ...o, [rid]: { ...(o[rid] || {}), [key]: val } }));
  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AppShell crumb="Tags / Health scan" actions={
      <>
        <Btn icon="list">Switch to table</Btn>
        <Btn primary icon="sparkle">Auto-fill plan</Btn>
      </>
    }>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }} onClick={() => setEditing(null)}>

        {/* HEADER STRIP */}
        <div style={{ padding: "20px 28px 14px", background: "#fdfdfc", borderBottom: `1px solid ${TAG.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Tag health scan</h1>
              <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                {rowsRaw.length} resources across {cols.length} tag keys · click a row to edit all tags · click any cell to set one
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <KpiF label="Required coverage" value={`${Math.round(filledCells/totalCells*100)}%`} tone="warn" />
            <KpiF label="Resources with gaps" value={scored.filter(s => s.gaps > 0).length} sub={`of ${rowsRaw.length}`} />
            <KpiF label="Drift incidents" value={scored.reduce((a,s)=>a+s.drifts, 0)} tone="warn" />
            <KpiF label="At-risk spend" value="$11.3k" sub="/mo" tone="danger" />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Legend />
            <div style={{ flex: 1 }} />
            <SegBtnF options={[["all","All"],["missing-required","Required missing"],["drift","Drift"]]} value={keyFilter} onChange={setKeyFilter} />
            <SmallSelectF label="Sort" value={sortBy} options={[["gaps","Most gaps"],["spend","Spend"],["name","Name"]]} onChange={setSortBy} />
            {expanded.size > 0 && (
              <button onClick={() => setExpanded(new Set())} style={{
                border: "none", background: "transparent", color: TAG.muted,
                fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0,
              }}>Collapse all ({expanded.size})</button>
            )}
          </div>
        </div>

        {/* HEATMAP */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 28px 24px", background: "#fff" }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `340px repeat(${cols.length}, 84px) 1fr`,
            rowGap: 0, columnGap: 0,
            fontFamily: "inherit",
          }}>
            {/* === HEADER ROW === */}
            <div style={hHeadF}><span style={hHeadLabel}>Resource</span></div>
            {colStats.map(c => (
              <div key={c.key} style={hHeadF}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <TagKeyPill k={c.key} size={10} style={{ fontSize: 10, padding: "1px 5px" }} />
                    {c.required && <span title="required" style={{ width: 4, height: 4, borderRadius: 2, background: TAG.danger }} />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      fontSize: 10, fontVariantNumeric: "tabular-nums", fontWeight: 600,
                      color: c.filled/c.total >= 0.85 ? TAG.success : c.filled/c.total >= 0.6 ? TAG.warn : TAG.danger,
                    }}>{Math.round(c.filled/c.total*100)}%</span>
                    <div style={{ flex: 1, height: 2, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
                      <div style={{
                        width: `${c.filled/c.total*100}%`, height: "100%",
                        background: c.filled/c.total >= 0.85 ? TAG.success : c.filled/c.total >= 0.6 ? TAG.warn : TAG.danger,
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={hHeadF}><span style={hHeadLabel}>Score</span></div>

            {/* === ROWS === */}
            {rows.map(({ r, gaps, drifts }) => {
              const isSel = selected.has(r.id);
              const isExp = expanded.has(r.id);
              return (
                <React.Fragment key={r.id}>

                  {/* Resource cell */}
                  <div
                    style={{
                      ...hCellF,
                      padding: "6px 8px 6px 10px",
                      background: isExp ? "#fdfcfa" : isSel ? "#f5f8ff" : "transparent",
                      borderLeft: `2px solid ${gaps > 1 ? TAG.danger : gaps === 1 ? TAG.warn : "transparent"}`,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                    onClick={() => toggleExpand(r.id)}>
                    <input type="checkbox" checked={isSel}
                      onChange={() => toggleSel(r.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Icon name={isExp ? "chevron" : "chevronR"} size={11} color={TAG.muted} />
                    <TypeChip t={r.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: TAG.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: TAG.xMuted, fontVariantNumeric: "tabular-nums" }}>
                        ${r.spend.toLocaleString()}/mo · {r.id}
                      </div>
                    </div>
                  </div>

                  {/* Heatmap cells */}
                  {cols.map(c => {
                    const { state, v } = stateOf(r, c);
                    const isHover = hover && hover.rid === r.id && hover.key === c.key;
                    const isEditing = editing && editing.rid === r.id && editing.key === c.key;
                    return (
                      <div key={c.key} style={{
                        ...hCellF,
                        padding: 0,
                        background: isExp ? "#fdfcfa" : "transparent",
                        position: "relative",
                      }}>
                        <div
                          onMouseEnter={() => setHover({ rid: r.id, key: c.key, v, state, name: r.name })}
                          onMouseLeave={() => setHover(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (state === "na") return;
                            setEditing(isEditing ? null : { rid: r.id, key: c.key });
                          }}
                          style={{
                            height: 32, margin: "5px 3px",
                            borderRadius: 4,
                            cursor: state === "na" ? "default" : "pointer",
                            ...heatStyleF(state, isHover || isEditing),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, fontWeight: 500,
                          }}>
                          {v != null && (
                            <span style={{
                              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap", padding: "0 4px",
                              color: state === "drift" ? TAG.warn : heatTextColorF(state),
                            }}>{v}</span>
                          )}
                          {state === "missing-req" && <Icon name="warn" size={10} color={TAG.danger} />}
                          {state === "missing-opt" && <span style={{ fontSize: 12, color: "#d4d2cd" }}>·</span>}
                          {state === "na" && <span style={{ fontSize: 9, color: "#cfcdc8" }}>n/a</span>}
                        </div>
                        {isEditing && (
                          <CellPopover
                            keyDef={c} value={v} state={state}
                            onPick={(picked) => { setTag(r.id, c.key, picked); setEditing(null); }}
                            onClear={() => { setTag(r.id, c.key, undefined); setEditing(null); }}
                            onClose={() => setEditing(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Score */}
                  <div style={{
                    ...hCellF, padding: "6px 8px",
                    background: isExp ? "#fdfcfa" : "transparent",
                    display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end",
                  }}>
                    {gaps > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: TAG.danger, background: TAG.dangerBg, border: `1px solid #fecaca`, borderRadius: 4, padding: "1px 5px" }}>{gaps} miss</span>
                    )}
                    {drifts > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: TAG.warn, background: TAG.warnBg, border: `1px solid #fde68a`, borderRadius: 4, padding: "1px 5px" }}>{drifts} drift</span>
                    )}
                    {gaps === 0 && drifts === 0 && <Icon name="check" size={11} color={TAG.success} />}
                  </div>

                  {/* === EXPANDED BODY (spans all cols) === */}
                  {isExp && (
                    <div style={{
                      gridColumn: "1 / -1",
                      padding: "8px 16px 18px 64px",
                      background: "#fdfcfa",
                      borderBottom: `1px solid ${TAG.border}`,
                    }}>
                      <ExpandedBody r={r} cols={cols} tags={tagsOf(r)} stateOf={stateOf} onSetTag={(k, v) => setTag(r.id, k, v)} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {hover && !editing && <HoverPeek hover={hover} />}
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
            <button style={bulkBtnF}>Fill all gaps with AI <Icon name="sparkle" size={11} color="#c4b5fd" /></button>
            <button style={bulkBtnF}>Bulk apply…</button>
            <button style={bulkBtnF}>Expand all</button>
            <button onClick={(e) => { e.stopPropagation(); setSelected(new Set()); }} style={{
              background: "transparent", color: "#fff", border: "none", padding: "4px 6px", cursor: "pointer",
            }}>
              <Icon name="x" size={11} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ============================================================
// EXPANDED ROW BODY
// ============================================================
function ExpandedBody({ r, cols, tags, stateOf, onSetTag }) {
  const missing = cols.filter(c => c.required && stateOf(r, c).state === "missing-req");
  const driftCells = cols.filter(c => stateOf(r, c).state === "drift");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>

      {/* LEFT — tag editor list */}
      <div>
        <SectionLabelF>Edit tags · {Object.keys(tags).length}/{cols.length} set</SectionLabelF>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {cols.map(c => (
            <TagEditChip key={c.key} keyDef={c} value={tags[c.key]}
              state={stateOf(r, c).state}
              onPick={(v) => onSetTag(c.key, v)}
              onClear={() => onSetTag(c.key, undefined)} />
          ))}
        </div>
      </div>

      {/* RIGHT — AI + context */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(missing.length > 0 || driftCells.length > 0) && (
          <div style={{
            background: TAG.aiBg, border: `1px solid #e0e7ff`,
            borderRadius: 8, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Icon name="sparkle" size={11} color={TAG.ai2} />
              <span style={{ fontSize: 11, fontWeight: 600, color: TAG.ai2 }}>Numio suggests</span>
            </div>
            <div style={{ fontSize: 11.5, color: TAG.text2, lineHeight: 1.5, marginBottom: 10 }}>
              Inferred from peer resources in this project:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {missing.map(c => {
                const v = c.values[0]; // demo: first allowed
                return (
                  <SuggestRow key={c.key} keyDef={c} v={v} kind="fill"
                    onAccept={() => onSetTag(c.key, v)} />
                );
              })}
              {driftCells.map(c => (
                <SuggestRow key={c.key + "-drift"} keyDef={c} v="production" old="prod" kind="drift"
                  onAccept={() => onSetTag(c.key, "production")} />
              ))}
            </div>
            {missing.length + driftCells.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <Btn ai style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => {
                  missing.forEach(c => onSetTag(c.key, c.values[0]));
                  driftCells.forEach(c => onSetTag(c.key, "production"));
                }}>Accept all</Btn>
                <Btn ghost style={{ padding: "3px 8px", fontSize: 11, color: TAG.muted }}>Refine</Btn>
              </div>
            )}
          </div>
        )}

        <div style={{ border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "10px 12px", background: "#fff" }}>
          <SectionLabelF>Resource</SectionLabelF>
          <div style={{ fontSize: 11.5, color: TAG.text2, lineHeight: 1.7 }}>
            <RowF label="Region"><Mono style={{ fontSize: 11 }}>us-east-1</Mono></RowF>
            <RowF label="Created"><span style={{ fontSize: 11 }}>Apr 18, 2026</span></RowF>
            <RowF label="Spend"><span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>${r.spend.toLocaleString()}/mo</span></RowF>
            <RowF label="Source"><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TAG.muted }}>{r.id}</span></RowF>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Btn style={{ flex: 1, justifyContent: "center", fontSize: 11.5 }}>Open in full editor</Btn>
          <Btn ghost style={{ color: TAG.muted, fontSize: 11.5 }}>Activity</Btn>
        </div>
      </div>
    </div>
  );
}

function SuggestRow({ keyDef, v, old, kind, onAccept }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
      <TagKeyPill k={keyDef.key} size={10} style={{ minWidth: 78, justifyContent: "flex-start", flexShrink: 0 }} />
      {kind === "drift" ? (
        <>
          <TagPill k="" v={old} size={10} style={{ opacity: 0.6, textDecoration: "line-through" }} />
          <Icon name="arrow" size={9} color={TAG.muted} />
          <TagPill k="" v={v} size={10} />
        </>
      ) : (
        <>
          <Icon name="arrow" size={9} color={TAG.muted} />
          <TagPill k="" v={v} size={10} />
        </>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onAccept} style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10, color: TAG.ai2, background: "#fff",
        border: `1px solid #e0e7ff`, borderRadius: 4,
        padding: "1px 6px", cursor: "pointer", fontFamily: "inherit",
      }}>
        <Icon name="check" size={9} color={TAG.ai2} /> accept
      </button>
    </div>
  );
}

// ============================================================
// TAG EDIT CHIP (in expanded body)
// ============================================================
function TagEditChip({ keyDef, value, state, onPick, onClear }) {
  const [open, setOpen] = useStateF(false);
  const missing = value == null;
  const isReqMiss = state === "missing-req";
  const isDrift = state === "drift";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 10px",
      borderRadius: 6,
      background: isReqMiss ? "#fff" : isDrift ? "#fff8e6" : "#fff",
      border: `1px solid ${isReqMiss ? "#fecaca" : isDrift ? "#fde68a" : TAG.border}`,
    }}>
      <TagKeyPill k={keyDef.key} size={11} style={{ minWidth: 100, justifyContent: "flex-start", flexShrink: 0 }} />
      {keyDef.required && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: missing ? TAG.danger : TAG.muted,
          background: missing ? "#fff" : "transparent",
          border: `1px solid ${missing ? "#fecaca" : TAG.border}`,
          padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em",
        }}>REQ</span>
      )}

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {value != null ? (
          <TagPill k="" v={value} drift={isDrift} size={11} />
        ) : isReqMiss ? (
          <span style={{ fontSize: 11, color: TAG.danger, fontStyle: "italic" }}>required — pick a value</span>
        ) : (
          <span style={{ fontSize: 11, color: TAG.xMuted, fontStyle: "italic" }}>not set</span>
        )}
        {isDrift && (
          <span style={{ fontSize: 10.5, color: TAG.warn, marginLeft: 4 }}>
            drift · canonical <Mono style={{ background: "#fff", padding: "0 3px", borderRadius: 2, fontSize: 10 }}>production</Mono>
          </span>
        )}
      </div>

      {open ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end", maxWidth: 360 }}>
          {keyDef.values.map(v => (
            <button key={v} onClick={() => { onPick(v); setOpen(false); }} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
              padding: "2px 6px", borderRadius: 4,
              background: v === value ? TAG.text : "#fff",
              color: v === value ? "#fff" : TAG.text2,
              border: `1px solid ${v === value ? TAG.text : TAG.border}`,
              cursor: "pointer",
            }}>{v}</button>
          ))}
          {value != null && (
            <button onClick={() => { onClear(); setOpen(false); }} style={{
              fontSize: 10, color: TAG.muted, background: "#fff",
              border: `1px solid ${TAG.border}`, borderRadius: 4,
              padding: "2px 6px", cursor: "pointer", fontFamily: "inherit",
            }}>clear</button>
          )}
          <button onClick={() => setOpen(false)} style={{
            fontSize: 10, color: TAG.muted, background: "transparent",
            border: "none", padding: "2px 4px", cursor: "pointer", fontFamily: "inherit",
          }}>cancel</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 10.5, color: isReqMiss ? TAG.danger : TAG.muted,
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

// ============================================================
// CELL POPOVER (quick single-tag edit, anchored to heatmap cell)
// ============================================================
function CellPopover({ keyDef, value, state, onPick, onClear, onClose }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
      marginTop: 4, zIndex: 30, width: 220,
      background: "#fff", border: `1px solid ${TAG.borderStrong}`, borderRadius: 8,
      boxShadow: "0 14px 36px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.02)",
      padding: 4,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 6px 7px 6px", borderBottom: `1px solid ${TAG.border}`,
      }}>
        <TagKeyPill k={keyDef.key} size={10} />
        {keyDef.required && <span style={{
          fontSize: 9, fontWeight: 700, color: TAG.danger, background: "#fff",
          border: `1px solid #fecaca`, padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em",
        }}>REQ</span>}
        <span style={{ fontSize: 10, color: TAG.muted }}>{keyDef.values.length} values</span>
        <div style={{ flex: 1 }} />
        <Icon name="x" size={10} color={TAG.muted} style={{ cursor: "pointer" }} onClick={onClose} />
      </div>
      {state === "drift" && (
        <div style={{
          padding: "6px 8px", borderBottom: `1px solid ${TAG.border}`,
          background: TAG.warnBg,
          fontSize: 10.5, color: TAG.warn, display: "flex", alignItems: "center", gap: 5,
        }}>
          <Icon name="warn" size={10} color={TAG.warn} />
          drift — canonical is <Mono style={{ fontSize: 10, background: "#fff", padding: "0 3px", borderRadius: 2 }}>production</Mono>
        </div>
      )}
      <input autoFocus placeholder="Filter or type new value…" style={{
        width: "100%", height: 26, border: "none", outline: "none",
        padding: "0 8px", background: "transparent",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        borderBottom: `1px solid ${TAG.border}`,
      }} />
      <div style={{ maxHeight: 180, overflow: "auto", padding: "3px 0" }}>
        {keyDef.values.map(v => (
          <button key={v} onClick={() => onPick(v)} style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "4px 8px", border: "none",
            background: v === value ? "#f3f4f6" : "transparent",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <TagPill k="" v={v} size={11} />
            {v === value && <Icon name="check" size={10} color={TAG.success} style={{ marginLeft: "auto" }} />}
          </button>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 4, padding: "4px 4px 2px 4px",
        borderTop: `1px solid ${TAG.border}`,
      }}>
        <button style={popMini}><Icon name="plus" size={9} color={TAG.muted} /> new</button>
        {value != null && <button style={popMini} onClick={onClear}>clear</button>}
        <button style={{ ...popMini, color: TAG.ai2 }}>
          <Icon name="sparkle" size={9} color={TAG.ai2} /> suggest
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED BITS
// ============================================================
function HoverPeek({ hover }) {
  const { state, key, v, name } = hover;
  let label, color;
  if (state === "ok") { label = `${key}:${v}`; color = TAG.success; }
  else if (state === "drift") { label = `drift · canonical is "production"`; color = TAG.warn; }
  else if (state === "missing-req") { label = `${key} required — click to pick a value`; color = TAG.danger; }
  else if (state === "missing-opt") { label = `${key} not set — click to add`; color = TAG.muted; }
  else if (state === "na") { label = `${key} not applicable to this resource type`; color = TAG.muted; }
  return (
    <div style={{
      position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
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
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#ecfdf5", border: "1px solid #d1fae5" }} />} label="Set" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fef2f2", border: "1px dashed #fecaca" }} />} label="Required missing" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fffbeb", border: "1px solid #fde68a" }} />} label="Drift" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#fafaf9", border: "1px solid #ececea" }} />} label="Optional empty" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "transparent", border: "1px solid #ececea", opacity: 0.5 }} />} label="N/A" />
    </div>
  );
}

function KpiF({ label, value, sub, tone }) {
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

function SegBtnF({ options, value, onChange }) {
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

function SmallSelectF({ label, value, options, onChange }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: TAG.muted }}>
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        border: `1px solid ${TAG.border}`, borderRadius: 5,
        padding: "3px 6px", fontSize: 11, color: TAG.text2, background: "#fff", fontFamily: "inherit",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function SectionLabelF({ children }) {
  return <div style={{ fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontWeight: 600 }}>{children}</div>;
}

function RowF({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <span style={{ width: 60, fontSize: 11, color: TAG.muted, flexShrink: 0 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function heatStyleF(state, hover) {
  const ring = hover ? `0 0 0 1.5px ${TAG.text}` : "none";
  if (state === "ok")          return { background: "#ecfdf5", border: "1px solid #d1fae5", boxShadow: ring };
  if (state === "drift")       return { background: "#fffbeb", border: "1px solid #fde68a", boxShadow: ring };
  if (state === "missing-req") return { background: "#fef2f2", border: "1px dashed #fecaca", boxShadow: ring };
  if (state === "missing-opt") return { background: "#fafaf9", border: `1px solid ${TAG.border}`, boxShadow: ring };
  if (state === "na")          return { background: "transparent", border: `1px solid ${TAG.border}`, opacity: 0.5, boxShadow: ring };
  return {};
}
function heatTextColorF(state) {
  if (state === "ok") return "#047857";
  if (state === "drift") return TAG.warn;
  return TAG.muted;
}

const hHeadF = {
  padding: "8px 0 10px 0",
  borderBottom: `1px solid ${TAG.border}`,
  position: "sticky", top: 0, background: "#fff", zIndex: 2,
};
const hHeadLabel = {
  fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em",
};
const hCellF = {
  borderBottom: `1px solid #f4f3ef`,
  minHeight: 42, display: "flex", alignItems: "center",
};
const bulkBtnF = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: "4px 9px",
  cursor: "pointer", fontFamily: "inherit",
};
const popMini = {
  flex: 1, fontSize: 10, color: TAG.muted,
  border: "none", background: "transparent",
  padding: "3px 4px", cursor: "pointer", fontFamily: "inherit",
  borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
};

Object.assign(window, { GridFinal });
