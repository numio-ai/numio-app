// tags-detail.jsx — Resource detail drawer: edit one resource's tags
const { useState: useStateD } = React;

function ResourceDetailArtboard() {
  const r = RESOURCES.find(x => x.id === "r-008"); // dev-worker-02, low compliance
  const [tags, setTags] = useStateD(r.tags);
  const [adding, setAdding] = useStateD(false);
  const [newKey, setNewKey] = useStateD("");
  const missing = TAG_KEYS.filter(k => k.required && !tags[k.key]);

  return (
    <div style={{
      width: "100%", height: "100%", background: "#fff",
      fontFamily: "Inter, system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* header */}
      <div style={{
        padding: "16px 20px 12px", borderBottom: `1px solid ${TAG.border}`,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <TypeChip t={r.type} />
            <span style={{ fontSize: 10, color: TAG.xMuted }}>r-008 · us-east-1</span>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{r.name}</h2>
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: TAG.muted }}>
            <span>Spend <b style={{ color: TAG.text2 }}>${r.spend.toLocaleString()}/mo</b></span>
            <span>Created <b style={{ color: TAG.text2 }}>Apr 18, 2026</b></span>
          </div>
        </div>
        <Icon name="x" size={14} color={TAG.muted} style={{ cursor: "pointer" }} />
      </div>

      {/* compliance alert */}
      {missing.length > 0 && (
        <div style={{
          background: TAG.dangerBg, borderBottom: `1px solid #fecaca`,
          padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon name="warn" size={12} color={TAG.danger} />
          <div style={{ flex: 1, fontSize: 11.5, color: TAG.danger }}>
            Missing <b>{missing.length}</b> required {missing.length === 1 ? "tag" : "tags"}: {missing.map(m => <Mono key={m.key} style={{ background: "#fff", padding: "0 4px", borderRadius: 3, marginRight: 4 }}>{m.key}</Mono>)}
          </div>
          <Btn ai icon="sparkle" style={{ fontSize: 11, padding: "3px 8px" }}>Suggest</Btn>
        </div>
      )}

      {/* tags */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tags</div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setAdding(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            border: "none", background: "transparent", color: TAG.muted,
            fontSize: 11, fontFamily: "inherit", cursor: "pointer", padding: 0,
          }}>
            <Icon name="plus" size={10} color={TAG.muted} /> Add tag
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* missing required tags first */}
          {missing.map(m => (
            <TagEditRow key={"miss-"+m.key} keyName={m.key} value="" required missing
              allowed={m.values}
              onSave={(v) => setTags(t => ({ ...t, [m.key]: v }))} />
          ))}
          {/* existing tags */}
          {TAG_KEYS.filter(k => tags[k.key] != null).map(k => {
            const isDrift = k.key === "env" && tags[k.key] === "prod";
            return (
              <TagEditRow key={k.key} keyName={k.key} value={tags[k.key]}
                required={k.required} drift={isDrift}
                allowed={k.values}
                onSave={(v) => setTags(t => ({ ...t, [k.key]: v }))} />
            );
          })}
          {adding && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px", border: `1px dashed ${TAG.borderStrong}`, borderRadius: 6,
            }}>
              <select value={newKey} onChange={e => setNewKey(e.target.value)} style={{
                fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace",
                border: `1px solid ${TAG.border}`, borderRadius: 5, padding: "2px 6px",
              }}>
                <option value="">choose key…</option>
                {TAG_KEYS.filter(k => !tags[k.key]).map(k => <option key={k.key} value={k.key}>{k.key}</option>)}
              </select>
              <Icon name="arrow" size={11} color={TAG.muted} />
              <Mono style={{ flex: 1, color: TAG.xMuted, fontSize: 11.5 }}>value…</Mono>
              <Btn style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setAdding(false)}>Cancel</Btn>
            </div>
          )}
        </div>

        {/* policy notes */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Policy</div>
          <div style={{ background: TAG.surfaceMuted, border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: TAG.text2, lineHeight: 1.5 }}>
            Resources without <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3 }}>cost-center</Mono> are flagged in monthly cost reports as <i>unallocated</i>. Dev resources without <Mono style={{ background: "#fff", padding: "0 4px", borderRadius: 3 }}>owner</Mono> are auto-stopped after 72h idle.
          </div>
        </div>

        {/* activity */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Activity</div>
          {[
            { t: "2h ago", who: "Tag co-pilot", what: <>Suggested <Mono>cost-center:CC-ENG</Mono></>, ai: true },
            { t: "Yesterday", who: "kima sync", what: <>Updated <Mono>env</Mono> from AWS tag policy</>, ai: false },
            { t: "3d ago", who: "rlee@acme.com", what: <>Created resource</>, ai: false },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderTop: i ? `1px solid ${TAG.border}` : "none" }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: a.ai ? TAG.aiBg : "#f3f4f6", color: a.ai ? TAG.ai2 : TAG.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 600 }}>
                {a.ai ? <Icon name="sparkle" size={9} color={TAG.ai2} /> : a.who[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: TAG.text2 }}>
                <div>{a.what}</div>
                <div style={{ fontSize: 10.5, color: TAG.muted, marginTop: 2 }}>{a.who} · {a.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div style={{
        flexShrink: 0, padding: "12px 20px",
        borderTop: `1px solid ${TAG.border}`, background: "#fdfdfc",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: TAG.muted }}>3 unsaved changes</span>
        <div style={{ flex: 1 }} />
        <Btn>Cancel</Btn>
        <Btn primary>Save & apply</Btn>
      </div>
    </div>
  );
}

function TagEditRow({ keyName, value, required, missing, drift, allowed, onSave }) {
  const [editing, setEditing] = useStateD(false);
  const [draft, setDraft] = useStateD(value);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px",
      border: `1px solid ${missing ? "#fecaca" : drift ? "#fde68a" : TAG.border}`,
      background: missing ? TAG.dangerBg : drift ? TAG.warnBg : "#fff",
      borderRadius: 6,
    }}>
      <TagKeyPill k={keyName} size={12} style={{ minWidth: 90, flexShrink: 0, justifyContent: "flex-start" }} />
      {required && <span style={{
        fontSize: 9, fontWeight: 700, color: TAG.danger, padding: "1px 4px",
        background: "#fff", border: `1px solid #fecaca`, borderRadius: 3, letterSpacing: "0.04em",
      }}>REQ</span>}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {editing ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {allowed.map(a => (
              <button key={a} onClick={() => { setDraft(a); onSave(a); setEditing(false); }} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                padding: "2px 7px", borderRadius: 5,
                background: a === draft ? TAG.text : TAG.surface,
                color: a === draft ? "#fff" : TAG.text2,
                border: `1px solid ${a === draft ? TAG.text : TAG.border}`,
                cursor: "pointer",
              }}>{a}</button>
            ))}
          </div>
        ) : missing ? (
          <span style={{ fontSize: 11.5, color: TAG.danger, fontStyle: "italic" }}>required — pick a value</span>
        ) : (
          <TagPill k="" v={value} size={11} drift={drift} />
        )}
        {drift && !editing && (
          <span style={{ fontSize: 10.5, color: TAG.warn }}>
            drift · canonical is <Mono style={{ background: "#fff", padding: "0 3px", borderRadius: 2 }}>production</Mono>
          </span>
        )}
      </div>
      {!editing && (
        <Icon name="edit" size={11} color={TAG.muted} style={{ cursor: "pointer" }}
          onClick={() => setEditing(true)} />
      )}
    </div>
  );
}

Object.assign(window, { ResourceDetailArtboard });
