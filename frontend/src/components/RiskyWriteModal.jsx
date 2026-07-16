import React, { useEffect } from "react";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const btnGhost = {
  fontSize: 12, color: C.muted, background: C.surface,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer",
};
const btnDanger = {
  fontSize: 12, color: "#fff", background: C.danger, fontWeight: 500,
  border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer",
};

/**
 * Confirmation gate for a risky tag write. Driven entirely by the
 * /tags/apply/preview response: it shows why the write is risky and which
 * resources it touches, and only proceeds when the operator confirms.
 *
 * Props:
 *   tagKey   string         — the tag being written
 *   value    string | null  — null means "remove the tag"
 *   preview  { reasons, affected_resources } from the preview endpoint
 *   busy     bool           — disables the confirm button while applying
 *   onConfirm()             — proceed with confirm_risky=true
 *   onCancel()              — abandon the write
 */
export default function RiskyWriteModal({ tagKey, value, preview, busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  const reasons = preview?.reasons || [];
  const affected = preview?.affected_resources || [];
  const change = value === null ? `Remove tag “${tagKey}”` : `Set ${tagKey} = ${value}`;

  return (
    <div
      data-testid="risky-write-modal"
      role="dialog"
      aria-label="Confirm risky tag write"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 210,
        background: "rgba(17, 24, 39, 0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 48,
      }}
    >
      <div
        style={{
          width: 560, maxWidth: "calc(100% - 40px)",
          maxHeight: "calc(100% - 96px)", overflow: "auto",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }} aria-hidden="true">⚠️</span>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>
              Confirm risky tag write
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={busy}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: busy ? "default" : "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div data-testid="rwm-reasons" style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.dangerBg }}>
          <p style={{ fontSize: 13, color: C.text2, margin: "0 0 8px" }}>
            This write needs confirmation because:
          </p>
          {reasons.map((reason) => (
            <div key={reason} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 13, color: C.danger }}>
              <span aria-hidden="true">●</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Change
          </p>
          <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: C.text, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
            {change}
          </code>
        </div>

        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
            {affected.length} affected resource{affected.length === 1 ? "" : "s"}
          </p>
          <div style={{ maxHeight: 200, overflow: "auto" }}>
            {affected.map((r) => (
              <div
                key={r.resource_id}
                data-testid={`rwm-affected-${r.resource_id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12, color: C.text2, borderTop: `1px solid #f3f4f6` }}
              >
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name || r.arn || r.resource_id}
                </span>
                {r.env != null && (
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>{r.env}</span>
                )}
                <span style={{ fontWeight: 600, color: C.text, minWidth: 70, textAlign: "right" }}>
                  ${Number(r.monthly_cost || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="rwm-cancel" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
          <button type="button" data-testid="rwm-confirm" onClick={onConfirm} disabled={busy} style={{ ...btnDanger, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Applying…" : "Apply anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
