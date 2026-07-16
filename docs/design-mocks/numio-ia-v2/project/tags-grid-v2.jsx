// tags-grid-v2.jsx — Direction A1 (refined): the main spreadsheet surface
// What's new vs v1:
//   • Inline cell-edit popover (click a cell → choose value from allowed set)
//   • Column-header menu (fill empty, set all, sort, hide)
//   • Group-by control (none / type / env / team) with collapsible groups
//   • Sticky resource column when you scroll horizontally
//   • Multi-key bulk apply (queue several key→value pairs before applying)
//   • Tighter density toggle for dense fleets
const { useState: useStateG, useMemo: useMemoG, useRef: useRefG } = React;

function GridRefined({ tweaks = {} }) {
  const dense = tweaks.density !== "comfortable";
  const [selected, setSelected] = useStateG(new Set(["r-008", "r-011", "r-012", "r-030", "r-031", "r-037", "r-042"]));
  const [groupBy, setGroupBy] = useStateG("type"); // none | type | env | team
  const [filterEnv, setFilterEnv] = useStateG("all");
  const [showPanel, setShowPanel] = useStateG(true);
  const [editing, setEditing] = useStateG(null); // {rid, key, anchorRect}
  const [colMenu, setColMenu] = useStateG(null);
  const [tagOverrides, setTagOverrides] = useStateG({}); // rid -> {key: value}
  const [queued, setQueued] = useStateG([
    { id: 1, key: "cost-center", value: "CC-ENG", mode: "fill" },
  ]);

  const cols = TAG_KEYS.slice(0, 6);

  const rows = useMemoG(() => RESOURCES.filter(r => filterEnv === "all" || r.tags.env === filterEnv || (filterEnv === "production" && r.tags.env === "prod")), [filterEnv]);

  const effectiveTags = (r) => ({ ...r.tags, ...(tagOverrides[r.id] || {}) });

  const grouped = useMemoG(() => {
    if (groupBy === "none") return [{ key: "", label: null, rows }];
    const byKey = {};
    rows.forEach(r => {
      const k = groupBy === "type" ? r.type : (effectiveTags(r)[groupBy] || "—");
      (byKey[k] = byKey[k] || []).push(r);
    });
    return Object.entries(byKey).map(([k, rs]) => ({ key: k, label: k, rows: rs }));
  }, [rows, groupBy, tagOverrides]);

  const colCoverage = cols.map(c => {
    const n = rows.filter(r => effectiveTags(r)[c.key] != null).length;
    return rows.length ? n / rows.length : 0;
  });

  const totalGaps = rows.reduce((acc, r) => acc + cols.filter(c => c.required && effectiveTags(r)[c.key] == null).length, 0);

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));

  const cellPx = dense ? "5px 10px" : "8px 12px";

  // Apply queued plan to override
  const applyQueue = () => {
    const next = { ...tagOverrides };
    for (const r of rows.filter(x => selected.has(x.id))) {
      const cur = effectiveTags(r);
      const patch = {};
      for (const q of queued) {
        if (q.mode === "fill" && cur[q.key] != null) continue;
        if (q.mode === "clear") patch[q.key] = undefined;
        else patch[q.key] = q.value;
      }
      next[r.id] = { ...(next[r.id] || {}), ...patch };
    }
    setTagOverrides(next);
    setSelected(new Set());
    setQueued([]);
  };

  return (
    <AppShell crumb="Tags / Resources" actions={
      <>
        <Btn icon="filter">Saved views</Btn>
        <Btn icon="upload">Sync from cloud</Btn>
        <Btn primary icon="plus">Apply tags</Btn>
      </>
    }>
      <div style={{ display: "flex", height: "100%" }}>
        {/* MAIN */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>

          {/* HEADER STRIP */}
          <div style={{ padding: "18px 24px 12px", borderBottom: `1px solid ${TAG.border}`, background: "#fdfdfc" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>My resources</h1>
                <p style={{ fontSize: 12, color: TAG.muted, margin: "3px 0 0 0" }}>
                  {rows.length} resources · <b style={{ color: totalGaps ? TAG.danger : TAG.success }}>{totalGaps} required gaps</b> · last synced 2 min ago
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <KpiMini label="Coverage" value="78%" tone="warn" bar={0.78} />
                <KpiMini label="Drift" value="1" tone="warn" />
                <KpiMini label="Untagged spend" value="$28" sub="/mo" />
              </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Icon name="search" size={12} color={TAG.muted} style={{ position: "absolute", left: 8, top: 7 }} />
                <input placeholder="Search resources, tags…" style={{
                  width: 220, height: 26, padding: "0 8px 0 26px",
                  border: `1px solid ${TAG.border}`, borderRadius: 6,
                  fontFamily: "inherit", fontSize: 12, color: TAG.text2, background: "#fff",
                }} />
              </div>
              <FilterChipG label="All" value={RESOURCES.length} active={filterEnv === "all"} onClick={() => setFilterEnv("all")} />
              <FilterChipG label="prod" value={9} active={filterEnv === "production"} onClick={() => setFilterEnv("production")} />
              <FilterChipG label="staging" value={5} active={filterEnv === "staging"} onClick={() => setFilterEnv("staging")} />
              <FilterChipG label="dev" value={7} active={filterEnv === "dev"} onClick={() => setFilterEnv("dev")} />
              <div style={{ width: 1, height: 16, background: TAG.border, margin: "0 4px" }} />
              <FilterChipG label="Required missing" value={9} tone="danger" />
              <FilterChipG label="Drift" value={1} tone="warn" />
              <div style={{ flex: 1 }} />
              <SmallSelect label="Group by" value={groupBy} options={[["none","None"],["type","Type"],["env","env"],["team","team"]]} onChange={setGroupBy} />
              <Btn ghost icon="download" style={{ color: TAG.muted }}>Export</Btn>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ flex: 1, overflow: "auto", background: "#fff", position: "relative" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 32 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 80 }} />
                {cols.map(c => <col key={c.key} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thG(dense), position: "sticky", left: 0, top: 0, zIndex: 4, background: "#fafaf9", width: 32 }}>
                    <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} />
                  </th>
                  <th style={{ ...thG(dense), position: "sticky", left: 32, top: 0, zIndex: 4, background: "#fafaf9", boxShadow: "1px 0 0 #ececea" }}>Resource</th>
                  <th style={{ ...thG(dense), top: 0, zIndex: 3 }}>Type</th>
                  <th style={{ ...thG(dense), top: 0, zIndex: 3, textAlign: "right" }}>Spend / mo</th>
                  {cols.map((c, i) => (
                    <th key={c.key} style={{ ...thG(dense), top: 0, zIndex: 3, position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <TagKeyPill k={c.key} size={11} />
                          {c.required && <span title="required" style={{ width: 5, height: 5, borderRadius: 3, background: TAG.danger }} />}
                          <button onClick={() => setColMenu(colMenu === c.key ? null : c.key)} style={{
                            marginLeft: "auto", border: "none", background: "transparent", color: TAG.muted,
                            display: "flex", alignItems: "center", padding: 2, cursor: "pointer", borderRadius: 3,
                          }}>
                            <Icon name="dots" size={11} />
                          </button>
                        </div>
                        <CoverageBar value={colCoverage[i]} w={88} h={3} />
                      </div>
                      {colMenu === c.key && (
                        <ColMenu k={c.key} onClose={() => setColMenu(null)} onAction={(action, val) => {
                          if (action === "fill" || action === "set") {
                            const patch = {};
                            for (const r of rows) {
                              if (action === "fill" && effectiveTags(r)[c.key] != null) continue;
                              patch[r.id] = { ...(tagOverrides[r.id] || {}), [c.key]: val };
                            }
                            setTagOverrides(o => ({ ...o, ...patch }));
                          }
                          setColMenu(null);
                        }} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, gi) => (
                  <React.Fragment key={g.key + gi}>
                    {g.label != null && (
                      <tr>
                        <td colSpan={4 + cols.length} style={{
                          padding: "8px 14px 4px 14px",
                          background: "#fbfaf7",
                          borderBottom: `1px solid ${TAG.border}`,
                          fontSize: 11, color: TAG.muted, fontWeight: 500,
                          letterSpacing: "0.04em", textTransform: "uppercase",
                          position: "sticky", left: 0,
                        }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Icon name="chevron" size={10} color={TAG.muted} />
                            {groupBy === "type" ? <TypeChip t={g.label} /> :
                             g.label === "—" ? <span style={{ fontStyle: "italic", color: TAG.danger }}>unset</span> :
                             <TagPill k={groupBy} v={g.label} size={11} />}
                            <span style={{ color: TAG.xMuted, fontWeight: 400 }}>{g.rows.length}</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {g.rows.map((r, ri) => {
                      const isSel = selected.has(r.id);
                      const rt = effectiveTags(r);
                      return (
                        <tr key={r.id} style={{ background: isSel ? "#f5f8ff" : "#fff" }}>
                          <td style={{ ...tdG(cellPx), position: "sticky", left: 0, background: isSel ? "#f5f8ff" : "#fff", zIndex: 1 }}>
                            <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} />
                          </td>
                          <td style={{ ...tdG(cellPx), position: "sticky", left: 32, background: isSel ? "#f5f8ff" : "#fff", zIndex: 1, boxShadow: "1px 0 0 #f1efeb" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</span>
                              <span style={{ fontSize: 10, color: TAG.xMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r.id}</span>
                            </div>
                          </td>
                          <td style={tdG(cellPx)}><TypeChip t={r.type} /></td>
                          <td style={{ ...tdG(cellPx), textAlign: "right", fontVariantNumeric: "tabular-nums", color: TAG.text2 }}>${r.spend.toLocaleString()}</td>
                          {cols.map((c, ci) => {
                            const v = rt[c.key];
                            const drift = c.key === "env" && v === "prod";
                            const isEditing = editing && editing.rid === r.id && editing.key === c.key;
                            return (
                              <td key={c.key} style={{
                                ...tdG(cellPx),
                                cursor: "pointer",
                                position: "relative",
                                boxShadow: isEditing ? `inset 0 0 0 1.5px ${TAG.accent}` : "none",
                              }} onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const parentRect = e.currentTarget.closest("table").parentElement.getBoundingClientRect();
                                setEditing({ rid: r.id, key: c.key, top: rect.bottom - parentRect.top + 2, left: rect.left - parentRect.left });
                              }}>
                                {v != null ? (
                                  <TagPill k="" v={v} drift={drift} />
                                ) : c.required ? (
                                  <TagPill k="" v="" missing />
                                ) : (
                                  <span style={{ fontSize: 11, color: TAG.xMuted, fontStyle: "italic" }}>—</span>
                                )}
                                {isEditing && (
                                  <CellEditor
                                    keyDef={c}
                                    value={v}
                                    onPick={(picked) => {
                                      setTagOverrides(o => ({ ...o, [r.id]: { ...(o[r.id] || {}), [c.key]: picked } }));
                                      setEditing(null);
                                    }}
                                    onClose={() => setEditing(null)}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
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
              <span style={{ opacity: 0.55 }}>·</span>
              <span style={{ opacity: 0.75 }}>${rows.filter(r => selected.has(r.id)).reduce((a,b)=>a+b.spend,0).toLocaleString()}/mo</span>
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 4px" }} />
              <button style={bulkBtnG}>Set tag…</button>
              <button style={bulkBtnG}>Suggest <Icon name="sparkle" size={11} color="#c4b5fd" /></button>
              <button style={bulkBtnG}>Open</button>
              <button onClick={() => setSelected(new Set())} style={{ ...bulkBtnG, background: "transparent", padding: "4px 6px" }}>
                <Icon name="x" size={11} color="#fff" />
              </button>
            </div>
          )}
        </div>

        {/* SIDE PANEL */}
        {showPanel && (
          <BulkPanel
            selected={selected}
            queued={queued}
            setQueued={setQueued}
            onClose={() => setShowPanel(false)}
            onApply={applyQueue}
            rows={rows}
            tagsOf={effectiveTags}
          />
        )}
      </div>
    </AppShell>
  );
}

// ---------- BULK SIDE PANEL ----------
function BulkPanel({ selected, queued, setQueued, onClose, onApply, rows, tagsOf }) {
  const selRows = rows.filter(r => selected.has(r.id));
  const spend = selRows.reduce((a,b)=>a+b.spend,0);

  return (
    <aside style={{
      width: 348, flexShrink: 0,
      borderLeft: `1px solid ${TAG.border}`,
      background: "#fdfdfc", display: "flex", flexDirection: "column",
    }}>
      {/* head */}
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${TAG.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Apply tags</span>
          <div style={{ flex: 1 }} />
          <Icon name="x" size={12} color={TAG.muted} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 11.5, color: TAG.muted, lineHeight: 1.5 }}>
          {selected.size === 0 ? "Select resources in the table to begin." :
           <>Plan touches <b style={{ color: TAG.text }}>{selected.size} resources</b> · ${spend.toLocaleString()}/mo</>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "12px 18px 18px" }}>

        {/* AI suggestion */}
        {selected.size > 0 && (
          <div style={{
            border: `1px solid #e0e7ff`, background: TAG.aiBg,
            borderRadius: 8, padding: "10px 12px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Icon name="sparkle" size={11} color={TAG.ai2} />
              <span style={{ fontSize: 11, fontWeight: 600, color: TAG.ai2, letterSpacing: "0.01em" }}>Suggested from peer resources</span>
            </div>
            <p style={{ fontSize: 11.5, color: TAG.text2, margin: "0 0 8px 0", lineHeight: 1.5 }}>
              6 of {selected.size} look like dev/staging EC2 owned by you. Infer <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3, fontSize: 11 }}>cost-center:CC-ENG</Mono>?
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn ai style={{ padding: "3px 8px", fontSize: 11 }}>Add to plan</Btn>
              <Btn ghost style={{ padding: "3px 8px", fontSize: 11, color: TAG.muted }}>Dismiss</Btn>
            </div>
          </div>
        )}

        {/* Plan list */}
        <SectionLabelG>Plan ({queued.length})</SectionLabelG>
        <div style={{
          border: `1px solid ${TAG.border}`, borderRadius: 8,
          background: "#fff", overflow: "hidden", marginBottom: 8,
        }}>
          {queued.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: 11.5, color: TAG.muted, textAlign: "center" }}>
              No changes queued. Add one below.
            </div>
          ) : queued.map((q, i) => (
            <div key={q.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              borderTop: i ? `1px solid ${TAG.border}` : "none",
            }}>
              <TagKeyPill k={q.key} size={11} />
              <SmallSelect inline value={q.mode} options={[["set","Set"],["fill","Fill empty"],["clear","Clear"]]} onChange={(v) => setQueued(qs => qs.map(x => x.id===q.id ? { ...x, mode: v } : x))} />
              {q.mode !== "clear" && <TagPill k="" v={q.value} size={11} />}
              <div style={{ flex: 1 }} />
              <Icon name="x" size={11} color={TAG.muted} style={{ cursor: "pointer" }} onClick={() => setQueued(qs => qs.filter(x => x.id !== q.id))} />
            </div>
          ))}
          <button style={{
            width: "100%", border: "none", background: "transparent",
            borderTop: queued.length ? `1px solid ${TAG.border}` : "none",
            padding: "7px 10px", fontSize: 11.5, color: TAG.muted,
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontFamily: "inherit",
          }} onClick={() => setQueued(qs => [...qs, { id: Date.now(), key: "owner", value: "jchen@acme.com", mode: "fill" }])}>
            <Icon name="plus" size={10} color={TAG.muted} /> Add tag change
          </button>
        </div>

        {/* Preview */}
        {selected.size > 0 && queued.length > 0 && (
          <>
            <SectionLabelG style={{ marginTop: 16 }}>Diff preview</SectionLabelG>
            <div style={{
              border: `1px solid ${TAG.border}`, borderRadius: 8,
              background: "#fff", overflow: "hidden",
            }}>
              {selRows.slice(0, 6).map((r, i) => {
                const tags = tagsOf(r);
                return (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px",
                    borderTop: i ? `1px solid ${TAG.border}` : "none",
                  }}>
                    <TypeChip t={r.type} />
                    <span style={{ flex: 1, fontSize: 11.5, color: TAG.text2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {queued.map(q => {
                        const has = tags[q.key];
                        if (q.mode === "fill" && has != null) {
                          return <TagPill key={q.id} k="" v={has} size={10} style={{ opacity: 0.5 }} />;
                        }
                        return <TagPill key={q.id} k="" v={q.mode === "clear" ? "—" : q.value} size={10} />;
                      })}
                    </div>
                  </div>
                );
              })}
              {selRows.length > 6 && (
                <div style={{ padding: "6px 10px", fontSize: 11, color: TAG.muted, borderTop: `1px solid ${TAG.border}`, textAlign: "center" }}>
                  + {selRows.length - 6} more
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
          <Btn primary onClick={onApply} disabled={!selected.size || !queued.length} style={{
            flex: 1, justifyContent: "center", padding: "7px 12px", fontSize: 12.5,
            opacity: (!selected.size || !queued.length) ? 0.4 : 1,
          }}>Apply to {selected.size}</Btn>
          <Btn>Dry-run</Btn>
        </div>
        <p style={{ fontSize: 10.5, color: TAG.xMuted, margin: "10px 0 0 0", lineHeight: 1.5 }}>
          Tags are written via cloud-native APIs. Numio audits every change; revertible from the campaign log.
        </p>
      </div>
    </aside>
  );
}

// ---------- CELL EDITOR POPOVER ----------
function CellEditor({ keyDef, value, onPick, onClose }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: "absolute", top: "100%", left: 0, marginTop: 4,
      width: 200, zIndex: 10,
      background: "#fff", border: `1px solid ${TAG.borderStrong}`, borderRadius: 8,
      boxShadow: "0 12px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.02)",
      padding: 6,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "2px 6px 6px 6px",
        borderBottom: `1px solid ${TAG.border}`,
      }}>
        <TagKeyPill k={keyDef.key} size={10} />
        <span style={{ fontSize: 10, color: TAG.muted }}>{keyDef.values.length} values</span>
        <div style={{ flex: 1 }} />
        <Icon name="x" size={10} color={TAG.muted} style={{ cursor: "pointer" }} onClick={onClose} />
      </div>
      <input autoFocus placeholder="Type to filter…" style={{
        width: "100%", height: 24, border: "none", outline: "none",
        background: "transparent", padding: "0 6px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        borderBottom: `1px solid ${TAG.border}`,
      }} />
      <div style={{ maxHeight: 180, overflow: "auto", padding: "4px 0" }}>
        {keyDef.values.map(v => (
          <button key={v} onClick={() => onPick(v)} style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "4px 6px", border: "none",
            background: v === value ? "#f3f4f6" : "transparent",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <TagPill k="" v={v} size={11} />
            {v === value && <Icon name="check" size={11} color={TAG.success} style={{ marginLeft: "auto" }} />}
          </button>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 4, padding: "4px 4px 2px 4px",
        borderTop: `1px solid ${TAG.border}`,
      }}>
        <button style={editorMini}>+ new value</button>
        <button style={editorMini}>Clear</button>
        <button style={{ ...editorMini, color: TAG.ai2 }}>
          <Icon name="sparkle" size={9} color={TAG.ai2} /> Suggest
        </button>
      </div>
    </div>
  );
}

// ---------- COLUMN HEADER MENU ----------
function ColMenu({ k, onClose, onAction }) {
  const keyDef = TAG_KEYS.find(x => x.key === k);
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
      width: 200, background: "#fff", border: `1px solid ${TAG.borderStrong}`, borderRadius: 8,
      boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
      padding: 4,
      textTransform: "none", letterSpacing: 0,
    }}>
      <MenuItem icon="filter" onClick={() => onAction("filter")}>Filter by {k}</MenuItem>
      <MenuItem icon="arrow" onClick={() => onAction("sort")}>Sort</MenuItem>
      <div style={{ height: 1, background: TAG.border, margin: "3px 0" }} />
      <div style={{ padding: "3px 8px", fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Fill empty with</div>
      {keyDef.values.slice(0, 4).map(v => (
        <button key={v} onClick={() => onAction("fill", v)} style={menuRowG}>
          <TagPill k="" v={v} size={11} />
        </button>
      ))}
      <div style={{ height: 1, background: TAG.border, margin: "3px 0" }} />
      <MenuItem icon="sparkle" onClick={() => onAction("ai")} accent>Auto-fill with AI</MenuItem>
      <MenuItem icon="trash" onClick={() => onAction("clear")}>Clear column</MenuItem>
    </div>
  );
}
function MenuItem({ icon, children, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      width: "100%", padding: "5px 8px", border: "none",
      background: "transparent", cursor: "pointer", fontFamily: "inherit",
      fontSize: 12, color: accent ? TAG.ai2 : TAG.text2,
      borderRadius: 4, textAlign: "left",
    }}>
      <Icon name={icon} size={11} color={accent ? TAG.ai2 : TAG.muted} />
      {children}
    </button>
  );
}

// ---------- Small reusables ----------
function FilterChipG({ label, value, active, onClick, tone }) {
  const toneBg = tone === "danger" ? TAG.dangerBg : tone === "warn" ? TAG.warnBg : null;
  const toneFg = tone === "danger" ? TAG.danger : tone === "warn" ? TAG.warn : null;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 500,
      border: `1px solid ${active ? TAG.text : (toneBg ? toneBg : TAG.border)}`,
      background: active ? TAG.text : (toneBg || TAG.surface),
      color: active ? "#fff" : (toneFg || TAG.text2),
      cursor: "pointer", fontFamily: "inherit",
    }}>
      {label}
      {value != null && <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{value}</span>}
    </button>
  );
}
function KpiMini({ label, value, sub, tone, bar }) {
  const color = tone === "warn" ? TAG.warn : tone === "danger" ? TAG.danger : TAG.text;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 9.5, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2, justifyContent: "flex-end" }}>
        {bar != null && <CoverageBar value={bar} w={56} h={4} />}
        <span style={{ fontSize: 16, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: TAG.muted }}>{sub}</span>}
      </div>
    </div>
  );
}
function SmallSelect({ label, value, options, onChange, inline }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: TAG.muted, fontFamily: "inherit" }}>
      {label && <span>{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        appearance: "none", border: `1px solid ${TAG.border}`, borderRadius: 5,
        padding: inline ? "2px 18px 2px 6px" : "3px 18px 3px 8px",
        fontFamily: "inherit", fontSize: 11, color: TAG.text2,
        background: `${TAG.surface} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><path fill='rgba(0,0,0,.4)' d='M0 0h8L4 6z'/></svg>") no-repeat right 6px center`,
        cursor: "pointer",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function SectionLabelG({ children, style }) {
  return <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0", ...style }}>{children}</div>;
}

const thG = (dense) => ({
  fontSize: 10, fontWeight: 500, color: TAG.xMuted,
  textTransform: "uppercase", letterSpacing: "0.06em",
  textAlign: "left", padding: dense ? "8px 10px" : "10px 12px",
  borderBottom: `1px solid ${TAG.border}`,
  background: "#fafaf9",
});
const tdG = (cellPx) => ({
  fontSize: 12, color: TAG.text,
  padding: cellPx,
  borderBottom: `1px solid #f4f3ef`,
  verticalAlign: "middle",
});
const bulkBtnG = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: "4px 9px",
  cursor: "pointer", fontFamily: "inherit",
};
const editorMini = {
  flex: 1, fontSize: 10, color: TAG.muted,
  border: "none", background: "transparent",
  padding: "3px 4px", cursor: "pointer", fontFamily: "inherit",
  borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
};
const menuRowG = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "4px 8px", border: "none",
  background: "transparent", cursor: "pointer", fontFamily: "inherit",
  textAlign: "left", borderRadius: 4,
};

Object.assign(window, { GridRefined });
