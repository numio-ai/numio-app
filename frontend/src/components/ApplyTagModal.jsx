import React, { useEffect, useState } from "react";
import { previewTagApply, applyTags } from "../api/tagGovernance";
import { getAuditActionEvent } from "../api/dashboard";
import RiskyWriteModal from "./RiskyWriteModal";

const MAX_CHANGES = 100;

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const secLabel = {
  fontSize: 11, fontWeight: 600, color: C.xMuted,
  textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px",
};
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 13,
  border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
  fontFamily: "JetBrains Mono, monospace", outline: "none",
};
const btnGhost = {
  fontSize: 12, color: C.muted, background: C.surface,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer",
};
const btnPrimary = {
  fontSize: 12, color: "#fff", background: C.text, fontWeight: 500,
  border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer",
};

/**
 * Drives the tag-apply flow for one or more selected resources:
 *   form → preview → (RiskyWriteModal if risky) → apply → result.
 *
 * Preview runs for every apply (single or bulk) so a risky single-resource
 * write triggers the same confirmation gate the backend enforces. Partial
 * failures are listed per-resource by fetching the action-event detail.
 *
 * Props:
 *   resourceIds string[]  — selected CloudResource ids
 *   onClose()             — close the modal
 *   onApplied()           — called once after a non-error apply (e.g. clear selection)
 */
export default function ApplyTagModal({ resourceIds, onClose, onApplied }) {
  const [tagKey, setTagKey] = useState("");
  const [value, setValue] = useState("");
  const [remove, setRemove] = useState(false);
  const [phase, setPhase] = useState("form"); // form | confirming | result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [changes, setChanges] = useState([]);
  const [result, setResult] = useState(null);
  const [failedItems, setFailedItems] = useState([]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy && phase !== "confirming") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy, phase]);

  const count = resourceIds.length;

  const doApply = async (builtChanges, confirmRisky) => {
    setBusy(true);
    setError(null);
    try {
      const res = await applyTags({ changes: builtChanges, confirmRisky });
      setResult(res);
      if (res.status !== "success") {
        try {
          const detail = await getAuditActionEvent(res.event_id);
          setFailedItems((detail.items || []).filter((i) => i.status === "failure"));
        } catch {
          setFailedItems([]);
        }
      }
      setPhase("result");
      onApplied?.();
    } catch (e) {
      setError(e?.message || "Apply failed");
      setPhase("form");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!tagKey.trim()) {
      setError("Enter a tag key.");
      return;
    }
    if (!remove && value === "") {
      setError("Enter a value, or choose Remove to delete the tag.");
      return;
    }
    if (count > MAX_CHANGES) {
      setError(`Select ${MAX_CHANGES} or fewer resources (${count} selected).`);
      return;
    }
    const built = resourceIds.map((id) => ({
      resource_id: id,
      tag_key: tagKey.trim(),
      value: remove ? null : value,
    }));
    setChanges(built);
    setBusy(true);
    try {
      const pv = await previewTagApply(built);
      setPreview(pv);
      if (pv.risky) {
        setPhase("confirming");
        setBusy(false);
      } else {
        await doApply(built, false);
      }
    } catch (e) {
      setError(e?.message || "Preview failed");
      setBusy(false);
    }
  };

  if (phase === "confirming") {
    return (
      <RiskyWriteModal
        tagKey={tagKey.trim()}
        value={remove ? null : value}
        preview={preview}
        busy={busy}
        onConfirm={() => doApply(changes, true)}
        onCancel={() => { setPhase("form"); setPreview(null); }}
      />
    );
  }

  return (
    <div
      data-testid="apply-tag-modal"
      role="dialog"
      aria-label="Apply tag"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(17, 24, 39, 0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 48,
      }}
    >
      <div
        style={{
          width: 520, maxWidth: "calc(100% - 40px)",
          maxHeight: "calc(100% - 96px)", overflow: "auto",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>
            {phase === "result" ? "Apply result" : "Apply tag"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: busy ? "default" : "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {phase === "form" && (
          <>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                Applying to <b style={{ color: C.text }} data-testid="atm-count">{count}</b> resource{count === 1 ? "" : "s"}.
              </p>
            </div>
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={secLabel}>Tag key</p>
                <input
                  data-testid="atm-tag-key"
                  value={tagKey}
                  onChange={(e) => setTagKey(e.target.value)}
                  placeholder="e.g. cost-center"
                  style={inputStyle}
                />
              </div>
              <div>
                <p style={secLabel}>Value</p>
                <input
                  data-testid="atm-value"
                  value={value}
                  disabled={remove}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={remove ? "(tag will be removed)" : "e.g. CC-ENG"}
                  style={{ ...inputStyle, background: remove ? "#f3f4f6" : C.surface, color: remove ? C.xMuted : C.text }}
                />
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="atm-remove"
                  checked={remove}
                  onChange={(e) => setRemove(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: C.text, cursor: "pointer" }}
                />
                Remove this tag instead of setting a value
              </label>
              {error && (
                <p data-testid="atm-error" style={{ fontSize: 12, color: C.danger, margin: 0 }}>{error}</p>
              )}
            </div>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${C.border}` }}>
              <span style={{ flex: 1 }} />
              <button type="button" data-testid="atm-cancel" onClick={onClose} disabled={busy} style={btnGhost}>Cancel</button>
              <button type="button" data-testid="atm-submit" onClick={onSubmit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
                {busy ? "Checking…" : "Preview & apply"}
              </button>
            </div>
          </>
        )}

        {phase === "result" && result && (
          <>
            <div
              data-testid="atm-result"
              data-status={result.status}
              style={{
                padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
                background: result.status === "success" ? C.goodBg : result.status === "failure" ? C.dangerBg : C.warnBg,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: result.status === "success" ? C.good : result.status === "failure" ? C.danger : C.warn }}>
                {result.status === "success" && `Applied to ${result.summary?.success_count ?? count} resource${(result.summary?.success_count ?? count) === 1 ? "" : "s"}.`}
                {result.status === "partial_failure" && `${result.summary?.failure_count ?? failedItems.length} of ${result.summary?.item_count ?? count} change(s) failed.`}
                {result.status === "failure" && "All changes failed."}
              </p>
            </div>
            {failedItems.length > 0 && (
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                <p style={secLabel}>Failed resources</p>
                <div style={{ maxHeight: 220, overflow: "auto" }}>
                  {failedItems.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`atm-failed-${item.id}`}
                      style={{ padding: "6px 0", fontSize: 12, color: C.text2, borderTop: `1px solid #f3f4f6` }}
                    >
                      <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.target_id}
                      </div>
                      <div style={{ color: C.danger }}>
                        <b>{item.error_code || "Error"}</b>
                        {item.error_message ? ` — ${item.error_message}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1 }} />
              <button type="button" data-testid="atm-done" onClick={onClose} style={btnPrimary}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
