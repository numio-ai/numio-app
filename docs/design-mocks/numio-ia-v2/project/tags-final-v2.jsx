// tags-final-v2.jsx — Aligned with real Numio shell
// The content that goes INSIDE NumioShell. No app chrome — that's handled by
// NumioTopBar + NumioSidebar + NumioChatPanel from numio-shell.jsx.
//
// Inherits the heatmap + inline row-expand + cell popover pattern from
// tags-grid-final.jsx but uses Numio tokens (var(--border) #efefef,
// var(--accent) #2563eb, etc.) and lucide icons via LIcon.
const { useState: useStateV2 } = React;

const N = {
  border: "#efefef",
  borderStrong: "#e5e5e5",
  text: "#111827",
  text2: "#374151",
  muted: "#6b7280",
  xMuted: "#9ca3af",
  bg: "#f7f7f7",
  surface: "#ffffff",
  surfaceMuted: "#fafafa",
  accent: "#2563eb",
  accentBg: "#eff5ff",
  ai: "#6366f1",
  aiBg: "#eef2ff",
  ai2: "#4f46e5",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warn: "#d97706",
  warnBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
};

// ---------- TAG primitives (Numio-aligned) ----------

const TagKey = ({ k, size = 11, style }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    fontSize: size, color: N.text2, background: "#f3f0ff",
    border: "1px solid #e9e3ff", borderRadius: 4,
    padding: "1px 6px", lineHeight: 1.5, fontWeight: 500,
    ...style,
  }}>{k}</span>
);

const pillHues = [
  { bg: "#eff5ff", fg: "#1d4ed8", bd: "#dbeafe" },
  { bg: "#ecfdf5", fg: "#047857", bd: "#d1fae5" },
  { bg: "#fff7ed", fg: "#c2410c", bd: "#fed7aa" },
  { bg: "#fdf4ff", fg: "#a21caf", bd: "#f5d0fe" },
  { bg: "#f0f9ff", fg: "#0369a1", bd: "#bae6fd" },
  { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
];
function hueFor(v) {
  if (v == null) return pillHues[0];
  let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return pillHues[Math.abs(h) % pillHues.length];
}

const TagVal = ({ k, v, size = 11, missing, drift, style }) => {
  if (missing) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: "'JetBrains Mono', monospace", fontSize: size,
        color: N.danger, border: `1px dashed ${N.danger}55`,
        background: "transparent", borderRadius: 4,
        padding: "1px 6px", ...style,
      }}>
        <span style={{ opacity: 0.7 }}>{k}</span>
        <span style={{ opacity: 0.5 }}>:</span>
        <span style={{ fontStyle: "italic", opacity: 0.7 }}>missing</span>
      </span>
    );
  }
  const c = hueFor(v);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "'JetBrains Mono', monospace", fontSize: size,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
      borderRadius: 4, padding: "1px 6px", lineHeight: 1.5, ...style,
    }}>
      {k && <><span style={{ opacity: 0.6 }}>{k}</span><span style={{ opacity: 0.4, margin: "0 1px" }}>:</span></>}
      <span style={{ fontWeight: 500 }}>{v}</span>
      {drift && <span style={{ marginLeft: 5, width: 5, height: 5, borderRadius: 3, background: N.warn, display: "inline-block" }} />}
    </span>
  );
};

const TypeChip = ({ t }) => {
  const map = {
    EC2:   { bg: "#fff7ed", fg: "#c2410c" },
    RDS:   { bg: "#eef2ff", fg: "#4338ca" },
    S3:    { bg: "#ecfdf5", fg: "#047857" },
    Lambda:{ bg: "#fef9c3", fg: "#854d0e" },
    K8s:   { bg: "#f0f9ff", fg: "#0369a1" },
    GPU:   { bg: "#fdf4ff", fg: "#a21caf" },
  };
  const c = map[t] || { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      fontWeight: 600, letterSpacing: "0.04em",
      background: c.bg, color: c.fg, padding: "1px 6px",
      borderRadius: 3, textTransform: "uppercase",
    }}>{t}</span>
  );
};

// ============================================================
// THE MAIN GRID
// ============================================================
function TagGovernanceContent({ onOpenChat }) {
  const [selected, setSelected] = useStateV2(new Set());
  const [expanded, setExpanded] = useStateV2(new Set(["r-008"]));
  const [editing, setEditing] = useStateV2(null);
  const [overrides, setOverrides] = useStateV2({});
  const [hover, setHover] = useStateV2(null);
  const [keyFilter, setKeyFilter] = useStateV2("all");
  const [sortBy, setSortBy] = useStateV2("gaps");

  const cols = TAG_KEYS;
  const rowsRaw = RESOURCES;
  const tagsOf = (r) => ({ ...r.tags, ...(overrides[r.id] || {}) });
  const stateOf = (r, c) => {
    const v = tagsOf(r)[c.key];
    if (c.applicableTypes && !c.applicableTypes.includes(r.type)) return { state: "na", v };
    if (v === "prod" && c.key === "env") return { state: "drift", v };
    if (v == null && c.required) return { state: "missing-req", v };
    if (v == null) return { state: "missing-opt", v };
    return { state: "ok", v };
  };

  const scored = rowsRaw.map(r => ({
    r,
    gaps: cols.filter(c => c.required && tagsOf(r)[c.key] == null).length,
    drifts: cols.filter(c => stateOf(r, c).state === "drift").length,
  }));
  const rows = [...scored].sort((a, b) =>
    sortBy === "gaps"  ? (b.gaps - a.gaps) || (b.r.spend - a.r.spend) :
    sortBy === "spend" ? (b.r.spend - a.r.spend) :
                         a.r.name.localeCompare(b.r.name)
  );

  const colStats = cols.map(c => ({
    ...c, filled: rowsRaw.filter(r => tagsOf(r)[c.key] != null).length, total: rowsRaw.length,
  }));

  const totalCells = rowsRaw.length * cols.filter(c => c.required).length;
  const filledCells = rowsRaw.reduce((acc, r) => acc + cols.filter(c => c.required && tagsOf(r)[c.key] != null).length, 0);

  const setTag = (rid, key, val) => setOverrides(o => ({ ...o, [rid]: { ...(o[rid] || {}), [key]: val } }));
  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: N.bg }} onClick={() => setEditing(null)}>

      {/* PAGE HEADER */}
      <div style={{ padding: "20px 24px 14px", background: N.surface, borderBottom: `1px solid ${N.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: N.text, margin: 0, letterSpacing: "-0.01em" }}>Tag Governance</h1>
            <p style={{ fontSize: 13, color: N.muted, margin: "4px 0 0 0" }}>
              Review resources, assign tags, and curate the tag schema.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
            <Kpi label="Required coverage" value={`${Math.round(filledCells/totalCells*100)}%`} tone="warn" />
            <Kpi label="Gaps" value={scored.filter(s => s.gaps > 0).length} sub={`of ${rowsRaw.length}`} />
            <Kpi label="Drift" value={scored.reduce((a,s)=>a+s.drifts,0)} tone="warn" />
            <Kpi label="At-risk spend" value="$11.3k" sub="/mo" tone="danger" />
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Legend />
          <div style={{ flex: 1 }} />
          <SegBtn options={[["all","All"],["missing-required","Missing required"],["drift","Drift"]]} value={keyFilter} onChange={setKeyFilter} />
          <Sel label="Sort" value={sortBy} options={[["gaps","Most gaps"],["spend","Spend"],["name","Name"]]} onChange={setSortBy} />
          {expanded.size > 0 && (
            <button onClick={() => setExpanded(new Set())} style={ghostBtn}>Collapse all ({expanded.size})</button>
          )}
          <div style={{ width: 1, height: 18, background: N.border, margin: "0 4px" }} />
          <button style={primaryBtn} onClick={() => onOpenChat?.("tag")}>
            <LIcon name="sparkles" size={13} color="#fff" strokeWidth={2} /> Ask Numio to fix
          </button>
        </div>
      </div>

      {/* HEATMAP */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 24px 24px", background: N.surface }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `300px repeat(${cols.length}, minmax(72px, 84px)) minmax(80px, 1fr)`,
          fontFamily: "Inter, sans-serif",
        }}>
          {/* HEAD */}
          <div style={head}><Hl>Resource</Hl></div>
          {colStats.map(c => (
            <div key={c.key} style={head}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <TagKey k={c.key} size={10} style={{ fontSize: 10, padding: "1px 5px" }} />
                  {c.required && <span style={{ width: 4, height: 4, borderRadius: 2, background: N.danger }} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    fontSize: 10, fontVariantNumeric: "tabular-nums", fontWeight: 600,
                    color: c.filled/c.total >= 0.85 ? N.success : c.filled/c.total >= 0.6 ? N.warn : N.danger,
                  }}>{Math.round(c.filled/c.total*100)}%</span>
                  <div style={{ flex: 1, height: 2, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{
                      width: `${c.filled/c.total*100}%`, height: "100%",
                      background: c.filled/c.total >= 0.85 ? N.success : c.filled/c.total >= 0.6 ? N.warn : N.danger,
                    }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div style={head}><Hl>Score</Hl></div>

          {/* ROWS */}
          {rows.map(({ r, gaps, drifts }) => {
            const isSel = selected.has(r.id);
            const isExp = expanded.has(r.id);
            return (
              <React.Fragment key={r.id}>
                <div
                  onClick={() => toggleExpand(r.id)}
                  style={{
                    ...cell,
                    padding: "6px 8px 6px 10px",
                    background: isExp ? "#fdfcfa" : isSel ? "#f5f8ff" : "transparent",
                    borderLeft: `2px solid ${gaps > 1 ? N.danger : gaps === 1 ? N.warn : "transparent"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  }}>
                  <input type="checkbox" checked={isSel}
                    onChange={() => toggleSel(r.id)}
                    onClick={(e) => e.stopPropagation()} />
                  <LIcon name="chevronDown" size={12} color={N.muted}
                    style={{ transform: isExp ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms", flexShrink: 0 }} />
                  <TypeChip t={r.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: N.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: N.xMuted, fontVariantNumeric: "tabular-nums" }}>
                      ${r.spend.toLocaleString()}/mo · {r.id}
                    </div>
                  </div>
                </div>

                {cols.map(c => {
                  const { state, v } = stateOf(r, c);
                  const isHover = hover && hover.rid === r.id && hover.key === c.key;
                  const isEditing = editing && editing.rid === r.id && editing.key === c.key;
                  return (
                    <div key={c.key} style={{ ...cell, padding: 0, background: isExp ? "#fdfcfa" : "transparent", position: "relative" }}>
                      <div
                        onMouseEnter={() => setHover({ rid: r.id, key: c.key, v, state, name: r.name })}
                        onMouseLeave={() => setHover(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (state === "na") return;
                          setEditing(isEditing ? null : { rid: r.id, key: c.key });
                        }}
                        style={{
                          height: 30, margin: "5px 3px",
                          borderRadius: 4,
                          cursor: state === "na" ? "default" : "pointer",
                          ...heatStyle(state, isHover || isEditing),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
                        }}>
                        {v != null && (
                          <span style={{
                            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", padding: "0 4px",
                            color: state === "drift" ? N.warn : heatTextColor(state),
                          }}>{v}</span>
                        )}
                        {state === "missing-req" && <span style={{ fontSize: 10, color: N.danger }}>!</span>}
                        {state === "missing-opt" && <span style={{ fontSize: 12, color: "#d4d2cd" }}>·</span>}
                        {state === "na" && <span style={{ fontSize: 9, color: "#cfcdc8" }}>n/a</span>}
                      </div>
                      {isEditing && <CellPop keyDef={c} value={v} state={state}
                        onPick={(picked) => { setTag(r.id, c.key, picked); setEditing(null); }}
                        onClear={() => { setTag(r.id, c.key, undefined); setEditing(null); }}
                        onClose={() => setEditing(null)}
                        onAskNumio={() => { setEditing(null); onOpenChat?.("cell", { resource: r, key: c.key }); }} />}
                    </div>
                  );
                })}

                <div style={{ ...cell, padding: "6px 8px", background: isExp ? "#fdfcfa" : "transparent", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  {gaps > 0 && <span style={badge(N.danger, N.dangerBg, "#fecaca")}>{gaps} miss</span>}
                  {drifts > 0 && <span style={badge(N.warn, N.warnBg, "#fde68a")}>{drifts} drift</span>}
                  {gaps === 0 && drifts === 0 && <span style={{ fontSize: 11, color: N.success }}>✓</span>}
                </div>

                {/* EXPANDED BODY */}
                {isExp && (
                  <div style={{
                    gridColumn: "1 / -1",
                    padding: "8px 16px 18px 56px",
                    background: "#fdfcfa", borderBottom: `1px solid ${N.border}`,
                  }}>
                    <Expanded r={r} cols={cols} tags={tagsOf(r)} stateOf={stateOf} onSet={(k, v) => setTag(r.id, k, v)} onOpenChat={onOpenChat} />
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
          position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 16,
          display: "flex", alignItems: "center", gap: 8,
          background: "#1f2024", color: "#fff",
          padding: "7px 8px 7px 14px", borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
          fontSize: 12, zIndex: 5,
        }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 4px" }} />
          <button style={bulkBtn} onClick={(e) => { e.stopPropagation(); onOpenChat?.("bulk", { ids: [...selected] }); }}>
            <LIcon name="sparkles" size={11} color="#c4b5fd" strokeWidth={2} /> Ask Numio to fix
          </button>
          <button style={bulkBtn}>Bulk apply…</button>
          <button style={bulkBtn}>Expand all</button>
          <button onClick={(e) => { e.stopPropagation(); setSelected(new Set()); }} style={{ ...bulkBtn, background: "transparent", padding: "4px 6px" }}>
            <LIcon name="x" size={11} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- EXPANDED ROW BODY ----------
function Expanded({ r, cols, tags, stateOf, onSet, onOpenChat }) {
  const missing = cols.filter(c => c.required && stateOf(r, c).state === "missing-req");
  const driftCells = cols.filter(c => stateOf(r, c).state === "drift");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
      {/* Tag editor list */}
      <div>
        <Sect>Edit tags · {Object.keys(tags).length}/{cols.length} set</Sect>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {cols.map(c => (
            <TagEditChip key={c.key} keyDef={c} value={tags[c.key]}
              state={stateOf(r, c).state}
              onPick={(v) => onSet(c.key, v)}
              onClear={() => onSet(c.key, undefined)} />
          ))}
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(missing.length > 0 || driftCells.length > 0) && (
          <div style={{ background: N.aiBg, border: `1px solid #e0e7ff`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <LIcon name="sparkles" size={11} color={N.ai2} strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 600, color: N.ai2 }}>Numio suggests</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => onOpenChat?.("resource", { resource: r })} style={{
                background: "transparent", border: "none", color: N.ai2,
                fontSize: 10, cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}>Open in chat ↗</button>
            </div>
            <div style={{ fontSize: 11, color: N.text2, lineHeight: 1.5, marginBottom: 8 }}>
              Inferred from peer resources in this project:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {missing.map(c => {
                const v = c.values[0];
                return <SuggestRow key={c.key} keyDef={c} v={v} onAccept={() => onSet(c.key, v)} />;
              })}
              {driftCells.map(c => (
                <SuggestRow key={c.key + "-drift"} keyDef={c} v="production" old="prod" drift
                  onAccept={() => onSet(c.key, "production")} />
              ))}
            </div>
            {missing.length + driftCells.length > 1 && (
              <button style={{ ...primaryBtn, marginTop: 10, padding: "3px 9px", fontSize: 11 }}
                onClick={() => {
                  missing.forEach(c => onSet(c.key, c.values[0]));
                  driftCells.forEach(c => onSet(c.key, "production"));
                }}>Accept all</button>
            )}
          </div>
        )}

        <div style={{ border: `1px solid ${N.border}`, borderRadius: 8, padding: "10px 12px", background: N.surface }}>
          <Sect>Resource</Sect>
          <KV label="Region">us-east-1</KV>
          <KV label="Created">Apr 18, 2026</KV>
          <KV label="Spend">${r.spend.toLocaleString()}/mo</KV>
          <KV label="ID"><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.id}</span></KV>
        </div>
      </div>
    </div>
  );
}

function SuggestRow({ keyDef, v, old, drift, onAccept }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <TagKey k={keyDef.key} size={10} style={{ minWidth: 76, justifyContent: "flex-start", flexShrink: 0 }} />
      {drift ? (
        <>
          <TagVal k="" v={old} size={10} style={{ opacity: 0.6, textDecoration: "line-through" }} />
          <span style={{ color: N.muted, fontSize: 9 }}>→</span>
          <TagVal k="" v={v} size={10} />
        </>
      ) : (
        <>
          <span style={{ color: N.muted, fontSize: 9 }}>→</span>
          <TagVal k="" v={v} size={10} />
        </>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onAccept} style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10, color: N.ai2, background: N.surface,
        border: `1px solid #e0e7ff`, borderRadius: 4,
        padding: "1px 6px", cursor: "pointer", fontFamily: "inherit",
      }}>✓ accept</button>
    </div>
  );
}

// ---------- TAG EDIT CHIP ----------
function TagEditChip({ keyDef, value, state, onPick, onClear }) {
  const [open, setOpen] = useStateV2(false);
  const missing = value == null;
  const isReqMiss = state === "missing-req";
  const isDrift = state === "drift";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
      borderRadius: 6, background: N.surface,
      border: `1px solid ${isReqMiss ? "#fecaca" : isDrift ? "#fde68a" : N.border}`,
    }}>
      <TagKey k={keyDef.key} size={11} style={{ minWidth: 96, justifyContent: "flex-start", flexShrink: 0 }} />
      {keyDef.required && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: missing ? N.danger : N.muted,
          background: missing ? "#fff" : "transparent",
          border: `1px solid ${missing ? "#fecaca" : N.border}`,
          padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em",
        }}>REQ</span>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {value != null ? <TagVal k="" v={value} drift={isDrift} size={11} />
          : isReqMiss ? <span style={{ fontSize: 11, color: N.danger, fontStyle: "italic" }}>required</span>
          : <span style={{ fontSize: 11, color: N.xMuted, fontStyle: "italic" }}>not set</span>}
        {isDrift && <span style={{ fontSize: 10, color: N.warn, marginLeft: 4 }}>drift</span>}
      </div>
      {open ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end", maxWidth: 320 }}>
          {keyDef.values.map(v => (
            <button key={v} onClick={() => { onPick(v); setOpen(false); }} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
              padding: "2px 6px", borderRadius: 4,
              background: v === value ? N.text : N.surface,
              color: v === value ? "#fff" : N.text2,
              border: `1px solid ${v === value ? N.text : N.border}`,
              cursor: "pointer",
            }}>{v}</button>
          ))}
          {value != null && (
            <button onClick={() => { onClear(); setOpen(false); }} style={{
              fontSize: 10, color: N.muted, background: N.surface,
              border: `1px solid ${N.border}`, borderRadius: 4,
              padding: "2px 6px", cursor: "pointer", fontFamily: "inherit",
            }}>clear</button>
          )}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 10.5, color: isReqMiss ? N.danger : N.muted,
          background: "transparent", border: "none",
          padding: "2px 6px", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {missing ? "set" : "edit"}
        </button>
      )}
    </div>
  );
}

// ---------- CELL POP ----------
function CellPop({ keyDef, value, state, onPick, onClear, onClose, onAskNumio }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
      marginTop: 4, zIndex: 30, width: 220,
      background: N.surface, border: `1px solid ${N.borderStrong}`, borderRadius: 8,
      boxShadow: "0 14px 36px rgba(0,0,0,0.14)", padding: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px 7px 6px", borderBottom: `1px solid ${N.border}` }}>
        <TagKey k={keyDef.key} size={10} />
        {keyDef.required && <span style={{
          fontSize: 9, fontWeight: 700, color: N.danger, background: N.surface,
          border: `1px solid #fecaca`, padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em",
        }}>REQ</span>}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: N.muted, cursor: "pointer", padding: 2 }}>
          <LIcon name="x" size={10} color={N.muted} />
        </button>
      </div>
      {state === "drift" && (
        <div style={{ padding: "6px 8px", borderBottom: `1px solid ${N.border}`, background: N.warnBg, fontSize: 10.5, color: N.warn }}>
          drift — canonical is <code style={{ background: N.surface, padding: "0 3px", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>production</code>
        </div>
      )}
      <input autoFocus placeholder="Filter or type new value…" style={{
        width: "100%", height: 26, border: "none", outline: "none",
        padding: "0 8px", background: "transparent",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        borderBottom: `1px solid ${N.border}`,
      }} />
      <div style={{ maxHeight: 180, overflow: "auto", padding: "3px 0" }}>
        {keyDef.values.map(v => (
          <button key={v} onClick={() => onPick(v)} style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "4px 8px", border: "none",
            background: v === value ? "#f3f4f6" : "transparent",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <TagVal k="" v={v} size={11} />
            {v === value && <span style={{ marginLeft: "auto", color: N.success, fontSize: 11 }}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, padding: "4px 4px 2px 4px", borderTop: `1px solid ${N.border}` }}>
        <button style={popMini}>+ new</button>
        {value != null && <button style={popMini} onClick={onClear}>clear</button>}
        <button style={{ ...popMini, color: N.ai2 }} onClick={onAskNumio}>
          <LIcon name="sparkles" size={9} color={N.ai2} strokeWidth={2} /> Ask Numio
        </button>
      </div>
    </div>
  );
}

function HoverPeek({ hover }) {
  const { state, key, v, name } = hover;
  let label, color;
  if (state === "ok") { label = `${key}:${v}`; color = N.success; }
  else if (state === "drift") { label = `drift · canonical is "production"`; color = N.warn; }
  else if (state === "missing-req") { label = `${key} required — click to pick a value`; color = N.danger; }
  else if (state === "missing-opt") { label = `${key} not set`; color = N.muted; }
  else if (state === "na") { label = `${key} not applicable`; color = N.muted; }
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

// ---------- ATOMS ----------
function Kpi({ label, value, sub, tone }) {
  const color = tone === "danger" ? N.danger : tone === "warn" ? N.warn : N.text;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: N.xMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: N.muted }}>{sub}</span>}
      </div>
    </div>
  );
}
function Legend() {
  const Item = ({ swatch, label }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: N.muted }}>{swatch}{label}</span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: "#ecfdf5", border: "1px solid #d1fae5" }} />} label="Set" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: N.dangerBg, border: "1px dashed #fecaca" }} />} label="Required missing" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: N.warnBg, border: "1px solid #fde68a" }} />} label="Drift" />
      <Item swatch={<span style={{ width: 14, height: 10, borderRadius: 2, background: N.surfaceMuted, border: `1px solid ${N.border}` }} />} label="Optional empty" />
    </div>
  );
}
function SegBtn({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${N.border}`, borderRadius: 6, background: N.surface, overflow: "hidden" }}>
      {options.map(([v, l], i) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: "4px 10px", fontSize: 12, fontWeight: 500,
          border: "none", background: value === v ? N.text : "transparent",
          color: value === v ? "#fff" : N.text2, cursor: "pointer", fontFamily: "inherit",
          borderRight: i < options.length-1 ? `1px solid ${N.border}` : "none",
        }}>{l}</button>
      ))}
    </div>
  );
}
function Sel({ label, value, options, onChange }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: N.muted }}>
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        border: `1px solid ${N.border}`, borderRadius: 6,
        padding: "3px 6px", fontSize: 12, color: N.text2, background: N.surface, fontFamily: "inherit",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Sect({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 500, color: N.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{children}</div>;
}
function KV({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "2px 0", fontSize: 11.5 }}>
      <span style={{ width: 56, color: N.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: N.text2 }}>{children}</span>
    </div>
  );
}
function Hl({ children }) {
  return <span style={{ fontSize: 10, fontWeight: 500, color: N.xMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</span>;
}

function heatStyle(state, hover) {
  const ring = hover ? `0 0 0 1.5px ${N.text}` : "none";
  if (state === "ok")          return { background: "#ecfdf5", border: "1px solid #d1fae5", boxShadow: ring };
  if (state === "drift")       return { background: N.warnBg, border: "1px solid #fde68a", boxShadow: ring };
  if (state === "missing-req") return { background: N.dangerBg, border: "1px dashed #fecaca", boxShadow: ring };
  if (state === "missing-opt") return { background: N.surfaceMuted, border: `1px solid ${N.border}`, boxShadow: ring };
  if (state === "na")          return { background: "transparent", border: `1px solid ${N.border}`, opacity: 0.5 };
  return {};
}
function heatTextColor(state) {
  if (state === "ok") return "#047857";
  if (state === "drift") return N.warn;
  return N.muted;
}

const head = {
  padding: "8px 0 10px 0", borderBottom: `1px solid ${N.border}`,
  position: "sticky", top: 0, background: N.surface, zIndex: 2,
};
const cell = { borderBottom: `1px solid #f4f3ef`, minHeight: 40, display: "flex", alignItems: "center" };
const badge = (fg, bg, bd) => ({
  fontSize: 10, fontWeight: 700, color: fg, background: bg,
  border: `1px solid ${bd}`, borderRadius: 4, padding: "1px 5px",
});
const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: N.ai, color: "#fff", border: "none", borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: "6px 12px",
  cursor: "pointer", fontFamily: "inherit",
};
const ghostBtn = {
  background: "transparent", border: "none", color: N.muted,
  fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0,
};
const popMini = {
  flex: 1, fontSize: 10, color: N.muted, border: "none", background: "transparent",
  padding: "3px 4px", cursor: "pointer", fontFamily: "inherit", borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
};
const bulkBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: "4px 9px",
  cursor: "pointer", fontFamily: "inherit",
};

Object.assign(window, { TagGovernanceContent });
