// tags-flows.jsx — Write flows, toasts, AI autonomy settings, search
const { useState: useStateFl } = React;

const FL = {
  border: "#efefef", borderStrong: "#e5e5e5",
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  bg: "#f7f7f7", surface: "#ffffff", surfaceMuted: "#fafafa",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  success: "#16a34a", successBg: "#f0fdf4",
  warn: "#d97706", warnBg: "#fffbeb",
  danger: "#dc2626", dangerBg: "#fef2f2",
};

// ============================================================
// 1. RISKY-WRITE CONFIRMATION (dry-run modal)
// Trigger: prod tag value OR >$1k/mo affected
// ============================================================
function RiskyWriteModal({ onClose }) {
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 620 }}>

        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${FL.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: FL.warnBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LIcon name="zap" size={14} color={FL.warn} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: FL.text, margin: 0 }}>Confirm — change affects production</h2>
          </div>
          <p style={{ fontSize: 12.5, color: FL.muted, margin: "0 0 0 38px", lineHeight: 1.5 }}>
            One of the resources you're editing is tagged <code style={inlineCodeF}>env:production</code>. Numio asks for confirmation on any write that touches prod or affects more than $1k/mo.
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 22px" }}>

          {/* What changes */}
          <SectionF>What will change</SectionF>
          <div style={{
            background: FL.surfaceMuted, border: `1px solid ${FL.border}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>
            <span style={tagKeyMini}>cost-center</span>
            <span style={{ color: FL.muted }}>:</span>
            <span style={{ color: FL.danger, textDecoration: "line-through", fontWeight: 500 }}>(missing)</span>
            <span style={{ color: FL.muted, fontSize: 11 }}>→</span>
            <span style={tagValMini}>CC-ENG</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: FL.muted }}>on 4 resources</span>
          </div>

          {/* Impact summary */}
          <SectionF>Impact</SectionF>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <ImpactBox label="Resources" value="4" />
            <ImpactBox label="Monthly spend" value="$12,790" tone="warn" />
            <ImpactBox label="Environments" value="prod (3) · stg (1)" small />
          </div>

          {/* Resource list */}
          <SectionF>Affected resources <span style={{ color: FL.muted, fontWeight: 400 }}>· 4</span></SectionF>
          <div style={{ border: `1px solid ${FL.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {[
              { id: "r-002", name: "web-api-prod-2", type: "EC2", env: "production", spend: 4710 },
              { id: "r-003", name: "auth-service-prod", type: "EC2", env: "production", spend: 3120 },
              { id: "r-009", name: "monitoring-prod", type: "EC2", env: "production", spend: 240 },
              { id: "r-005", name: "staging-api-01", type: "EC2", env: "staging", spend: 920 },
            ].map((r, i) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderTop: i ? `1px solid ${FL.border}` : "none",
                background: r.env === "production" ? "#fff8e6" : FL.surface,
              }}>
                <span style={typeMini}>{r.type}</span>
                <span style={{ fontSize: 12, color: FL.text2, flex: 1 }}>{r.name}</span>
                {r.env === "production" && <span style={{ fontSize: 10, fontWeight: 600, color: FL.warn, background: FL.warnBg, border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 3 }}>PROD</span>}
                <span style={{ fontSize: 11, color: FL.muted, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}>${r.spend.toLocaleString()}/mo</span>
              </div>
            ))}
          </div>

          {/* Audit note */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: FL.muted, padding: "8px 0" }}>
            <LIcon name="shield" size={12} color={FL.muted} strokeWidth={1.75} />
            <span>Logged to audit log as <b style={{ color: FL.text2 }}>James C. · tag.set</b> · revertible from <a href="#" style={{ color: FL.ai2, textDecoration: "none" }}>/govern/audit</a></span>
          </div>
        </div>

        <div style={{ padding: "12px 22px", borderTop: `1px solid ${FL.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: FL.muted, cursor: "pointer" }}>
            <input type="checkbox" /> Don't ask again for cost-center on this team
          </label>
          <div style={{ flex: 1 }} />
          <button style={btnGhostF} onClick={onClose}>Cancel</button>
          <button style={btnPrimaryF}>Apply to 4 resources</button>
        </div>
      </div>
    </div>
  );
}

function ImpactBox({ label, value, tone, small }) {
  const color = tone === "warn" ? FL.warn : tone === "danger" ? FL.danger : FL.text;
  return (
    <div style={{ background: FL.surfaceMuted, border: `1px solid ${FL.border}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: FL.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 18, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

// ============================================================
// 2. PARTIAL FAILURE TOAST (47/50 applied)
// ============================================================
function PartialFailureToast() {
  return (
    <div style={{
      position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
      width: 460, background: "#1f2024", color: "#fff",
      borderRadius: 12, padding: "12px 14px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
      fontFamily: "Inter, system-ui, sans-serif", zIndex: 40,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 14,
          background: "rgba(217,119,6,0.18)", color: FL.warn,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <LIcon name="zap" size={14} color="#fbbf24" strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Applied 47 of 50 tag changes</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)" }}>
            3 failed · permission denied on 2 EC2 instances, rate limit on 1 Lambda
          </div>
        </div>
        <button style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }}>
          <LIcon name="x" size={14} color="rgba(255,255,255,0.5)" />
        </button>
      </div>

      {/* progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 9999, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: "94%", height: "100%", background: FL.warn, borderRadius: 9999 }} />
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button style={{
          flex: 1, padding: "6px 10px",
          background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 6,
          fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>View details in audit log →</button>
        <button style={{
          padding: "6px 10px",
          background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", borderRadius: 6,
          fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>Retry 3 failed</button>
      </div>
    </div>
  );
}

// ============================================================
// 3. UNDO TOAST (5-min window)
// ============================================================
function UndoToast() {
  return (
    <div style={{
      position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
      width: 420, background: "#1f2024", color: "#fff",
      borderRadius: 12, padding: "10px 8px 10px 14px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
      fontFamily: "Inter, system-ui, sans-serif", zIndex: 40,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: "rgba(22,163,74,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ color: "#86efac", fontSize: 13, fontWeight: 700 }}>✓</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13 }}>
          Set <code style={undoCode}>cost-center:CC-ENG</code> on 4 resources
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Undo available for <b style={{ color: "#fff" }}>4:48</b></div>
      </div>
      <button style={{
        padding: "5px 12px",
        background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", borderRadius: 6,
        fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}>Undo</button>
      <button style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }}>
        <LIcon name="x" size={13} color="rgba(255,255,255,0.5)" />
      </button>
    </div>
  );
}

// ============================================================
// 4. AI AUTONOMY SETTINGS PANEL
// Reachable from sliders icon on top bar OR /tag-governance settings
// ============================================================
function AIAutonomyPanel() {
  const [level, setLevel] = useStateFl("auto-safe");
  return (
    <div style={{
      width: "100%", height: "100%", background: FL.surface,
      padding: "24px 28px", overflow: "auto",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <LIcon name="sparkles" size={16} color={FL.ai2} strokeWidth={1.75} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: FL.text, margin: 0 }}>How autonomous should Numio be?</h2>
        </div>
        <p style={{ fontSize: 12.5, color: FL.muted, margin: 0, lineHeight: 1.5 }}>
          Sets the default for tag suggestions and auto-fixes. You can always override per-resource.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        <AutonomyLevel
          id="suggest" current={level} onSelect={setLevel}
          icon="messageSquare" title="Suggest only" tag="MANUAL"
          desc="Numio proposes diffs in the chat panel and inline; you click Accept on each. No autonomous writes."
          example="• Inline 'Suggest' chips never auto-apply" />
        <AutonomyLevel
          id="auto-safe" current={level} onSelect={setLevel}
          icon="sparkles" title="Auto-fix safe" tag="RECOMMENDED" recommended
          desc="Numio applies obvious fixes (drift normalization, peer-inferred values >90% confidence) automatically. You see them as notifications and can undo within 5 minutes."
          example={"• env: prod → production · auto-fixed\n• cost-center on dev resources (peer match) · auto-fixed\n• Anything affecting prod or >$1k/mo · still requires confirm"} />
        <AutonomyLevel
          id="autopilot" current={level} onSelect={setLevel}
          icon="bot" title="Autopilot for new resources" tag="POWER USER"
          desc="When a new resource appears in your cloud accounts, Numio auto-tags it using the schema before it costs anything. Existing safe-fixes still apply."
          example="• New EC2 instance launched at 14:23 → tagged with team:engineering, env:dev within 60s" />
      </div>

      {/* Scope */}
      <div style={{ borderTop: `1px solid ${FL.border}`, paddingTop: 16 }}>
        <SectionF>Scope</SectionF>
        <ScopeRow label="Apply autonomy to" value="All accounts" />
        <ScopeRow label="Exclude" value="env:production resources" desc="Production always requires confirmation regardless of level" />
        <ScopeRow label="Confidence threshold" value="90% peer match" desc="Lower this to apply more suggestions automatically; raise it to be more conservative" />
      </div>

      {/* Recent actions */}
      <div style={{ borderTop: `1px solid ${FL.border}`, marginTop: 18, paddingTop: 16 }}>
        <SectionF>Recent autonomous actions <span style={{ color: FL.muted, fontWeight: 400 }}>· last 7d</span></SectionF>
        <div style={{ background: FL.surfaceMuted, border: `1px solid ${FL.border}`, borderRadius: 8 }}>
          <RecentAction text="Filled cost-center on 6 RDS instances" when="2h ago" />
          <RecentAction text="Normalized env: prod → production on 4 EC2 instances" when="yesterday" />
          <RecentAction text="Tagged 2 new GPU instances with team:ml-platform" when="3d ago" />
        </div>
        <p style={{ fontSize: 11.5, color: FL.muted, marginTop: 8 }}>
          Full history in <a href="#" style={{ color: FL.ai2, textDecoration: "none" }}>/govern/audit</a>.
        </p>
      </div>
    </div>
  );
}

function AutonomyLevel({ id, current, onSelect, icon, title, tag, recommended, desc, example }) {
  const selected = current === id;
  return (
    <div onClick={() => onSelect(id)} style={{
      border: `1px solid ${selected ? FL.ai2 : FL.border}`,
      background: selected ? FL.aiBg : FL.surface,
      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        border: `1.5px solid ${selected ? FL.ai2 : FL.borderStrong}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
      }}>
        {selected && <div style={{ width: 9, height: 9, borderRadius: 5, background: FL.ai2 }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <LIcon name={icon} size={13} color={selected ? FL.ai2 : FL.muted} strokeWidth={1.75} />
          <span style={{ fontSize: 13, fontWeight: 600, color: FL.text }}>{title}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
            color: recommended ? FL.success : FL.muted,
            background: recommended ? FL.successBg : FL.surfaceMuted,
            border: `1px solid ${recommended ? "#d1fae5" : FL.border}`,
            padding: "1px 5px", borderRadius: 3,
          }}>{tag}</span>
        </div>
        <p style={{ fontSize: 12, color: FL.text2, margin: "0 0 6px", lineHeight: 1.5 }}>{desc}</p>
        <pre style={{
          margin: 0, padding: "8px 10px",
          background: FL.surfaceMuted, border: `1px solid ${FL.border}`,
          borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: FL.muted, whiteSpace: "pre-wrap", lineHeight: 1.5,
        }}>{example}</pre>
      </div>
    </div>
  );
}

function ScopeRow({ label, value, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: `1px solid ${FL.border}` }}>
      <span style={{ width: 160, fontSize: 12, color: FL.muted, flexShrink: 0, paddingTop: 4 }}>{label}</span>
      <div style={{ flex: 1 }}>
        <button style={{
          fontSize: 12, color: FL.text, background: FL.surface,
          border: `1px solid ${FL.border}`, borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          {value}
          <LIcon name="chevronDown" size={11} color={FL.muted} />
        </button>
        {desc && <p style={{ fontSize: 11, color: FL.xMuted, margin: "4px 0 0", lineHeight: 1.4 }}>{desc}</p>}
      </div>
    </div>
  );
}
function RecentAction({ text, when }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${FL.border}` }}>
      <LIcon name="sparkles" size={11} color={FL.ai2} strokeWidth={2} />
      <span style={{ fontSize: 12, color: FL.text2, flex: 1 }}>{text}</span>
      <span style={{ fontSize: 11, color: FL.xMuted }}>{when}</span>
      <button style={{ background: "transparent", border: "none", color: FL.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Undo</button>
    </div>
  );
}

// ============================================================
// 5. NATURAL LANGUAGE SEARCH DROPDOWN
// Triggered by typing in the page-level search box. Parses query into chips.
// ============================================================
function SearchDropdown() {
  return (
    <div style={{
      position: "absolute", top: 132, left: 24, width: 540, zIndex: 30,
      background: FL.surface, border: `1px solid ${FL.borderStrong}`,
      borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
      overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* Search input */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${FL.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <LIcon name="sparkles" size={14} color={FL.ai2} strokeWidth={1.75} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: FL.text,
          flex: 1,
        }}>show idle prod resources owned by jchen<span style={{ background: FL.text, color: FL.text, marginLeft: 2, width: 2, height: 14, display: "inline-block", verticalAlign: "middle", animation: "blink 1s steps(2) infinite" }}>&nbsp;</span></span>
        <kbd style={kbdF}>↵</kbd>
      </div>

      {/* Parsed query */}
      <div style={{ padding: "10px 14px", background: FL.aiBg, borderBottom: `1px solid ${FL.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: FL.ai2, textTransform: "uppercase", letterSpacing: "0.08em" }}>Numio understood</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <ParsedChip label="status" v="idle" />
          <ParsedChip label="env" v="production" tagKey />
          <ParsedChip label="owner" v="jchen@acme.com" tagKey />
        </div>
        <p style={{ fontSize: 11, color: FL.muted, margin: "8px 0 0", lineHeight: 1.4 }}>
          Matches <b style={{ color: FL.text }}>3 resources</b> · ${(4710 + 3120 + 240).toLocaleString()}/mo combined
        </p>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 280, overflow: "auto" }}>
        <ResultGroup title="Resources · 3 matches">
          <ResultRow icon="server" name="web-api-prod-2" sub="EC2 · us-east-1 · $4,710/mo · 14% util" />
          <ResultRow icon="server" name="auth-service-prod" sub="EC2 · us-east-1 · $3,120/mo · 8% util" />
          <ResultRow icon="server" name="monitoring-prod" sub="EC2 · us-east-1 · $240/mo · 3% util" />
        </ResultGroup>
        <ResultGroup title="Tag values · 1 match">
          <ResultRow icon="tags" name="owner:jchen@acme.com" sub="Used on 12 resources total" />
        </ResultGroup>
        <ResultGroup title="Saved searches">
          <ResultRow icon="filter" name="Untagged prod resources" sub="Saved by James C. · 2 days ago" />
        </ResultGroup>
      </div>

      <div style={{ padding: "8px 14px", borderTop: `1px solid ${FL.border}`, display: "flex", alignItems: "center", gap: 8, background: FL.surfaceMuted }}>
        <span style={{ fontSize: 11, color: FL.muted }}>
          <kbd style={kbdF}>↵</kbd> apply filter · <kbd style={kbdF}>⌘↵</kbd> open in chat · <kbd style={kbdF}>esc</kbd> close
        </span>
        <div style={{ flex: 1 }} />
        <button style={{ ...btnGhostF, padding: "3px 8px", fontSize: 11 }}>Save search</button>
      </div>
    </div>
  );
}

function ParsedChip({ label, v, tagKey }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
      background: FL.surface, border: `1px solid ${tagKey ? "#e9e3ff" : FL.border}`,
      borderRadius: 4, padding: "2px 6px", color: FL.text2,
    }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ opacity: 0.4 }}>:</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </span>
  );
}

function ResultGroup({ title, children }) {
  return (
    <div>
      <div style={{ padding: "6px 14px", fontSize: 10, fontWeight: 600, color: FL.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", background: FL.surfaceMuted, borderBottom: `1px solid ${FL.border}` }}>{title}</div>
      {children}
    </div>
  );
}
function ResultRow({ icon, name, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: `1px solid ${FL.border}`, cursor: "pointer" }}>
      <LIcon name={icon} size={13} color={FL.muted} strokeWidth={1.75} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: FL.text, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 10.5, color: FL.xMuted }}>{sub}</div>
      </div>
    </div>
  );
}

// inject blink keyframes once
if (typeof document !== "undefined" && !document.getElementById("__tag_blink")) {
  const s = document.createElement("style");
  s.id = "__tag_blink";
  s.textContent = "@keyframes blink { 50% { opacity: 0 } }";
  document.head.appendChild(s);
}

// ============================================================
// 6. RECENT CHANGES INLINE STRIP (footer of heatmap)
// ============================================================
function RecentChangesStrip() {
  return (
    <div style={{
      padding: "10px 24px", borderTop: `1px solid ${FL.border}`,
      background: FL.surface, display: "flex", alignItems: "center", gap: 16,
      fontFamily: "Inter, system-ui, sans-serif", fontSize: 12,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: FL.xMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent changes</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
        <ChangeItem who="James C." text="set cost-center on 4 EC2" t="2m" />
        <Sep />
        <ChangeItem who="Autopilot" text="normalized env on bastion-host" t="14m" ai />
        <Sep />
        <ChangeItem who="Autopilot" text="filled cost-center on 6 RDS" t="2h" ai />
      </div>
      <a href="#" style={{ fontSize: 11.5, color: FL.ai2, textDecoration: "none" }}>View full audit log →</a>
    </div>
  );
}
function ChangeItem({ who, text, t, ai }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: FL.text2 }}>
      {ai && <LIcon name="sparkles" size={10} color={FL.ai2} strokeWidth={2} />}
      <b style={{ color: FL.text2, fontWeight: 500 }}>{who}</b>
      <span style={{ color: FL.muted }}>{text}</span>
      <span style={{ color: FL.xMuted, fontSize: 11 }}>{t}</span>
    </span>
  );
}
function Sep() {
  return <span style={{ color: FL.xMuted, fontSize: 11 }}>·</span>;
}

// ---------- atoms ----------
const modalBackdrop = {
  position: "absolute", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 50,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "Inter, system-ui, sans-serif",
};
const modalCard = {
  background: FL.surface, borderRadius: 12,
  boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
  display: "flex", flexDirection: "column", maxHeight: "90%",
};
function SectionF({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: FL.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{children}</div>;
}
const btnPrimaryF = {
  background: FL.text, color: "#fff", border: "none", borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
};
const btnGhostF = {
  background: FL.surface, color: FL.text2, border: `1px solid ${FL.border}`,
  borderRadius: 6, fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
};
const inlineCodeF = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  background: FL.aiBg, color: FL.ai2, padding: "1px 5px", borderRadius: 3,
};
const tagKeyMini = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 500,
  background: "#f3f0ff", color: FL.text, border: "1px solid #e9e3ff",
  padding: "1px 6px", borderRadius: 4,
};
const tagValMini = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 500,
  background: FL.successBg, color: "#047857", border: "1px solid #d1fae5",
  padding: "1px 6px", borderRadius: 4,
};
const typeMini = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
  background: "#fff7ed", color: "#c2410c",
  padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em",
};
const undoCode = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  background: "rgba(255,255,255,0.1)", color: "#fff",
  padding: "1px 5px", borderRadius: 3,
};
const kbdF = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
  background: FL.surface, color: FL.muted, border: `1px solid ${FL.border}`,
  padding: "1px 5px", borderRadius: 3, lineHeight: 1.2,
};

Object.assign(window, {
  RiskyWriteModal, PartialFailureToast, UndoToast,
  AIAutonomyPanel, SearchDropdown, RecentChangesStrip,
});
