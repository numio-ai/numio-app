import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const PL = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff", bg: "#f9fafb",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
  good: "#16a34a", goodBg: "#f0fdf4", goodBd: "#dcfce7",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const INITIAL_POLICIES = [
  { id: "p-1", name: "Required tags on production resources", desc: "Resources in env:production must have cost-center, team, owner.", type: "Tag governance", mode: "block", violations: 6, scope: "env:production · all providers", enabled: true, lastChanged: "2026-05-12" },
  { id: "p-2", name: "PR cost regression guard", desc: "Block PRs projected to increase team monthly spend by >5%.", type: "CI guard", mode: "block", violations: 1, scope: "github://payments/* · +2 repos", enabled: true, lastChanged: "2026-05-08" },
  { id: "p-3", name: "Region lock — production data", desc: "Prod data resources may only run in us-east-1 and us-west-2.", type: "Placement", mode: "warn", violations: 0, scope: "rds, s3, opensearch · env:production", enabled: true, lastChanged: "2026-04-30" },
  { id: "p-4", name: "GPU instance approval", desc: "g5.* and p4.* instances require approval from ML Platform.", type: "Approval", mode: "block", violations: 0, scope: "ec2 g5.*, p4.* · all accounts", enabled: true, lastChanged: "2026-04-22" },
  { id: "p-5", name: "Auto-delete unattached EBS after 30 days", desc: "Snapshot then delete EBS volumes unattached for 30+ days.", type: "Lifecycle", mode: "auto", violations: 38, scope: "ebs · all accounts", enabled: true, lastChanged: "2026-05-15" },
  { id: "p-6", name: "Disallow public S3 buckets in prod", desc: "Block creation of S3 buckets with public ACLs in production.", type: "Security", mode: "block", violations: 0, scope: "s3 · env:production", enabled: true, lastChanged: "2026-03-18" },
  { id: "p-7", name: "AI model spend caps", desc: "Workloads must declare a monthly token budget; throttle at 95%.", type: "AI governance", mode: "warn", violations: 2, scope: "openai://*, anthropic://*", enabled: false, lastChanged: "2026-05-02" },
];

const MODE_COLOR = {
  block: { c: PL.danger, bg: PL.dangerBg, b: PL.dangerBd, label: "Block" },
  warn: { c: PL.warn, bg: PL.warnBg, b: PL.warnBd, label: "Warn" },
  auto: { c: PL.ai2, bg: PL.aiBg, b: PL.aiBd, label: "Auto-remediate" },
};

const PL_VIEWS = [
  { id: "all", label: "All policies", owner: "shared", filter: (p) => true },
  { id: "violations", label: "With open violations", owner: "shared", note: "3 policies · 47 violations", filter: (p) => p.violations > 0 },
  { id: "block", label: "Blocking policies", owner: "shared", filter: (p) => p.mode === "block" },
  { id: "disabled", label: "Disabled", owner: "shared", filter: (p) => !p.enabled },
  { id: "mine", label: "Created by me", owner: "you", filter: () => true },
];

const btnGhost = { fontSize: 12, color: PL.muted, background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: PL.text, border: "none", borderRadius: 6, padding: "5px 14px", fontWeight: 500, cursor: "pointer" };

function ToggleSwitch({ on, onChange, "data-testid": testId, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onChange}
      style={{
        width: 30, height: 18, padding: 0, position: "relative",
        background: on ? PL.text : "#d1d5db", border: "none",
        borderRadius: 9, cursor: "pointer", transition: "background 150ms",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 14, height: 14, borderRadius: 7, background: "#fff", transition: "left 150ms", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function ViewsPicker({ activeId, onSelect, onCopyLink }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const active = PL_VIEWS.find((v) => v.id === activeId) || PL_VIEWS[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="policies-views-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13,
          background: open ? "#f3f4f6" : PL.surface, border: `1px solid ${PL.border}`, borderRadius: 6,
          color: PL.text, fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: PL.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: PL.xMuted }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Saved views" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 320, background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 6, zIndex: 50,
        }}>
          {PL_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`policies-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: on ? "#f3f4f6" : "transparent", cursor: "pointer" }}
              >
                <span style={{ width: 14, color: PL.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: PL.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: PL.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button
                  type="button"
                  title="Copy link"
                  onClick={(e) => { e.stopPropagation(); onCopyLink(v); }}
                  style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: PL.muted, cursor: "pointer" }}
                >
                  🔗
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RowMenu({ policy, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={`policy-row-menu-${policy.id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: 24, height: 24, padding: 0, background: "transparent", border: "none", color: PL.muted, fontSize: 14, lineHeight: 1, cursor: "pointer" }}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          minWidth: 160, background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, zIndex: 30,
        }}>
          {["Open editor", "Duplicate", "View violations", "Change mode…", "Disable"].map((label) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              data-testid={`policy-row-menu-${policy.id}-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}
              onClick={() => { setOpen(false); onAction(label, policy.id); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 12, color: PL.text2, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PoliciesPage() {
  const [params, setParams] = useSearchParams();
  const viewId = params.get("view") || "all";

  const [policies, setPolicies] = useState(INITIAL_POLICIES);
  const [selected, setSelected] = useState(new Set());
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);

  const setView = (v) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("view", v.id); return np; });

  const onCopyLink = useCallback((view) => {
    const url = new URL(window.location.href);
    if (view?.id) url.searchParams.set("view", view.id);
    try { navigator.clipboard?.writeText(url.toString()); } catch { /* noop */ }
  }, []);

  const view = PL_VIEWS.find((v) => v.id === viewId) || PL_VIEWS[0];
  const filtered = useMemo(() => policies.filter(view.filter), [policies, view]);

  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const togglePolicy = (id) => {
    setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const bulkAction = (action) => {
    setPolicies((prev) => prev.map((p) => {
      if (!selected.has(p.id)) return p;
      if (action === "enable") return { ...p, enabled: true };
      if (action === "disable") return { ...p, enabled: false };
      return p;
    }));
    setSelected(new Set());
  };

  const activeCount = policies.filter((p) => p.enabled).length;
  const blockingCount = policies.filter((p) => p.enabled && p.mode === "block").length;
  const autoCount = policies.filter((p) => p.enabled && p.mode === "auto").length;
  const totalViolations = policies.reduce((a, p) => a + p.violations, 0);
  const selCount = selected.size;

  return (
    <div
      data-testid="policies-page"
      style={{ padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box", background: PL.bg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: PL.text, margin: 0 }}>Policies</h1>
          <p data-testid="policies-subtitle" style={{ fontSize: 13, color: PL.muted, margin: "4px 0 0" }}>
            <b style={{ color: PL.text2, fontWeight: 600 }}>{activeCount}</b> active policies
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: PL.danger, fontWeight: 600 }}>{blockingCount}</b> blocking
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: PL.ai2, fontWeight: 600 }}>{autoCount}</b> auto-remediate
            <span style={{ color: PL.xMuted }}> · </span>
            <b style={{ color: PL.warn, fontWeight: 600 }}>{totalViolations}</b> open violations
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" data-testid="policies-rescan" style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>⟳ Rescan</span>
            <span style={{ color: PL.xMuted, fontWeight: 400 }}>· last 2h ago</span>
          </button>
          <button type="button" data-testid="policies-new" onClick={() => setNewPolicyOpen(true)} style={btnPrimary}>+ New policy</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ViewsPicker activeId={viewId} onSelect={setView} onCopyLink={onCopyLink} />
        <button type="button" onClick={() => onCopyLink(null)} style={btnGhost}>🔗 Share link</button>
        <button type="button" style={btnGhost}>Save as…</button>
        <span style={{ flex: 1 }} />
        <a href="https://docs.numio.local/policies" data-testid="policies-library-link" style={{ fontSize: 12, color: PL.ai2, textDecoration: "none" }}>
          Policy library →
        </a>
      </div>

      {selCount > 0 && (
        <div data-testid="policies-bulk-action-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 8, background: PL.aiBg, border: `1px solid ${PL.aiBd}`, borderRadius: 8, fontSize: 12, color: "#3730a3" }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: PL.ai }}>·</span>
          <button type="button" data-testid="policies-bulk-enable" onClick={() => bulkAction("enable")} style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${PL.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Enable</button>
          <button type="button" data-testid="policies-bulk-disable" onClick={() => bulkAction("disable")} style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${PL.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Disable</button>
          <button type="button" data-testid="policies-bulk-change-mode" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${PL.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Change mode…</button>
          <button type="button" data-testid="policies-bulk-export" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${PL.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Export</button>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="policies-bulk-clear" onClick={() => setSelected(new Set())} style={{ fontSize: 11, color: PL.ai, background: "transparent", border: "none", cursor: "pointer" }}>Clear</button>
        </div>
      )}

      <div style={{ background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 130px 130px 90px 110px 36px 28px",
            gap: 12, padding: "9px 14px",
            background: "#fafafa", borderBottom: `1px solid ${PL.border}`,
            fontSize: 10, fontWeight: 500, color: PL.xMuted,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <span />
          <span>NAME</span>
          <span>TYPE</span>
          <span>MODE</span>
          <span>OPEN VIOLATIONS</span>
          <span>LAST CHANGED</span>
          <span>ENABLED</span>
          <span />
        </div>
        {filtered.length === 0 && (
          <div data-testid="policies-empty-state" style={{ padding: "40px 20px", textAlign: "center", color: PL.muted, fontSize: 13 }}>
            No policies match this view.
          </div>
        )}
        {filtered.map((p, idx) => {
          const m = MODE_COLOR[p.mode];
          const sel = selected.has(p.id);
          return (
            <div
              key={p.id}
              data-testid={`policy-row-${p.id}`}
              data-selected={sel}
              data-mode={p.mode}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 130px 130px 90px 110px 36px 28px",
                gap: 12, alignItems: "center", padding: "12px 14px",
                borderBottom: idx < filtered.length - 1 ? "1px solid #f3f4f6" : "none",
                background: sel ? "#f5f3ff" : PL.surface,
                boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
              }}
            >
              <span
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                data-testid={`policy-checkbox-${p.id}`}
                onClick={() => toggleRow(p.id)}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleRow(p.id); } }}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1px solid ${sel ? PL.ai : "#d1d5db"}`,
                  background: sel ? PL.ai : PL.surface,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
                }}
              >
                {sel ? "✓" : ""}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: PL.text, display: "flex", alignItems: "center", gap: 8 }}>
                  {p.name}
                  {p.violations > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: PL.danger, background: PL.dangerBg, padding: "1px 7px", borderRadius: 9, border: `1px solid ${PL.dangerBd}` }}>
                      {p.violations} violation{p.violations === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: PL.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                <div style={{ fontSize: 11, color: PL.xMuted, fontFamily: "JetBrains Mono, monospace", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.scope}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: PL.text2, background: "#f3f4f6", padding: "3px 10px", borderRadius: 4, border: `1px solid ${PL.border}`, width: "fit-content" }}>
                {p.type}
              </span>
              <span
                data-testid={`policy-mode-chip-${p.id}`}
                data-mode={p.mode}
                style={{ fontSize: 11, fontWeight: 500, color: m.c, background: m.bg, padding: "3px 10px", borderRadius: 4, border: `1px solid ${m.b}`, width: "fit-content" }}
              >
                {m.label}
              </span>
              <span style={{ fontSize: 12, color: p.violations > 0 ? PL.danger : PL.muted, fontWeight: p.violations > 0 ? 600 : 400 }}>
                {p.violations}
              </span>
              <span style={{ fontSize: 11, color: PL.muted, fontFamily: "JetBrains Mono, monospace" }}>{p.lastChanged}</span>
              <ToggleSwitch
                on={p.enabled}
                onChange={() => togglePolicy(p.id)}
                data-testid={`policy-toggle-${p.id}`}
                ariaLabel={`Toggle policy ${p.name}`}
              />
              <RowMenu policy={p} onAction={() => {}} />
            </div>
          );
        })}
      </div>

      {newPolicyOpen && (
        <div
          data-testid="policies-new-stub"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setNewPolicyOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}
        >
          <div style={{ width: 440, background: PL.surface, border: `1px solid ${PL.border}`, borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: PL.text, margin: 0 }}>New policy</h2>
            <p style={{ fontSize: 13, color: PL.muted, margin: "10px 0 16px" }}>
              The policy authoring surface is being built. Track in <code style={{ fontFamily: "JetBrains Mono, monospace" }}>ia_v2_be_policies</code>.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setNewPolicyOpen(false)} style={btnPrimary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
