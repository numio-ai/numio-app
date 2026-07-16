// tags-copilot.jsx — Direction B: agent-first conversation with batch proposals
const { useState: useStateB } = React;

const CONVO = [
  { who: "user", t: "10:14", text: "What's missing on my production resources?" },
  { who: "ai", t: "10:14", body: "summary1" },
  { who: "ai", t: "10:15", body: "batch1" },
  { who: "user", t: "10:17", text: "Approve. Also fix the env:prod / env:production drift." },
  { who: "ai", t: "10:17", body: "batch2" },
];

function DirectionCopilot({ tweaks = {} }) {
  const [accepted, setAccepted] = useStateB(new Set());
  const [excluded, setExcluded] = useStateB(new Set());
  const [draft, setDraft] = useStateB("Tag all GPU instances missing ai-model with claude-3");

  return (
    <AppShell crumb="Tags / Co-pilot" actions={
      <>
        <Btn icon="list">Activity</Btn>
        <Btn icon="settings">Policies</Btn>
      </>
    }>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", height: "100%", minHeight: 0 }}>

        {/* CONVERSATION */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: `1px solid ${TAG.border}`, background: "#fdfdfc" }}>

          {/* Header */}
          <div style={{ padding: "16px 28px 12px", borderBottom: `1px solid ${TAG.border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 15,
              background: `linear-gradient(135deg, ${TAG.ai} 0%, #8b5cf6 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}>
              <Icon name="sparkle" size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Numio Tag Co-pilot</div>
              <div style={{ fontSize: 11, color: TAG.muted, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: TAG.success }} />
                <span>Watching 22 resources · 9 gaps detected this morning</span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <Btn ghost icon="refresh" style={{ color: TAG.muted }}>Re-scan</Btn>
          </div>

          {/* Convo body */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 8px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* user msg */}
            <Bubble who="user" t="10:14">What's missing on my production resources?</Bubble>

            {/* AI summary card */}
            <Bubble who="ai" t="10:14">
              <div style={{ fontSize: 12.5, color: TAG.text2, lineHeight: 1.55, marginBottom: 10 }}>
                I scanned <b>9 production resources</b> you own. Most are well-tagged — coverage is <b style={{ color: TAG.success }}>89%</b>. Two patterns stand out:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="Required gaps" value="6" tone="danger" sub="missing cost-center · project" />
                <Stat label="Value drift" value="1" tone="warn" sub="env: prod vs production" />
              </div>
            </Bubble>

            {/* batch proposal 1 */}
            <Bubble who="ai" t="10:15" wide>
              <ProposalCard
                title="Fill 4 EC2 instances missing cost-center"
                rationale="All four are owned by you and tagged team:engineering. Peer EC2s in the same project use CC-ENG."
                diff={{ key: "cost-center", from: null, to: "CC-ENG" }}
                resources={[
                  { id: "r-002", name: "web-api-prod-2", type: "EC2", spend: 4710 },
                  { id: "r-003", name: "auth-service-prod", type: "EC2", spend: 3120 },
                  { id: "r-009", name: "monitoring-prod", type: "EC2", spend: 240 },
                  { id: "r-011", name: "bastion-host", type: "EC2", spend: 142 },
                ]}
                excluded={excluded} setExcluded={setExcluded}
                accepted={accepted.has("b1")}
                onAccept={() => setAccepted(s => new Set([...s, "b1"]))}
              />
            </Bubble>

            {/* user msg */}
            <Bubble who="user" t="10:17">Approve. Also fix the env:prod / env:production drift.</Bubble>

            {/* batch 2 */}
            <Bubble who="ai" t="10:17" wide>
              <ProposalCard
                title="Normalize env: prod → production"
                rationale="The Numio policy canonicalizes env values. 1 EC2 currently uses the deprecated short form."
                diff={{ key: "env", from: "prod", to: "production" }}
                resources={[
                  { id: "r-011", name: "bastion-host", type: "EC2", spend: 142 },
                ]}
                excluded={excluded} setExcluded={setExcluded}
                accepted={accepted.has("b2")}
                onAccept={() => setAccepted(s => new Set([...s, "b2"]))}
                kind="drift"
              />
            </Bubble>
          </div>

          {/* Composer */}
          <div style={{ padding: "12px 28px 20px", borderTop: `1px solid ${TAG.border}`, background: "#fff" }}>
            <div style={{
              border: `1px solid ${TAG.border}`, borderRadius: 12,
              padding: "10px 12px", background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.03)",
            }}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                style={{
                  width: "100%", border: "none", resize: "none",
                  fontFamily: "inherit", fontSize: 13, color: TAG.text,
                  outline: "none", background: "transparent", padding: 0,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <ContextChip><Icon name="filter" size={10} color={TAG.muted}/> Scope: my resources</ContextChip>
                <ContextChip>Mode: propose, not apply</ContextChip>
                <div style={{ flex: 1 }} />
                <Btn ghost style={{ fontSize: 11, color: TAG.muted }}>⌘K</Btn>
                <Btn ai icon="arrow">Ask</Btn>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Suggestion>Tag everything in team:ml with cost-center:CC-ML</Suggestion>
              <Suggestion>Show me untagged resources over $100/mo</Suggestion>
              <Suggestion>Propose owner for resources missing one</Suggestion>
            </div>
          </div>
        </div>

        {/* RIGHT — context column */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: TAG.bg }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${TAG.border}`, background: "#fdfdfc" }}>
            <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>This conversation</div>
            <div style={{ fontSize: 13, color: TAG.text2, lineHeight: 1.5 }}>
              Touching <b style={{ color: TAG.text }}>5 resources</b> across <b style={{ color: TAG.text }}>2 batches</b>.
              <br /><span style={{ color: TAG.muted }}>Estimated impact: $8,354/mo brought into compliance.</span>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "14px 20px" }}>
            <SectionLabelB>Pending changes ({accepted.size})</SectionLabelB>
            {accepted.size === 0 ? (
              <div style={{
                border: `1px dashed ${TAG.border}`, borderRadius: 8,
                padding: "16px 14px", fontSize: 12, color: TAG.muted,
                textAlign: "center", background: "#fff",
              }}>
                Accept a proposal to queue changes.
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8 }}>
                {[...accepted].map((b, i) => (
                  <div key={b} style={{ padding: "10px 12px", borderTop: i ? `1px solid ${TAG.border}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="check" size={12} color={TAG.success} />
                    <span style={{ fontSize: 12, color: TAG.text2, flex: 1 }}>
                      {b === "b1" ? "Set cost-center on 4 resources" : "Normalize env on 1 resource"}
                    </span>
                    <span style={{ fontSize: 11, color: TAG.muted, fontVariantNumeric: "tabular-nums" }}>
                      {b === "b1" ? "4" : "1"}
                    </span>
                  </div>
                ))}
                <div style={{ padding: 10, borderTop: `1px solid ${TAG.border}`, display: "flex", gap: 6 }}>
                  <Btn primary style={{ flex: 1, justifyContent: "center" }}>Apply {accepted.size} batch{accepted.size>1?"es":""}</Btn>
                  <Btn ghost style={{ color: TAG.muted }}>Review diff</Btn>
                </div>
              </div>
            )}

            <SectionLabelB style={{ marginTop: 22 }}>Policy context</SectionLabelB>
            <div style={{ background: "#fff", border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Production minimum</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: TAG.success, background: TAG.successBg, padding: "1px 6px", borderRadius: 999, border: `1px solid #d1fae5` }}>ACTIVE</span>
              </div>
              <p style={{ fontSize: 11.5, color: TAG.muted, margin: "0 0 8px 0", lineHeight: 1.5 }}>
                env:production resources require env, team, cost-center, owner.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["env", "team", "cost-center", "owner"].map(k => <TagKeyPill key={k} k={k} size={10} />)}
              </div>
            </div>

            <SectionLabelB style={{ marginTop: 22 }}>Recent activity</SectionLabelB>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { t: "9:42", who: "Co-pilot", text: "Filled cost-center on 6 RDS instances", n: 6 },
                { t: "yesterday", who: "jchen", text: "Renamed tag service:auth-svc → auth", n: 12 },
                { t: "2d ago", who: "Co-pilot", text: "Detected drift on env (prod vs production)" },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 11.5, color: TAG.text2 }}>
                  <span style={{ color: TAG.xMuted, width: 56, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.t}</span>
                  <span style={{ color: TAG.text2 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Bubble({ who, t, children, wide }) {
  const isUser = who === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start", maxWidth: wide ? "92%" : "78%", alignSelf: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ fontSize: 10, color: TAG.xMuted, display: "flex", gap: 6 }}>
        <span style={{ fontWeight: 600, color: isUser ? TAG.text2 : TAG.ai2 }}>{isUser ? "jchen" : "Co-pilot"}</span>
        <span>{t}</span>
      </div>
      <div style={{
        background: isUser ? "#1f2024" : "#fff",
        color: isUser ? "#fff" : TAG.text,
        border: isUser ? "none" : `1px solid ${TAG.border}`,
        borderRadius: 12,
        padding: typeof children === "string" ? "10px 14px" : "14px 16px",
        fontSize: 13, lineHeight: 1.5,
        boxShadow: isUser ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.03)",
        width: wide ? "100%" : "auto",
      }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const color = tone === "danger" ? TAG.danger : tone === "warn" ? TAG.warn : TAG.text;
  return (
    <div style={{ border: `1px solid ${TAG.border}`, borderRadius: 8, padding: "8px 10px", background: TAG.bg }}>
      <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</span>
        <span style={{ fontSize: 11, color: TAG.muted }}>{sub}</span>
      </div>
    </div>
  );
}

function ProposalCard({ title, rationale, diff, resources, excluded, setExcluded, accepted, onAccept, kind = "fill" }) {
  const live = resources.filter(r => !excluded.has(r.id));
  const total = live.reduce((a, b) => a + b.spend, 0);
  const toggle = (id) => setExcluded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: kind === "drift" ? TAG.warn : TAG.ai2,
          background: kind === "drift" ? TAG.warnBg : TAG.aiBg,
          padding: "2px 7px", borderRadius: 999, letterSpacing: "0.06em",
        }}>{kind === "drift" ? "DRIFT FIX" : "BATCH"}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: TAG.text }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, color: TAG.muted, margin: "0 0 10px 0", lineHeight: 1.5 }}>{rationale}</p>

      {/* Diff bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#fafafa", border: `1px solid ${TAG.border}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 10,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
      }}>
        <TagKeyPill k={diff.key} size={11} />
        <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          {diff.from ? <TagPill k={diff.key} v={diff.from} size={11} style={{ opacity: 0.6, textDecoration: "line-through" }} /> : <span style={{ color: TAG.danger, fontSize: 11, fontStyle: "italic" }}>(missing)</span>}
          <Icon name="arrow" size={11} color={TAG.muted} />
          <TagPill k={diff.key} v={diff.to} size={11} />
        </span>
        <span style={{ fontSize: 10, color: TAG.xMuted, fontFamily: "Inter, sans-serif" }}>
          {live.length}/{resources.length} resources · ${total.toLocaleString()}/mo
        </span>
      </div>

      {/* Resource list */}
      <div style={{ border: `1px solid ${TAG.border}`, borderRadius: 8, overflow: "hidden" }}>
        {resources.map((r, i) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px", borderTop: i ? `1px solid ${TAG.border}` : "none",
            background: excluded.has(r.id) ? "#fafafa" : "#fff",
            opacity: excluded.has(r.id) ? 0.5 : 1,
            fontSize: 11.5,
          }}>
            <input type="checkbox" checked={!excluded.has(r.id)} onChange={() => toggle(r.id)} />
            <TypeChip t={r.type} />
            <span style={{ flex: 1, color: TAG.text2, textDecoration: excluded.has(r.id) ? "line-through" : "none" }}>{r.name}</span>
            <span style={{ fontSize: 10.5, color: TAG.xMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r.id}</span>
            <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: TAG.text2 }}>${r.spend.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn ai icon={accepted ? "check" : "sparkle"} onClick={onAccept} style={{ opacity: accepted ? 0.7 : 1 }}>
          {accepted ? "Accepted" : `Accept · queue ${live.length}`}
        </Btn>
        <Btn ghost style={{ color: TAG.muted }}>Refine</Btn>
        <Btn ghost style={{ color: TAG.muted }}>Dismiss</Btn>
      </div>
    </div>
  );
}

function ContextChip({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10.5, color: TAG.muted, background: TAG.surface,
      border: `1px solid ${TAG.border}`, borderRadius: 999,
      padding: "2px 8px",
    }}>{children}</span>
  );
}
function Suggestion({ children }) {
  return (
    <button style={{
      fontSize: 11, color: TAG.ai2, background: TAG.aiBg,
      border: `1px solid #e0e7ff`, borderRadius: 999,
      padding: "3px 10px", cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}
function SectionLabelB({ children, style }) {
  return <div style={{ fontSize: 10, color: TAG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 0", ...style }}>{children}</div>;
}

Object.assign(window, { DirectionCopilot });
