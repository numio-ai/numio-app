import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
};

const secLabel = {
  fontSize: 10, fontWeight: 600, color: C.xMuted,
  textTransform: "uppercase", letterSpacing: "0.08em", margin: 0,
};
const btnGhost = {
  fontSize: 12, color: C.muted, background: C.surface,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer",
};
const btnPrimary = {
  fontSize: 12, color: "#fff", background: C.text, fontWeight: 500,
  border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer",
};

const FALLBACK_RULE = [
  { kw: "WHEN", expr: "criteria not yet defined" },
  { kw: "DO", expr: "action_placeholder" },
];

const FALLBACK_SAFETY = [
  "Reversible within 7 days.",
  "Actions are idempotent.",
  "First runs flagged for manual review.",
  "Bounded blast radius per run.",
];

export default function SendToAutopilotModal({ recommendation, onApprove, onCancel }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const approvedBy = auth?.user?.email || auth?.user?.id || "unknown";
  const [dryRun, setDryRun] = useState(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!recommendation) return null;
  const rec = recommendation;
  const rule = rec.rule && rec.rule.length > 0 ? rec.rule : FALLBACK_RULE;
  const safety = rec.safety && rec.safety.length > 0 ? rec.safety : FALLBACK_SAFETY;
  const evidenceLines = rec.signals && rec.signals.length > 0 ? rec.signals : ["Evidence to be supplied by backend."];

  const handleApprove = () => {
    onApprove({
      ruleId: rec.id,
      dryRun,
      approvedBy,
    });
  };

  const handleOpenEditor = () => {
    onCancel();
    navigate(`/autopilot?new=true&prefill=${encodeURIComponent(rec.id)}`);
  };

  return (
    <div
      data-testid="send-to-autopilot-modal"
      role="dialog"
      aria-label="Send to Autopilot"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(17, 24, 39, 0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 40,
      }}
    >
      <div
        style={{
          width: 620, maxWidth: "calc(100% - 40px)",
          maxHeight: "calc(100% - 80px)", overflow: "auto",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <p style={{ ...secLabel }}>Send to Autopilot</p>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: "4px 0 0" }}>
              Enable a recurring automated action
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div data-testid="stam-section-summary" style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: 0 }}>{rec.title}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
            Reduces spend by <b style={{ color: C.good }}>${rec.saving.toLocaleString()}/mo</b>
            <span style={{ color: C.xMuted }}> · </span>
            {rec.affectedCount != null ? `${rec.affectedCount} resources` : "non-resource-based"}
            <span style={{ color: C.xMuted }}> · </span>
            scope <code style={{ fontFamily: "JetBrains Mono, monospace", background: "#f3f4f6", padding: "1px 6px", borderRadius: 3 }}>{rec.scope}</code>
          </p>
        </div>

        <div data-testid="stam-section-evidence" style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ ...secLabel, marginBottom: 6 }}>Evidence</p>
          {evidenceLines.map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 13, color: C.text2 }}>
              <span style={{ color: C.good, marginTop: 1 }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div data-testid="stam-section-rule" style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ ...secLabel, marginBottom: 0 }}>Rule (editable in Autopilot)</p>
            <button
              type="button"
              data-testid="stam-open-editor"
              onClick={handleOpenEditor}
              style={{ fontSize: 11, color: C.ai2, fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              Open rule editor →
            </button>
          </div>
          <div style={{
            background: "#0f172a", color: "#e2e8f0",
            borderRadius: 8, padding: "10px 14px",
            fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.7,
          }}>
            {rule.map((line, i) => (
              <div key={i}>
                {line.kw ? (
                  <span style={{ color: "#a5b4fc", fontWeight: 600, width: 74, display: "inline-block" }}>{line.kw}</span>
                ) : (
                  <span style={{ width: 74, display: "inline-block" }} />
                )}
                <span>{line.expr}</span>
              </div>
            ))}
          </div>
        </div>

        <div data-testid="stam-section-safety" style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ ...secLabel, marginBottom: 6 }}>Safety properties</p>
          {safety.map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 13, color: C.text2 }}>
              <span style={{ color: C.good }}>●</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}>
            <input
              type="checkbox"
              data-testid="stam-dryrun-toggle"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: C.text, cursor: "pointer" }}
            />
            Run a 7-night dry-run first <span style={{ color: C.muted }}>(recommended)</span>
          </label>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="stam-cancel" onClick={onCancel} style={btnGhost}>Cancel</button>
          <button type="button" data-testid="stam-approve" onClick={handleApprove} style={btnPrimary}>Approve and enable</button>
        </div>
      </div>
    </div>
  );
}
