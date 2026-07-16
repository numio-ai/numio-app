// tags-states.jsx — Empty, loading, error, viewer-mode, mobile redirect
// All states use the Numio palette tokens (N from tags-final-v2 reused; we
// just re-declare a few here so this file is independent).
const { useState: useStateSt } = React;

const ST = {
  border: "#efefef", borderStrong: "#e5e5e5",
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  bg: "#f7f7f7", surface: "#ffffff",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
  success: "#16a34a", warn: "#d97706", danger: "#dc2626",
};

// ============================================================
// 1. ONBOARDING — Auto-seeded first run
// ============================================================
function OnboardingState() {
  const [step, setStep] = useStateSt("scanning"); // scanning | review | done

  return (
    <div style={{ height: "100%", overflow: "auto", background: ST.bg, padding: "32px 28px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: ST.text, margin: 0 }}>Tag Governance</h1>
        <p style={{ fontSize: 13, color: ST.muted, margin: "4px 0 0" }}>Let's set up your tag schema by learning from what you already have.</p>
      </div>

      {/* Progress steps */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 24, padding: "0 4px",
      }}>
        <Step n={1} label="Connect accounts" done />
        <Connector done />
        <Step n={2} label={step === "scanning" ? "Scanning…" : "Scan complete"} active done={step !== "scanning"} />
        <Connector done={step !== "scanning"} />
        <Step n={3} label="Review proposed schema" active={step === "review"} />
        <Connector />
        <Step n={4} label="Start tagging" />
      </div>

      {/* Scan card */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: ST.aiBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <LIcon name="sparkles" size={22} color={ST.ai2} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: ST.text }}>Numio is learning your tag landscape</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: ST.ai2, background: ST.aiBg,
                padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em",
              }}>AUTO-SEED</span>
            </div>
            <p style={{ fontSize: 12.5, color: ST.text2, lineHeight: 1.55, margin: "0 0 12px" }}>
              We scanned <b>3 AWS accounts</b> (412 resources) and <b>1 AWS Organizations tag policy</b>. Below is a proposed schema based on what's already in use — review, edit, then promote into Numio's canonical schema.
            </p>

            {/* Mini scan log */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              <ScanLine status="done" text="Scanned 412 resources across acme-prod, acme-staging, acme-dev" />
              <ScanLine status="done" text="Found 14 distinct tag keys (8 frequent, 6 sparse)" />
              <ScanLine status="done" text="Imported 1 tag policy from AWS Organizations (arn:…acme-prod-required)" />
              <ScanLine status={step === "scanning" ? "running" : "done"} text="Detected 1 value drift incident (env: prod vs production)" />
              <ScanLine status={step === "scanning" ? "queued" : "done"} text="Inferred required keys from prod-resource coverage" />
            </div>

            {step === "scanning" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 4, background: "#eceae6", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ width: "65%", height: "100%", background: ST.ai, borderRadius: 9999 }} />
                </div>
                <span style={{ fontSize: 11, color: ST.muted, fontVariantNumeric: "tabular-nums" }}>65% · 14s left</span>
                <button style={{ ...btnGhost, fontSize: 11 }} onClick={() => setStep("review")}>Skip to review →</button>
              </div>
            )}
            {step === "review" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnPrimary}>Accept proposed schema</button>
                <button style={btnGhost}>Customize first</button>
                <button style={btnGhost}>Start from scratch instead</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proposed schema preview */}
      {step !== "scanning" && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: ST.xMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Proposed schema · 8 keys
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: ST.muted }}>
              <b style={{ color: ST.text }}>4 required</b> · <b style={{ color: ST.text }}>4 optional</b> · <b style={{ color: "#c2410c" }}>2 inherited from AWS Org</b>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ProposedKey k="env" desc="Deployment environment" required source="numio" coverage={93} values={["production", "staging", "dev"]} />
            <ProposedKey k="team" desc="Owning team or business unit" required source="numio" coverage={84} values={["engineering", "ml-platform", "data-analytics", "devops"]} />
            <ProposedKey k="cost-center" desc="Budget code for cost allocation" required source="aws-org" coverage={72} values={["CC-ENG", "CC-ML", "CC-DATA", "CC-OPS"]} />
            <ProposedKey k="owner" desc="Individual owner (email)" required source="numio" coverage={78} values={["7 emails"]} />
            <ProposedKey k="project" desc="Project or initiative" source="numio" coverage={41} values={["5 detected"]} />
            <ProposedKey k="service" desc="Application / micro-service" source="numio" coverage={62} values={["13 detected"]} />
          </div>
          <p style={{ fontSize: 11.5, color: ST.muted, margin: "12px 0 0", lineHeight: 1.5 }}>
            Once accepted, the heatmap shows your fleet against this schema. You can edit keys, values, and requirements anytime from the <b>Schema</b> tab.
          </p>
        </div>
      )}
    </div>
  );
}

function Step({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        background: done ? ST.text : active ? ST.surface : ST.surface,
        border: `1px solid ${done ? ST.text : active ? ST.text : ST.border}`,
        color: done ? "#fff" : ST.text2,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 600,
      }}>{done ? "✓" : n}</div>
      <span style={{ fontSize: 12.5, color: active || done ? ST.text : ST.muted, fontWeight: active ? 600 : 500 }}>{label}</span>
    </div>
  );
}
function Connector({ done }) {
  return <div style={{ flex: 1, height: 1, background: done ? ST.text : ST.border, maxWidth: 60 }} />;
}
function ScanLine({ status, text }) {
  const icon = status === "done" ? "✓" : status === "running" ? "•" : "○";
  const color = status === "done" ? ST.success : status === "running" ? ST.ai2 : ST.xMuted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ST.text2 }}>
      <span style={{ width: 14, color, fontWeight: 600 }}>{icon}</span>
      <span style={{ color: status === "queued" ? ST.xMuted : ST.text2 }}>{text}</span>
      {status === "running" && (
        <span style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>
          <span style={{ width: 3, height: 3, borderRadius: 2, background: ST.ai2, opacity: 0.5 }} />
          <span style={{ width: 3, height: 3, borderRadius: 2, background: ST.ai2, opacity: 0.8 }} />
          <span style={{ width: 3, height: 3, borderRadius: 2, background: ST.ai2 }} />
        </span>
      )}
    </div>
  );
}
function ProposedKey({ k, desc, required, source, coverage, values }) {
  const cov = coverage >= 85 ? ST.success : coverage >= 60 ? ST.warn : ST.danger;
  return (
    <div style={{ border: `1px solid ${ST.border}`, borderRadius: 8, padding: "10px 12px", background: ST.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500,
          background: "#f3f0ff", color: ST.text, border: "1px solid #e9e3ff",
          padding: "1px 6px", borderRadius: 4,
        }}>{k}</span>
        {required && <span style={{ fontSize: 9, fontWeight: 700, color: ST.danger, background: "#fef2f2", border: "1px solid #fecaca", padding: "0 4px", borderRadius: 3, letterSpacing: "0.04em" }}>REQ</span>}
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.03em",
          color: source === "aws-org" ? "#c2410c" : ST.muted,
          background: source === "aws-org" ? "#fff7ed" : ST.surface,
          border: `1px solid ${source === "aws-org" ? "#fed7aa" : ST.border}`,
          padding: "0 5px", borderRadius: 3,
        }}>{source === "aws-org" ? "AWS ORG" : "NUMIO"}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: cov, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{coverage}%</span>
      </div>
      <p style={{ fontSize: 11.5, color: ST.muted, margin: "2px 0 6px", lineHeight: 1.4 }}>{desc}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {values.slice(0, 4).map(v => (
          <span key={v} style={{
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            color: ST.text2, background: "#fafafa", border: `1px solid ${ST.border}`,
            padding: "1px 5px", borderRadius: 3,
          }}>{v}</span>
        ))}
        {values.length > 4 && <span style={{ fontSize: 10, color: ST.xMuted, alignSelf: "center" }}>+{values.length - 4}</span>}
      </div>
    </div>
  );
}

// ============================================================
// 2. LOADING SKELETON
// ============================================================
function LoadingState() {
  return (
    <div style={{ height: "100%", overflow: "hidden", background: ST.bg, padding: "20px 24px" }}>
      <div style={{ background: ST.surface, border: `1px solid ${ST.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 12 }}>
        <Skel w={140} h={16} />
        <div style={{ height: 8 }} />
        <Skel w={320} h={12} />
        <div style={{ height: 20 }} />
        <div style={{ display: "flex", gap: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i}>
              <Skel w={80} h={9} />
              <div style={{ height: 6 }} />
              <Skel w={50} h={22} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: ST.surface, border: `1px solid ${ST.border}`, borderRadius: 12, padding: 16 }}>
        {/* heatmap header */}
        <div style={{ display: "grid", gridTemplateColumns: `300px repeat(8, 1fr) 80px`, gap: 4, paddingBottom: 12, borderBottom: `1px solid ${ST.border}` }}>
          <Skel w={80} h={10} />
          {[0,1,2,3,4,5,6,7].map(i => <Skel key={i} w={60} h={26} />)}
          <Skel w={50} h={10} />
        </div>
        {/* heatmap rows */}
        {[...Array(8)].map((_, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: `300px repeat(8, 1fr) 80px`, gap: 4, paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid #f4f3ef` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Skel w={32} h={14} />
              <div>
                <Skel w={140} h={12} />
                <div style={{ height: 4 }} />
                <Skel w={80} h={9} />
              </div>
            </div>
            {[0,1,2,3,4,5,6,7].map(i => <Skel key={i} w="100%" h={26} />)}
            <Skel w={40} h={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Skel({ w, h }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: "linear-gradient(90deg, #f0eee9 0%, #f6f4ef 50%, #f0eee9 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s linear infinite",
    }} />
  );
}

// inject shimmer keyframes once
if (typeof document !== "undefined" && !document.getElementById("__tag_shimmer")) {
  const s = document.createElement("style");
  s.id = "__tag_shimmer";
  s.textContent = "@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }";
  document.head.appendChild(s);
}

// ============================================================
// 3. ERROR STATE
// ============================================================
function ErrorState() {
  return (
    <div style={{ height: "100%", overflow: "auto", background: ST.bg, padding: "32px 28px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: ST.text, margin: 0 }}>Tag Governance</h1>
      </div>
      <div style={{
        ...card, padding: "40px 24px",
        textAlign: "center", maxWidth: 560, margin: "20px auto",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 24,
          background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14,
        }}>
          <LIcon name="zap" size={22} color={ST.danger} strokeWidth={1.75} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: ST.text, margin: "0 0 6px" }}>Couldn't load tag compliance data</h2>
        <p style={{ fontSize: 13, color: ST.muted, margin: "0 0 4px", lineHeight: 1.55 }}>
          The compliance scan API returned <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: "#fef2f2", color: ST.danger, padding: "1px 6px", borderRadius: 3 }}>503 Service Unavailable</code>.
        </p>
        <p style={{ fontSize: 12, color: ST.xMuted, margin: "0 0 18px", lineHeight: 1.55 }}>
          We retried 3 times over the last 14 seconds. The ingestion service may be catching up after a backlog.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          <button style={btnPrimary}>Retry now</button>
          <button style={btnGhost}>View status page</button>
        </div>
        <div style={{ borderTop: `1px solid ${ST.border}`, paddingTop: 12, marginTop: 8 }}>
          <p style={{ fontSize: 11.5, color: ST.muted, margin: 0 }}>
            Last successful sync: <b style={{ color: ST.text2 }}>2h 14m ago</b> · <a href="#" style={{ color: ST.ai2, textDecoration: "none" }}>View cached snapshot</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 4. VIEWER MODE (read-only banner over heatmap)
// ============================================================
function ViewerBanner() {
  return (
    <div style={{
      padding: "8px 14px",
      background: "#f3f4f6", borderBottom: `1px solid ${ST.border}`,
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 12, color: ST.text2,
    }}>
      <LIcon name="shield" size={13} color={ST.muted} strokeWidth={1.75} />
      <span><b style={{ color: ST.text }}>Viewer mode</b> — you can browse the tag landscape and search, but applying changes requires admin access.</span>
      <div style={{ flex: 1 }} />
      <button style={{ ...btnGhost, fontSize: 11 }}>Request access</button>
    </div>
  );
}

// ============================================================
// 5. MOBILE REDIRECT
// ============================================================
function MobileScreen() {
  return (
    <div style={{
      width: "100%", height: "100%", background: ST.bg, padding: "24px 18px",
      display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: ST.text, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>n</div>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Numio</span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Tag Governance</h1>
      <p style={{ fontSize: 13, color: ST.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
        This view is built for desktop screens. Here's a quick read on your fleet — open Numio on your laptop to make changes.
      </p>

      {/* KPI cards stacked */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <MobileKpi label="Required coverage" value="78%" tone="warn" />
        <MobileKpi label="Resources with gaps" value="9" sub="of 22" />
        <MobileKpi label="Drift incidents" value="1" tone="warn" />
        <MobileKpi label="At-risk spend" value="$11.3k/mo" tone="danger" />
      </div>

      {/* Recent activity */}
      <div style={{ ...card, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: ST.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recent · last 24h</div>
        {[
          { who: "Autopilot", t: "2h ago", text: "Filled cost-center on 6 RDS instances" },
          { who: "James C.", t: "yesterday", text: "Updated owner on 4 EC2 instances" },
          { who: "Autopilot", t: "yesterday", text: "Normalized env: prod → production (1)" },
        ].map((a, i) => (
          <div key={i} style={{ fontSize: 12, color: ST.text2, lineHeight: 1.5, padding: "4px 0", borderTop: i ? `1px solid ${ST.border}` : "none" }}>
            <div>{a.text}</div>
            <div style={{ fontSize: 10.5, color: ST.xMuted }}>{a.who} · {a.t}</div>
          </div>
        ))}
      </div>

      {/* Push action */}
      <div style={{ marginTop: "auto" }}>
        <button style={{
          width: "100%", padding: "10px 14px", border: `1px solid ${ST.border}`,
          background: ST.surface, borderRadius: 8, fontSize: 13, color: ST.text,
          fontFamily: "inherit", cursor: "pointer", marginBottom: 6,
        }}>Email me the dashboard link →</button>
        <button style={{
          width: "100%", padding: "10px 14px", border: "none",
          background: "transparent", borderRadius: 8, fontSize: 12, color: ST.muted,
          fontFamily: "inherit", cursor: "pointer",
        }}>Continue anyway (read-only)</button>
      </div>
    </div>
  );
}
function MobileKpi({ label, value, sub, tone }) {
  const color = tone === "danger" ? ST.danger : tone === "warn" ? ST.warn : ST.text;
  return (
    <div style={{
      background: ST.surface, border: `1px solid ${ST.border}`, borderRadius: 10,
      padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span style={{ fontSize: 12.5, color: ST.text2 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: ST.muted }}>{sub}</span>}
      </span>
    </div>
  );
}

// ---------- shared atoms ----------
const card = {
  background: ST.surface, border: `1px solid ${ST.border}`, borderRadius: 12,
  padding: "16px 20px",
};
const btnPrimary = {
  background: ST.text, color: "#fff", border: "none", borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit",
};
const btnGhost = {
  background: "transparent", color: ST.text2, border: `1px solid ${ST.border}`,
  borderRadius: 6, fontSize: 12, fontWeight: 500, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit",
};

Object.assign(window, { OnboardingState, LoadingState, ErrorState, ViewerBanner, MobileScreen });
