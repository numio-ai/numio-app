import React, { useState } from "react";
import { REC_LIST } from "../Recommendations/recommendationsMockData";
import { RULE_TEMPLATES } from "./autopilotMockData";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  ai2: "#4f46e5", aiBg: "#eef2ff",
};

const secLabel = { fontSize: 10, fontWeight: 600, color: C.xMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 };
const btnGhost = { fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: C.text, fontWeight: 500, border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" };

const TABS = [
  { id: "from-recommendation", label: "From recommendation" },
  { id: "from-template", label: "From template" },
  { id: "from-scratch", label: "From scratch" },
];

export default function NewRuleModal({ onConfigure, onCancel }) {
  const [tab, setTab] = useState("from-recommendation");
  const [selectedRecId, setSelectedRecId] = useState(REC_LIST[0]?.id || "");
  const [selectedTplId, setSelectedTplId] = useState(RULE_TEMPLATES[0]?.id || "");
  const [scratchText, setScratchText] = useState("");

  const handleConfigure = () => {
    if (tab === "from-recommendation") {
      const rec = REC_LIST.find((r) => r.id === selectedRecId);
      if (rec) onConfigure({ source: "recommendation", recommendation: rec });
      return;
    }
    if (tab === "from-template") {
      const tpl = RULE_TEMPLATES.find((t) => t.id === selectedTplId);
      if (tpl) onConfigure({
        source: "template",
        recommendation: {
          id: `tpl-${tpl.id}`,
          title: tpl.name,
          scope: "(set in next step)",
          saving: 0,
          affectedCount: 0,
          signals: [tpl.note],
          rule: [{ kw: "WHEN", expr: "<configured in next step>" }, { kw: "DO", expr: tpl.id }],
          safety: [],
        },
      });
      return;
    }
    onConfigure({
      source: "scratch",
      recommendation: {
        id: "scratch-new",
        title: scratchText.trim().split("\n")[0]?.slice(0, 60) || "New rule",
        scope: "(custom)",
        saving: 0,
        affectedCount: 0,
        signals: ["Authored from scratch — review carefully."],
        rule: scratchText.split("\n").filter(Boolean).map((line) => ({ kw: "", expr: line.trim() })),
        safety: [],
      },
    });
  };

  return (
    <div
      data-testid="new-rule-modal"
      role="dialog"
      aria-label="New rule"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(17, 24, 39, 0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40,
      }}
    >
      <div style={{
        width: 620, maxWidth: "calc(100% - 40px)", maxHeight: "calc(100% - 80px)", overflow: "auto",
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p style={secLabel}>Autopilot</p>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: "4px 0 0" }}>New rule</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onCancel} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div role="tablist" aria-label="New rule source" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`nrm-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "12px 16px", fontSize: 13,
                  background: "none", border: "none", cursor: "pointer",
                  color: on ? C.text : C.muted,
                  fontWeight: on ? 500 : 400,
                  borderBottom: on ? "2px solid #111827" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "16px 20px" }}>
          {tab === "from-recommendation" && (
            <div data-testid="nrm-from-rec">
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>Pick a recommendation to enable as a recurring rule.</p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 300, overflow: "auto" }}>
                {REC_LIST.filter((r) => r.autopilot).map((r, i, arr) => {
                  const on = r.id === selectedRecId;
                  return (
                    <div
                      key={r.id}
                      role="option"
                      aria-selected={on}
                      tabIndex={0}
                      data-testid={`nrm-rec-option-${r.id}`}
                      onClick={() => setSelectedRecId(r.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelectedRecId(r.id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", cursor: "pointer",
                        background: on ? "#f5f3ff" : "transparent",
                        borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none",
                      }}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: `2px solid ${on ? C.ai2 : C.border}`,
                        background: on ? C.ai2 : C.surface, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{r.title}</p>
                        <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>{r.scope} · ${r.saving.toLocaleString()}/mo</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "from-template" && (
            <div data-testid="nrm-from-template">
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>Start from a vetted template.</p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {RULE_TEMPLATES.map((t, i, arr) => {
                  const on = t.id === selectedTplId;
                  return (
                    <div
                      key={t.id}
                      role="option"
                      aria-selected={on}
                      tabIndex={0}
                      data-testid={`nrm-tpl-option-${t.id}`}
                      onClick={() => setSelectedTplId(t.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelectedTplId(t.id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", cursor: "pointer",
                        background: on ? "#f5f3ff" : "transparent",
                        borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none",
                      }}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: `2px solid ${on ? C.ai2 : C.border}`,
                        background: on ? C.ai2 : C.surface, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>{t.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "from-scratch" && (
            <div data-testid="nrm-from-scratch">
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>
                Write the rule DSL directly. <a href="https://docs.numio.local/autopilot/dsl" style={{ color: C.ai2 }}>DSL reference →</a>
              </p>
              <textarea
                data-testid="nrm-scratch-textarea"
                value={scratchText}
                onChange={(e) => setScratchText(e.target.value)}
                placeholder={"WHEN env IN (dev) AND CPU < 2% for 4h\nDO stop_instance\nTHEN resume_on PR_push"}
                style={{
                  width: "100%", minHeight: 160, padding: "10px 12px",
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.6,
                  resize: "vertical", outline: "none",
                }}
              />
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: C.muted }}>
            New rules require a dry-run + explicit approval before they fire.
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="nrm-cancel" onClick={onCancel} style={btnGhost}>Cancel</button>
          <button type="button" data-testid="nrm-configure" onClick={handleConfigure} style={btnPrimary}>Configure →</button>
        </div>
      </div>
    </div>
  );
}
