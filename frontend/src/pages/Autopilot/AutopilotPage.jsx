import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useAutopilotStatus, { setAutopilotPausedAll, setActiveRuleCount } from "../../hooks/useAutopilotStatus";
import SendToAutopilotModal from "../../components/SendToAutopilotModal";
import NewRuleModal from "./NewRuleModal";
import DeleteRuleDialog from "./DeleteRuleDialog";
import {
  INITIAL_RULES,
  INITIAL_HISTORY,
  undoStateFor,
  outcomeChipTone,
} from "./autopilotMockData";

const C = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  good: "#16a34a", goodBg: "#f0fdf4",
  warn: "#d97706", warnBg: "#fffbeb",
  danger: "#dc2626", dangerBg: "#fef2f2",
  ai: "#6366f1", aiBg: "#eef2ff", ai2: "#4f46e5",
};

const btnGhost = { fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: C.text, fontWeight: 500, border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" };

function ToggleSwitch({ on, onChange, "data-testid": testId, "aria-label": ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onChange}
      style={{
        width: 32, height: 18, padding: 0, position: "relative",
        background: on ? C.text : "#e5e7eb", border: "none",
        borderRadius: 9, cursor: "pointer", transition: "background 150ms",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 14, height: 14, background: "#fff", borderRadius: 7,
        transition: "left 150ms",
      }} />
    </button>
  );
}

function RowMenu({ rule, isArchived, onEdit, onDuplicate, onViewRuns, onArchive, onUnarchive, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={`rule-row-menu-${rule.id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 24, height: 24, padding: 0,
          background: "transparent", border: "none", borderRadius: 4,
          color: C.muted, fontSize: 14, lineHeight: 1, cursor: "pointer",
        }}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          minWidth: 160, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 4, zIndex: 30,
        }}>
          {!isArchived && (
            <>
              <MenuItem testId={`rule-menu-edit-${rule.id}`} onClick={() => { setOpen(false); onEdit(rule); }}>Edit</MenuItem>
              <MenuItem testId={`rule-menu-duplicate-${rule.id}`} onClick={() => { setOpen(false); onDuplicate(rule); }}>Duplicate</MenuItem>
              <MenuItem testId={`rule-menu-view-runs-${rule.id}`} onClick={() => { setOpen(false); onViewRuns(rule); }}>View runs</MenuItem>
              <MenuItem testId={`rule-menu-archive-${rule.id}`} onClick={() => { setOpen(false); onArchive(rule); }}>Archive</MenuItem>
            </>
          )}
          {isArchived && (
            <>
              <MenuItem testId={`rule-menu-unarchive-${rule.id}`} onClick={() => { setOpen(false); onUnarchive(rule); }}>Restore from archive</MenuItem>
              <MenuItem testId={`rule-menu-delete-${rule.id}`} danger onClick={() => { setOpen(false); onDelete(rule); }}>Delete…</MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, testId, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        padding: "6px 10px", fontSize: 12,
        color: danger ? C.danger : C.text2,
        background: "transparent", border: "none", borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PauseAllConfirmDialog({ onCancel, onConfirm }) {
  return (
    <div
      data-testid="pause-all-dialog"
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 180, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ width: 420, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>Pause all Autopilot rules?</h2>
        <p style={{ fontSize: 13, color: C.text2, margin: "10px 0 16px", lineHeight: 1.5 }}>
          All active rules stop firing until you resume. In-progress actions complete; nothing already done is rolled back. The System pill in the top bar will turn amber.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" data-testid="pause-all-cancel" onClick={onCancel} style={btnGhost}>Cancel</button>
          <button
            type="button"
            data-testid="pause-all-confirm"
            onClick={onConfirm}
            style={{ fontSize: 12, color: "#fff", background: C.warn, border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 500, cursor: "pointer" }}
          >
            Pause all
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesTab({
  rules,
  selected,
  setSelected,
  onToggleRule,
  showArchived,
  setShowArchived,
  onRowAction,
}) {
  const visibleRules = showArchived ? rules.filter((r) => r.archived) : rules.filter((r) => !r.archived);
  const archivedCount = rules.filter((r) => r.archived).length;
  const allSelected = visibleRules.length > 0 && visibleRules.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleRules.map((r) => r.id)));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          data-testid="rules-filter-active"
          onClick={() => setShowArchived(false)}
          style={{
            padding: "4px 10px", fontSize: 12,
            background: !showArchived ? C.text : C.surface,
            color: !showArchived ? "#fff" : C.muted,
            border: `1px solid ${!showArchived ? C.text : C.border}`, borderRadius: 6, cursor: "pointer",
          }}
        >
          Active ({rules.filter((r) => !r.archived).length})
        </button>
        <button
          type="button"
          data-testid="rules-filter-archived"
          onClick={() => setShowArchived(true)}
          style={{
            padding: "4px 10px", fontSize: 12,
            background: showArchived ? C.text : C.surface,
            color: showArchived ? "#fff" : C.muted,
            border: `1px solid ${showArchived ? C.text : C.border}`, borderRadius: 6, cursor: "pointer",
          }}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {selected.size > 0 && (
        <div
          data-testid="rules-bulk-action-bar"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 8, background: C.aiBg, border: "1px solid #c7d2fe", borderRadius: 8, fontSize: 12, color: "#3730a3" }}
        >
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <span style={{ color: C.ai }}>·</span>
          <button
            type="button"
            data-testid="rules-bulk-pause"
            onClick={() => { for (const id of selected) onRowAction("pause", id); setSelected(new Set()); }}
            style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            Pause selected
          </button>
          <button
            type="button"
            data-testid="rules-bulk-resume"
            onClick={() => { for (const id of selected) onRowAction("resume", id); setSelected(new Set()); }}
            style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            Resume selected
          </button>
          <button
            type="button"
            data-testid="rules-bulk-archive"
            onClick={() => { for (const id of selected) onRowAction("archive", id); setSelected(new Set()); }}
            style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            Archive selected
          </button>
          <button type="button" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
            Export
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="rules-bulk-clear" onClick={() => setSelected(new Set())} style={{ fontSize: 11, color: C.ai, background: "transparent", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 160px 70px 100px 110px 60px 28px",
            gap: 12, padding: "9px 14px",
            background: "#fafafa", borderBottom: `1px solid ${C.border}`,
            fontSize: 10, fontWeight: 500, color: C.xMuted,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <span
            role="checkbox"
            aria-checked={allSelected}
            tabIndex={0}
            data-testid="rules-select-all"
            onClick={toggleAll}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleAll(); } }}
            style={{
              width: 14, height: 14, borderRadius: 3,
              border: `1px solid ${allSelected ? C.text : "#d1d5db"}`,
              background: allSelected ? C.text : C.surface,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
            }}
          >
            {allSelected ? "✓" : ""}
          </span>
          <span>Rule</span>
          <span>Schedule</span>
          <span style={{ textAlign: "right" }}>Runs 7d</span>
          <span style={{ textAlign: "right" }}>Saved 7d</span>
          <span>Last run</span>
          <span>State</span>
          <span />
        </div>
        {visibleRules.length === 0 && (
          <div data-testid="rules-empty-state" style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
            {showArchived ? "No archived rules." : "No active rules. Add one with + New rule."}
          </div>
        )}
        {visibleRules.map((r, idx) => {
          const sel = selected.has(r.id);
          return (
            <div
              key={r.id}
              data-testid={`rule-row-${r.id}`}
              data-selected={sel}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 160px 70px 100px 110px 60px 28px",
                gap: 12, padding: "10px 14px", alignItems: "center",
                background: sel ? "#f5f3ff" : "#fff",
                boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
                borderBottom: idx < visibleRules.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <span
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                data-testid={`rule-checkbox-${r.id}`}
                onClick={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  });
                }}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setSelected((prev) => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next; }); } }}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1px solid ${sel ? "#6366f1" : "#d1d5db"}`,
                  background: sel ? "#6366f1" : C.surface,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
                }}
              >
                {sel ? "✓" : ""}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{r.name}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>{r.description}</p>
              </div>
              <span style={{ fontSize: 12, color: C.muted }}>{r.schedule}</span>
              <span style={{ fontSize: 12, textAlign: "right" }}>{r.runs7d}</span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: r.saved7d > 0 ? C.good : C.muted }}>
                ${r.saved7d.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>{r.lastRun}</span>
              <ToggleSwitch
                on={r.state === "active"}
                onChange={() => onToggleRule(r.id)}
                data-testid={`rule-toggle-${r.id}`}
                aria-label={`Toggle rule ${r.name}`}
              />
              <RowMenu
                rule={r}
                isArchived={!!r.archived}
                onEdit={() => onRowAction("edit", r.id)}
                onDuplicate={() => onRowAction("duplicate", r.id)}
                onViewRuns={() => onRowAction("view-runs", r.id)}
                onArchive={() => onRowAction("archive", r.id)}
                onUnarchive={() => onRowAction("unarchive", r.id)}
                onDelete={() => onRowAction("delete", r.id)}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: C.muted, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span>Showing {visibleRules.length} of {rules.length}</span>
        {!showArchived && archivedCount > 0 && (
          <button
            type="button"
            data-testid="rules-view-archived-link"
            onClick={() => setShowArchived(true)}
            style={{ fontSize: 12, color: C.ai2, background: "transparent", border: "none", cursor: "pointer" }}
          >
            View archived ({archivedCount}) →
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ history }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ padding: "5px 10px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted }}>Rule: All ▾</span>
        <span style={{ padding: "5px 10px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted }}>Time: Last 7 days ▾</span>
        <span style={{ padding: "5px 10px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted }}>Outcome: Any ▾</span>
        <span style={{ padding: "5px 10px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted }}>Target: Any ▾</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={btnGhost}>Export CSV</button>
      </div>

      <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>
        {history.length} actions in the last 7 days · ${history.reduce((a, b) => a + (b.saved || 0), 0).toLocaleString()} saved ·{" "}
        <a href="/govern/audit" style={{ color: C.ai2, fontWeight: 500 }}>Full audit log →</a>
      </p>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 1fr 100px 80px 140px 28px",
            gap: 12, padding: "9px 14px",
            background: "#fafafa", borderBottom: `1px solid ${C.border}`,
            fontSize: 10, fontWeight: 500, color: C.xMuted,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <span>WHEN</span><span>RULE</span><span>TARGET</span><span>OUTCOME</span>
          <span style={{ textAlign: "right" }}>SAVED</span><span>UNDO</span><span />
        </div>
        {history.map((h, idx) => {
          const tone = outcomeChipTone(h.outcome);
          const undo = undoStateFor(h);
          return (
            <div
              key={h.id}
              data-testid={`history-row-${h.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 1fr 100px 80px 140px 28px",
                gap: 12, padding: "10px 14px", alignItems: "center",
                borderBottom: idx < history.length - 1 ? "1px solid #f3f4f6" : "none",
                fontSize: 12, color: C.text2,
              }}
            >
              <span style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                {new Date(h.when).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ color: C.text, fontWeight: 500 }}>{h.rule}</span>
              <span style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.target}
              </span>
              <span
                data-testid={`history-outcome-${h.id}`}
                data-outcome={h.outcome}
                style={{
                  fontSize: 11, fontWeight: 500, color: tone.color,
                  background: tone.bg, border: `1px solid ${tone.bd}`,
                  padding: "2px 8px", borderRadius: 9999, width: "fit-content",
                }}
              >
                {h.outcome}
              </span>
              <span style={{ textAlign: "right", fontWeight: 600, color: h.saved > 0 ? C.good : C.muted }}>
                ${h.saved.toLocaleString()}
              </span>
              <span data-testid={`history-undo-${h.id}`} data-kind={undo.kind} style={{ fontSize: 11, color: undo.kind === "within" ? C.ai2 : C.muted }}>
                {undo.kind === "within" && `↶ Undo · ${undo.label}`}
                {undo.kind === "auto" && "auto-resumed"}
                {undo.kind === "advisory" && "advisory only"}
                {undo.kind === "expired" && "undo expired"}
              </span>
              <button type="button" style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", color: C.muted, fontSize: 14, cursor: "pointer" }}>⋯</button>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "14px", textAlign: "center", color: C.muted, fontSize: 12, background: "#fafafa", border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 8 }}>
        End of recent actions
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "history" ? "history" : "rules";
  const setTab = (t) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("tab", t); return np; });

  const [rules, setRules] = useState(INITIAL_RULES);
  const [history] = useState(INITIAL_HISTORY);
  const [selected, setSelected] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(params.get("new") === "true");
  const [pendingAutopilotRec, setPendingAutopilotRec] = useState(null);
  const [deleteRule, setDeleteRule] = useState(null);
  const [pauseAllOpen, setPauseAllOpen] = useState(false);
  const { pausedAll } = useAutopilotStatus();

  const activeCount = rules.filter((r) => r.state === "active" && !r.archived).length;

  useEffect(() => {
    setActiveRuleCount(activeCount);
  }, [activeCount]);

  const onToggleRule = (id) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, state: r.state === "active" ? "paused" : "active" } : r));
  };

  const onRowAction = (action, id) => {
    if (action === "pause") {
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, state: "paused" } : r));
      return;
    }
    if (action === "resume") {
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, state: "active" } : r));
      return;
    }
    if (action === "archive") {
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, archived: true, state: "paused" } : r));
      return;
    }
    if (action === "unarchive") {
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, archived: false } : r));
      return;
    }
    if (action === "delete") {
      const rule = rules.find((r) => r.id === id);
      if (rule) setDeleteRule(rule);
      return;
    }
  };

  const handleDeleteConfirm = (id) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setDeleteRule(null);
  };

  const handlePauseAll = () => {
    setAutopilotPausedAll(true);
    setPauseAllOpen(false);
  };

  const handleResumeAll = () => {
    setAutopilotPausedAll(false);
  };

  const handleNewRuleConfigure = ({ recommendation }) => {
    setNewRuleOpen(false);
    setPendingAutopilotRec(recommendation);
  };

  const handleAutopilotApprove = ({ ruleId, dryRun }) => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule-${ruleId}-${Date.now()}`,
        name: pendingAutopilotRec?.title || "New rule",
        description: dryRun ? "Created from recommendation · dry-run pending" : "Created from recommendation",
        schedule: "(set in editor)",
        runs7d: 0,
        saved7d: 0,
        lastRun: "—",
        state: dryRun ? "paused" : "active",
        archived: false,
      },
    ]);
    setPendingAutopilotRec(null);
  };

  const totalSaved7d = rules.reduce((a, b) => a + b.saved7d, 0);
  const actionsThisWeek = history.length;
  const rulesCount = rules.filter((r) => !r.archived).length;

  return (
    <div
      data-testid="autopilot-page"
      style={{ padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box", background: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif", position: "relative" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>Autopilot</h1>
            <span
              data-testid="autopilot-status-pill"
              data-state={pausedAll ? "paused" : "active"}
              style={{
                fontSize: 11, fontWeight: 500,
                color: pausedAll ? "#b45309" : C.good,
                background: pausedAll ? C.warnBg : C.goodBg,
                border: `1px solid ${pausedAll ? "#fde68a" : "#bbf7d0"}`,
                padding: "2px 8px", borderRadius: 9999,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, background: pausedAll ? C.warn : C.good }} />
              {pausedAll ? "Paused (all)" : "Active"}
            </span>
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
            {activeCount} of {rulesCount} rules active · {actionsThisWeek} actions this week saved <b style={{ color: C.good }}>${totalSaved7d.toLocaleString()}</b>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pausedAll ? (
            <button type="button" data-testid="autopilot-resume-all" onClick={handleResumeAll} style={btnGhost}>▶ Resume all</button>
          ) : (
            <button type="button" data-testid="autopilot-pause-all" onClick={() => setPauseAllOpen(true)} style={btnGhost}>⏸ Pause all</button>
          )}
          <button type="button" data-testid="autopilot-safety" style={btnGhost}>⚙ Safety</button>
          <button type="button" data-testid="autopilot-new-rule" onClick={() => setNewRuleOpen(true)} style={btnPrimary}>+ New rule</button>
        </div>
      </div>

      {pausedAll && (
        <div data-testid="autopilot-paused-banner" style={{ padding: "8px 12px", marginBottom: 12, background: C.warnBg, border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
          Autopilot is paused — no rules will fire until you resume.
        </div>
      )}

      <div role="tablist" aria-label="Autopilot tabs" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {[
          { id: "rules", label: "Rules", count: rules.filter((r) => !r.archived).length },
          { id: "history", label: "History", count: history.length },
        ].map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`autopilot-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 18px", fontSize: 14,
                background: "none", border: "none", cursor: "pointer",
                color: on ? C.text : C.muted,
                fontWeight: on ? 500 : 400,
                borderBottom: on ? "2px solid #111827" : "2px solid transparent",
                marginBottom: -1,
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              {t.label}
              <span style={{ fontSize: 11, color: C.xMuted, fontWeight: 400 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "rules" ? (
        <RulesTab
          rules={rules}
          selected={selected}
          setSelected={setSelected}
          onToggleRule={onToggleRule}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          onRowAction={onRowAction}
        />
      ) : (
        <HistoryTab history={history} />
      )}

      {newRuleOpen && (
        <NewRuleModal onCancel={() => setNewRuleOpen(false)} onConfigure={handleNewRuleConfigure} />
      )}
      {pendingAutopilotRec && (
        <SendToAutopilotModal
          recommendation={pendingAutopilotRec}
          onCancel={() => setPendingAutopilotRec(null)}
          onApprove={handleAutopilotApprove}
        />
      )}
      {deleteRule && (
        <DeleteRuleDialog
          rule={deleteRule}
          onCancel={() => setDeleteRule(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {pauseAllOpen && (
        <PauseAllConfirmDialog onCancel={() => setPauseAllOpen(false)} onConfirm={handlePauseAll} />
      )}
    </div>
  );
}
