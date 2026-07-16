// page-recommendations.jsx — IA v2 — iteration 2.
// Changes:
//   (1) Banner removed; savings folded into page subtitle.
//   (2) Each recommendation is expandable inline with full evidence:
//       signals · affected resources sample · what will happen · risk.
//   (3) "View all N affected →" deep-links into Resources with a
//       rec-scoped filter.
//   (4) "Send to Autopilot" opens a confirmation modal that re-states
//       the evidence, shows the rule in human-readable form, lists
//       safety properties, and offers a dry-run-first option.
//   (5) "Apply once" stays direct (low-stakes); modal only for
//       enabling recurring automation.

// ============================================================
// Data
// ============================================================

// Rich data for the demo "expanded" card.
const R201 = {
  id: "r-201",
  title: "Hibernate 142 idle dev/sandbox resources nightly",
  category: "Idle resource",
  scope: "aws://dev/* + gcp://sandbox/*",
  saving: 11_820,
  effort: "Low", confidence: "High",
  autopilot: true, source: "ai",
  affectedCount: 142,
  signals: [
    "142 resources averaged <2% CPU for 14 consecutive nights (8pm–6am local).",
    "Tagged owners' last activity > 9 days ago.",
    "No active incidents or PR pushes affecting these resources in the last 14 days.",
    "Tag Governance flagged 6 production-adjacent resources — auto-excluded.",
  ],
  sample: [
    { name: "ml-train-worker-04",      svc: "EC2",       type: "g5.12xlarge",   spend: 3120, idle: "14/14 nights" },
    { name: "data-eda-3",              svc: "EC2",       type: "m6i.4xlarge",   spend: 980,  idle: "14/14 nights" },
    { name: "k8s-dev-cluster-2",       svc: "EKS",       type: "t3.large × 8",  spend: 620,  idle: "13/14 nights" },
    { name: "analytics-dev-warehouse", svc: "Redshift",  type: "ra3.xl × 2",    spend: 480,  idle: "14/14 nights" },
    { name: "jupyter-dev-04",          svc: "EC2",       type: "m6i.2xlarge",   spend: 324,  idle: "14/14 nights" },
  ],
  remainingCount: 137,
  remainingSpend: 6_296,
  whatHappens: [
    "Stops EC2 / EKS / Redshift instances at 8pm local time when CPU has been <2% for 4+ hours.",
    "Resumes on next PR push to the resource's repository or at 6am local — whichever comes first.",
    "Reversible: any user can manually resume from the dashboard. Volumes and data are preserved.",
  ],
  exclusions: "6 resources tagged production-adjacent by Tag Governance are excluded from this rule.",
  manualRemediation: {
    note: "Prefer Send to Autopilot for nightly enforcement. To apply once manually:",
    cmd: "$ numio actions hibernate \\\n    --filter \"env IN (dev,sandbox) AND cpu < 2% for 4h\" \\\n    --exclude \"tag:criticality = production-adjacent\" \\\n    --dry-run",
  },
  risk: { level: "low", text: "No production traffic on affected fleet. Worst case: cold-start delay on resume (≈45s for EC2, ≈2min for EKS)." },
  rule: [
    { kw: "WHEN", expr: "env IN (dev, sandbox)" },
    { kw: "",    expr: "AND CPU < 2% for 4h" },
    { kw: "",    expr: "AND time > 8pm local" },
    { kw: "DO",   expr: "stop_instance" },
    { kw: "THEN", expr: "resume_on PR_push OR time = 6am" },
    { kw: "EXCEPT", expr: "tag:criticality = production-adjacent" },
  ],
  safety: [
    "Reversible by any user within 7 days; resource state restored exactly.",
    "Stops are idempotent — no-op for already-stopped resources.",
    "First 3 runs flagged for manual review; emails owner before action.",
    "Hard cap: 200 resources stopped per run, halts on >5% failure rate.",
  ],
};

// Compact recommendations (no expansion content).
const REC_LIST = [
  { id: "r-198", title: "Block merge: PR #4821 projects +23% us-east-1 cost",
    scope: "github://payments/service-ledger", category: "PR cost regression",
    saving: 4310, effort: "Low", confidence: "High", autopilot: true, source: "ai",
    affectedCount: 1 },
  { id: "r-195", title: "Switch Doc Summarizer to GPT-3.5 Turbo batch",
    scope: "openai://doc-summarizer", category: "Model switch",
    saving: 620, effort: "Low", confidence: "High", autopilot: false, source: "ai",
    affectedCount: 1 },
  { id: "r-192", title: "Reclaim 38 unattached EBS volumes (avg age 41d)",
    scope: "aws://prod/storage", category: "Orphan reclaim",
    saving: 612, effort: "Low", confidence: "Medium", autopilot: true, source: "rule",
    affectedCount: 38 },
  { id: "r-189", title: "Consolidate ML Training jobs to off-peak",
    scope: "aws://ml/training", category: "Scheduling",
    saving: 480, effort: "Medium", confidence: "Medium", autopilot: false, source: "ai",
    affectedCount: 6 },
  { id: "r-184", title: "Negotiate volume discount with OpenAI",
    scope: "openai://*", category: "Procurement",
    saving: 678, effort: "Medium", confidence: "Low", autopilot: false, source: "ai",
    affectedCount: null /* not resource-based */ },
  { id: "r-180", title: "Move logs archive to S3 Glacier Instant Retrieval",
    scope: "aws://prod/logs", category: "Storage tier",
    saving: 240, effort: "Medium", confidence: "High", autopilot: false, source: "rule",
    affectedCount: 12 },
];

const REC_CATEGORIES = ["All", "Idle resource", "Orphan reclaim", "Rightsizing", "Model switch", "Storage tier", "Scheduling", "Procurement", "PR cost regression"];

// Saved views — same model as Usage / Resources. "Zombie Hunter" is
// the merged-in destination from the deprecated Zombie Hunter page.
const REC_SAVED_VIEWS = [
  { id: "all",     label: "All recommendations",  owner: "shared", note: "Everything ranked by impact" },
  { id: "zombie",  label: "Zombie Hunter",        owner: "shared", note: "Idle & orphaned resources costing you money" },
  { id: "ai-ready", label: "Autopilot-ready",     owner: "shared", note: "Low-effort, high-confidence, automatable" },
  { id: "high-impact", label: "$1k/mo and up",    owner: "you" },
  { id: "this-week", label: "Generated this week", owner: "shared" },
  { id: "my-team", label: "My team",              owner: "you" },
];

// ============================================================
// Atoms
// ============================================================
const RC = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
};

function Chip({ children, tone = "neutral" }) {
  const p = {
    neutral: { c: "#374151", bg: "#f3f4f6", b: RC.border },
    ai:      { c: RC.ai2,    bg: RC.aiBg,    b: RC.aiBd },
    auto:    { c: RC.good,   bg: RC.goodBg,  b: RC.goodBd },
  }[tone];
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, color: p.c,
      background: p.bg, border: `1px solid ${p.b}`,
      padding: "2px 8px", borderRadius: 4,
    }}>{children}</span>
  );
}

function MetaInline({ r }) {
  const effortColor = r.effort === "Low" ? RC.good : r.effort === "Medium" ? RC.warn : RC.danger;
  return (
    <span style={{ fontSize: 11, color: RC.xMuted, fontFamily: "JetBrains Mono, monospace" }}>
      {r.scope}  ·  effort <span style={{ color: effortColor, fontWeight: 600 }}>{r.effort.toLowerCase()}</span>  ·  confidence {r.confidence.toLowerCase()}
      {r.affectedCount != null && <>  ·  affects {r.affectedCount} resource{r.affectedCount === 1 ? "" : "s"}</>}
    </span>
  );
}

// ============================================================
// Compact card (collapsed)
// ============================================================
function RecCardCompact({ r, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      background: RC.surface, border: `1px solid ${RC.border}`,
      borderRadius: 10, padding: "12px 16px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
    }}>
      <span style={{ color: RC.xMuted, fontSize: 12, width: 14, transition: "transform 120ms" }}>▸</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <Chip>{r.category}</Chip>
          {r.source === "ai" && <Chip tone="ai">✨ AI</Chip>}
          {r.autopilot && <Chip tone="auto">Autopilot-eligible</Chip>}
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: RC.text, margin: 0 }}>{r.title}</p>
        <p style={{ margin: "3px 0 0" }}><MetaInline r={r} /></p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: RC.good, margin: 0 }}>${r.saving.toLocaleString()}/mo</p>
        <span style={{ fontSize: 11, color: RC.xMuted }}>Click to see evidence</span>
      </div>
    </div>
  );
}

// ============================================================
// Expanded card with full evidence
// ============================================================
function RecCardExpanded({ r, onToggle, onAutopilot }) {
  return (
    <div style={{
      background: RC.surface, border: `1px solid ${RC.border}`,
      borderRadius: 10, marginBottom: 8, overflow: "hidden",
    }}>
      {/* Header (clickable to collapse) */}
      <div onClick={onToggle} style={{
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
        background: "#fafafa", borderBottom: `1px solid ${RC.border}`,
      }}>
        <span style={{ color: RC.xMuted, fontSize: 12, width: 14, transform: "rotate(90deg)" }}>▸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <Chip>{r.category}</Chip>
            {r.source === "ai" && <Chip tone="ai">✨ AI</Chip>}
            {r.autopilot && <Chip tone="auto">Autopilot-eligible</Chip>}
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: RC.text, margin: 0 }}>{r.title}</p>
          <p style={{ margin: "3px 0 0" }}><MetaInline r={r} /></p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: RC.good, margin: 0 }}>${r.saving.toLocaleString()}/mo</p>
        </div>
      </div>

      {/* Evidence body */}
      <div style={{ padding: "16px 20px 18px" }}>
        {/* Signals */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...secLabel }}>Signals detected</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 13, color: RC.text2, lineHeight: 1.55 }}>
            {r.signals.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
          </ul>
        </div>

        {/* Affected resources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <p style={{ ...secLabel, marginBottom: 0 }}>Affected resources</p>
            <a style={{ fontSize: 12, color: RC.ai2, fontWeight: 500 }}>View all {r.affectedCount} in Resources →</a>
          </div>
          <div style={{ border: `1px solid ${RC.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 90px 150px 90px 110px",
              gap: 12, padding: "8px 12px",
              background: "#fafafa", borderBottom: `1px solid ${RC.border}`,
              fontSize: 10, fontWeight: 500, color: RC.xMuted, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span>NAME</span><span>SERVICE</span><span>TYPE</span><span style={{ textAlign: "right" }}>SPEND/MO</span><span>IDLE PATTERN</span>
            </div>
            {r.sample.map((s, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 90px 150px 90px 110px",
                gap: 12, padding: "8px 12px",
                borderBottom: i < r.sample.length - 1 ? "1px solid #f3f4f6" : "none",
                fontSize: 12, color: RC.text,
              }}>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                <span style={{ color: RC.muted }}>{s.svc}</span>
                <span style={{ color: RC.muted }}>{s.type}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>${s.spend.toLocaleString()}</span>
                <span style={{ color: RC.muted }}>{s.idle}</span>
              </div>
            ))}
            <div style={{
              padding: "8px 12px", background: "#fafafa",
              fontSize: 12, color: RC.muted,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>… {r.remainingCount} more affected resources</span>
              <span style={{ fontWeight: 600, color: RC.text2 }}>${r.remainingSpend.toLocaleString()}/mo combined</span>
            </div>
          </div>
        </div>

        {/* Side-by-side: What happens / Risk */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <p style={{ ...secLabel }}>What will happen</p>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 13, color: RC.text2, lineHeight: 1.55 }}>
              {r.whatHappens.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
            </ul>
            <p style={{ fontSize: 12, color: RC.muted, marginTop: 8 }}>
              <span style={{ fontWeight: 600, color: RC.text2 }}>Exclusions: </span>{r.exclusions}
            </p>
          </div>
          <div>
            <p style={{ ...secLabel }}>Risk</p>
            <div style={{
              marginTop: 6, padding: "10px 12px",
              background: RC.goodBg, border: `1px solid ${RC.goodBd}`, borderRadius: 8,
              fontSize: 12, color: RC.text2,
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: RC.good, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: RC.good }} />
                Low
              </p>
              <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>{r.risk.text}</p>
            </div>
          </div>
        </div>

        {/* Manual remediation — the old "Zombie Hunter CLI" pattern, now a
            standard evidence section. Shown whenever a rec exposes a
            one-liner alternative to the Autopilot rule. */}
        {r.manualRemediation && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...secLabel }}>Manual remediation</p>
            <p style={{ fontSize: 12, color: RC.muted, margin: "6px 0 6px" }}>{r.manualRemediation.note}</p>
            <div style={{
              background: "#0f172a", color: "#e2e8f0",
              borderRadius: 8, padding: "10px 14px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.6,
              whiteSpace: "pre",
              overflowX: "auto",
            }}>
              {r.manualRemediation.cmd}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${RC.border}` }}>
          <button style={btnGhost}>Dismiss</button>
          <button style={btnGhost}>Snooze 7 days</button>
          <span style={{ flex: 1 }} />
          <a style={{ fontSize: 12, color: RC.muted, marginRight: 8 }}>View full audit trail →</a>
          <button style={btnSecondary}>Apply once</button>
          <button onClick={onAutopilot} style={btnPrimary}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>Send to Autopilot</span>
              <span style={{ opacity: 0.7 }}>→</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const secLabel = {
  fontSize: 10, fontWeight: 600, color: RC.xMuted,
  textTransform: "uppercase", letterSpacing: "0.08em",
  margin: 0,
};
const btnGhost = {
  fontSize: 12, color: RC.muted, background: RC.surface,
  border: `1px solid ${RC.border}`, borderRadius: 6, padding: "6px 12px",
};
const btnSecondary = {
  fontSize: 12, color: RC.text, background: RC.surface, fontWeight: 500,
  border: `1px solid ${RC.text}`, borderRadius: 6, padding: "6px 12px",
};
const btnPrimary = {
  fontSize: 12, color: "#fff", background: RC.text, fontWeight: 500,
  border: "none", borderRadius: 6, padding: "6px 14px",
};

// ============================================================
// Send-to-Autopilot confirmation modal
// ============================================================
function AutopilotConfirmModal({ rec, onClose }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: "rgba(17, 24, 39, 0.35)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 40,
    }}>
      <div style={{
        width: 620, maxWidth: "calc(100% - 40px)",
        maxHeight: "calc(100% - 80px)", overflow: "auto",
        background: RC.surface, border: `1px solid ${RC.border}`,
        borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${RC.border}`,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: RC.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Send to Autopilot</p>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: RC.text, margin: "4px 0 0" }}>Enable a recurring automated action</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: RC.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Action summary */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${RC.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: RC.text, margin: 0 }}>{rec.title}</p>
          <p style={{ fontSize: 13, color: RC.muted, margin: "4px 0 0" }}>
            Reduces spend by <b style={{ color: RC.good }}>${rec.saving.toLocaleString()}/mo</b>
            <span style={{ color: RC.xMuted }}> · </span>
            {rec.affectedCount} resources<span style={{ color: RC.xMuted }}> · </span>
            scope <code style={{ fontFamily: "JetBrains Mono, monospace", background: "#f3f4f6", padding: "1px 6px", borderRadius: 3 }}>{rec.scope}</code>
          </p>
        </div>

        {/* Evidence checklist */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${RC.border}` }}>
          <p style={{ ...secLabel, marginBottom: 6 }}>Evidence</p>
          {[
            "142 resources idle 14/14 recent nights (<2% CPU)",
            "Last owner activity > 9 days; no active incidents",
            "No PR pushes against affected resources in 14 days",
            "6 production-adjacent resources excluded by Tag Governance",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 13, color: RC.text2 }}>
              <span style={{ color: RC.good, marginTop: 1 }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        {/* Rule preview */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${RC.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ ...secLabel, marginBottom: 0 }}>Rule (editable in Autopilot)</p>
            <a style={{ fontSize: 11, color: RC.ai2, fontWeight: 500 }}>Open rule editor →</a>
          </div>
          <div style={{
            background: "#0f172a", color: "#e2e8f0",
            borderRadius: 8, padding: "10px 14px",
            fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.7,
          }}>
            {rec.rule.map((line, i) => (
              <div key={i}>
                {line.kw && <span style={{ color: "#a5b4fc", fontWeight: 600, width: 74, display: "inline-block" }}>{line.kw}</span>}
                {!line.kw && <span style={{ width: 74, display: "inline-block" }}></span>}
                <span>{line.expr}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${RC.border}` }}>
          <p style={{ ...secLabel, marginBottom: 6 }}>Safety properties</p>
          {rec.safety.map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 13, color: RC.text2 }}>
              <span style={{ color: RC.good }}>●</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        {/* Dry-run + footer actions */}
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: RC.text2, cursor: "pointer" }}>
            <span style={{
              width: 14, height: 14, borderRadius: 3,
              border: `1px solid ${RC.text}`, background: RC.text,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 10,
            }}>✓</span>
            Run a 7-night dry-run first (recommended)
          </label>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Approve and enable</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Saved-views picker — mirrors the Usage / Resources pattern.
// ============================================================
function RecViewsPicker({ activeId, open, onToggle }) {
  const active = REC_SAVED_VIEWS.find((v) => v.id === activeId) || REC_SAVED_VIEWS[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", fontSize: 13,
        background: open ? "#f3f4f6" : RC.surface,
        border: `1px solid ${RC.border}`, borderRadius: 6,
        color: RC.text, fontWeight: 500,
      }}>
        <span style={{ color: RC.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: RC.xMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 340,
          background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: RC.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button style={{ fontSize: 11, color: RC.muted, background: "transparent", border: "none", padding: "2px 6px" }}>+ Save current</button>
          </div>
          {REC_SAVED_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: on ? "#f3f4f6" : "transparent",
              }}>
                <span style={{ width: 14, color: RC.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: RC.text, fontWeight: on ? 500 : 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {v.label}
                    {v.id === "zombie" && <span title="Replaces the old Zombie Hunter page" style={{ fontSize: 10, color: RC.ai2, background: RC.aiBg, border: `1px solid ${RC.aiBd}`, padding: "1px 6px", borderRadius: 9 }}>preset</span>}
                  </div>
                  <div style={{ fontSize: 11, color: RC.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button title="Copy link" style={{
                  width: 26, height: 26, padding: 0,
                  background: "transparent", border: "none", borderRadius: 4,
                  color: RC.muted, display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
                <button style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: RC.muted, fontSize: 16, lineHeight: 1 }}>⋯</button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: RC.muted, background: "transparent", border: "none", borderRadius: 6 }}>
            Manage all views…
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
function RecommendationsPage({ initialExpandedId = "r-201", showAutopilotModal: forceModal = false }) {
  const [expandedId, setExpandedId] = React.useState(initialExpandedId);
  const [modalOpen, setModalOpen] = React.useState(forceModal);
  const [viewsOpen, setViewsOpen] = React.useState(false);

  const total = R201.saving + REC_LIST.reduce((a, b) => a + b.saving, 0);
  const all = [{ ...R201, _full: true }, ...REC_LIST];

  return (
    <div style={{
      padding: 32, maxWidth: 1100,
      background: "#f9fafb",
      width: "100%", minHeight: "100%",
      fontFamily: "Inter, system-ui, sans-serif",
      boxSizing: "border-box", position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: RC.text, margin: 0 }}>Recommendations</h1>
          <p style={{ fontSize: 13, color: RC.muted, margin: "4px 0 0" }}>
            <b style={{ color: RC.good, fontWeight: 600 }}>${total.toLocaleString()}/mo</b> in pending savings
            <span style={{ color: RC.xMuted }}> · </span>
            acted on <b style={{ color: RC.text2, fontWeight: 600 }}>$3,820</b> last 7 days
            <span style={{ color: RC.xMuted }}> · </span>
            {all.length} open
          </p>
        </div>
        <button style={{
          fontSize: 12, color: RC.text2, background: RC.surface, border: `1px solid ${RC.border}`,
          borderRadius: 6, padding: "6px 12px",
          display: "inline-flex", alignItems: "center", gap: 8,
        }} title="Force a fresh scan of the fleet">
          <span>⟳ Rescan</span>
          <span style={{ color: RC.xMuted, fontWeight: 400 }}>· last 2h ago</span>
        </button>
      </div>

      {/* Row: View picker + Share + Save-as */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <RecViewsPicker activeId="all" open={viewsOpen} onToggle={() => setViewsOpen((v) => !v)} />
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: RC.text2,
          background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Share link
        </button>
        <button style={{ padding: "5px 10px", fontSize: 12, color: RC.muted, background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: 6 }}>Save as…</button>
      </div>

      {/* Filter chips + sort */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {REC_CATEGORIES.map((f, i) => {
          const on = i === 0;
          return (
            <button key={f} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: on ? 500 : 400,
              borderRadius: 6, border: `1px solid ${on ? RC.text : RC.border}`,
              background: on ? RC.text : RC.surface,
              color: on ? "#fff" : RC.muted,
            }}>{f}</button>
          );
        })}
        <span style={{ flex: 1 }} />
        <div style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${RC.border}`, fontSize: 12, color: RC.muted, background: RC.surface }}>
          Sort: Highest savings ▾
        </div>
        <div style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${RC.border}`, fontSize: 12, color: RC.muted, background: RC.surface }}>
          Status: Open ▾
        </div>
      </div>

      {/* Recommendations list */}
      {all.map((r) => {
        const expanded = r.id === expandedId && r._full;
        const toggle = () => setExpandedId((id) => (id === r.id ? null : r.id));
        if (expanded) {
          return <RecCardExpanded key={r.id} r={r} onToggle={toggle} onAutopilot={() => setModalOpen(true)} />;
        }
        return <RecCardCompact key={r.id} r={r} onToggle={toggle} />;
      })}

      {/* Modal */}
      {modalOpen && (
        <AutopilotConfirmModal rec={R201} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

Object.assign(window, { RecommendationsPage });
