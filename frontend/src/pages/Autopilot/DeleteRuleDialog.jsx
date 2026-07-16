import React, { useState } from "react";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", danger: "#dc2626", dangerBg: "#fef2f2",
};

const btnGhost = { fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" };

export default function DeleteRuleDialog({ rule, onCancel, onConfirm }) {
  const [input, setInput] = useState("");
  const matches = input.trim() === rule.name;
  return (
    <div
      data-testid="delete-rule-dialog"
      role="dialog"
      aria-label="Delete rule"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(17, 24, 39, 0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100,
      }}
    >
      <div style={{
        width: 440, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>Delete rule</h2>
        <p style={{ fontSize: 13, color: C.text2, margin: "10px 0 14px", lineHeight: 1.5 }}>
          Deleting <b>{rule.name}</b> is irreversible. The rule's history is preserved, but the rule definition is removed.
        </p>
        <p style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>Type the rule name to confirm:</p>
        <input
          data-testid="delete-rule-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={rule.name}
          style={{
            width: "100%", padding: "8px 10px",
            border: `1px solid ${matches ? C.danger : C.border}`,
            borderRadius: 6, fontSize: 13, color: C.text, outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" data-testid="delete-rule-cancel" onClick={onCancel} style={btnGhost}>Cancel</button>
          <button
            type="button"
            data-testid="delete-rule-confirm"
            disabled={!matches}
            onClick={() => onConfirm(rule.id)}
            style={{
              fontSize: 12, color: "#fff",
              background: matches ? C.danger : "#fca5a5",
              border: "none", borderRadius: 6, padding: "6px 14px",
              fontWeight: 500, cursor: matches ? "pointer" : "not-allowed",
            }}
          >
            Delete rule
          </button>
        </div>
      </div>
    </div>
  );
}
