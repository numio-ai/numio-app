import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  TG_SCHEMA,
  TG_RESOURCES_ALL,
  TG_VIEWS,
  classifyCell,
  rowCoverageState,
  applyFilter,
  coverageColor,
} from "./tagGovernanceMockData";
import ApplyTagModal from "../../components/ApplyTagModal";
import { listSchemaConflicts } from "../../api/tagGovernance";

const TG = {
  text: "#111827", text2: "#374151", muted: "#6b7280", xMuted: "#9ca3af",
  border: "#e5e5e5", surface: "#fff",
  ai: "#6366f1", aiBg: "#eef2ff", aiBd: "#ddd6fe", ai2: "#4f46e5",
  success: "#16a34a", successBg: "#f0fdf4", successBd: "#bbf7d0",
  warn: "#d97706", warnBg: "#fffbeb", warnBd: "#fde68a",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBd: "#fecaca",
};

const PAGE_SIZE = 50;
const REQUIRED_KEYS = TG_SCHEMA.filter((s) => s.required);

const btnGhost = { fontSize: 12, color: TG.muted, background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" };
const btnPrimary = { fontSize: 12, color: "#fff", background: TG.text, fontWeight: 500, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer" };

const CELL = {
  ok: { bg: TG.successBg, border: TG.successBd, color: TG.success, kind: "ok" },
  drift: { bg: TG.warnBg, border: TG.warnBd, color: TG.warn, kind: "drift" },
  "missing-req": { bg: TG.dangerBg, border: TG.dangerBd, color: TG.danger, kind: "missing-req" },
  "missing-opt": { bg: "#f9fafb", border: "#e5e7eb", color: TG.xMuted, kind: "missing-opt" },
};

function TagChip({ value, schema }) {
  const cls = classifyCell(value, schema);
  const c = CELL[cls];
  const title = cls === "drift" ? "Drift: not in allowed values" : cls === "missing-req" ? "Required tag missing" : cls === "missing-opt" ? "Optional tag missing" : value;
  return (
    <span
      data-testid={`tg-cell-${schema.key}`}
      data-cell-kind={c.kind}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 7px", borderRadius: 3,
        background: c.bg, border: `1px solid ${c.border}`,
        color: c.color,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11, fontWeight: 500,
        maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
      title={title}
    >
      {value == null ? (schema.required ? "—" : "·") : value}
    </span>
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
  const active = TG_VIEWS.find((v) => v.id === activeId) || TG_VIEWS[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="tg-views-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13,
          background: open ? "#f3f4f6" : TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6,
          color: TG.text, fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: TG.xMuted, fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: TG.xMuted }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Saved views" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 340, background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: TG.xMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button type="button" style={{ fontSize: 11, color: TG.muted, background: "transparent", border: "none", cursor: "pointer" }}>+ Save current</button>
          </div>
          {TG_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`tg-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: on ? "#f3f4f6" : "transparent", cursor: "pointer" }}
              >
                <span style={{ width: 14, color: TG.text, fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TG.text, fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: TG.xMuted }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : "Shared workspace view"}
                  </div>
                </div>
                <button
                  type="button"
                  title="Copy link"
                  data-testid={`tg-view-copy-${v.id}`}
                  onClick={(e) => { e.stopPropagation(); onCopyLink(v); }}
                  style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: TG.muted, cursor: "pointer" }}
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

function ResourcesPane({ viewId, onViewSelect, onCopyLink, statusFilter, setStatusFilter, search, setSearch }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const sentinelRef = useRef(null);

  const view = TG_VIEWS.find((v) => v.id === viewId) || TG_VIEWS[0];
  const baseFilter = statusFilter || view.filter || "all";

  const filtered = useMemo(() => {
    let items = applyFilter(baseFilter, TG_RESOURCES_ALL);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r) => {
        if (r.name.toLowerCase().includes(q)) return true;
        if (r.id.toLowerCase().includes(q)) return true;
        return Object.values(r.tags || {}).some((v) => String(v).toLowerCase().includes(q));
      });
    }
    return items;
  }, [baseFilter, search]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) setPage((p) => p + 1);
      }
    }, { rootMargin: "200px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const missingReqCount = useMemo(() => applyFilter("missing-req", TG_RESOURCES_ALL).length, []);
  const driftCount = useMemo(() => applyFilter("drift", TG_RESOURCES_ALL).length, []);
  const totalCount = TG_RESOURCES_ALL.length;

  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const clearSelection = () => setSelected(new Set());
  const selCount = selected.size;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ViewsPicker activeId={viewId} onSelect={onViewSelect} onCopyLink={onCopyLink} />
        <button type="button" onClick={() => onCopyLink(null)} style={btnGhost}>🔗 Share link</button>
        <button type="button" style={btnGhost}>Save as…</button>
        <span style={{ flex: 1 }} />
        <Link to="/govern/audit" data-testid="tg-activity-link" style={{ fontSize: 12, color: TG.ai2, textDecoration: "none" }}>
          Activity →
        </Link>
      </div>

      <div data-testid="tg-status-segmented" style={{ display: "inline-flex", border: `1px solid ${TG.border}`, borderRadius: 6, background: TG.surface, marginBottom: 8 }}>
        {[
          { id: "all", label: `All (${totalCount.toLocaleString()})` },
          { id: "missing-req", label: `Missing required (${missingReqCount})` },
          { id: "drift", label: `Drift (${driftCount})` },
        ].map((s) => {
          const on = (statusFilter || view.filter || "all") === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`tg-status-${s.id}`}
              aria-selected={on}
              onClick={() => { setStatusFilter(s.id); setPage(1); }}
              style={{
                padding: "5px 12px", fontSize: 12,
                background: on ? TG.text : "transparent",
                color: on ? "#fff" : TG.muted,
                border: "none", borderRight: `1px solid ${TG.border}`,
                fontWeight: on ? 500 : 400, cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 13, background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 6 }}>
          <span style={{ color: TG.xMuted }}>🔍</span>
          <input
            data-testid="tg-search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, ID, or tag value…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: TG.text, fontFamily: "inherit" }}
          />
        </div>
        {selCount === 0 && (
          <span style={{ fontSize: 11, color: TG.xMuted }} data-testid="tg-status-line">
            Showing 1–{visible.length} of {filtered.length.toLocaleString()}
          </span>
        )}
      </div>

      {selCount > 0 && (
        <div data-testid="tg-bulk-action-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 8, background: TG.aiBg, border: `1px solid ${TG.aiBd}`, borderRadius: 8, fontSize: 12, color: "#3730a3" }}>
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: TG.ai }}>·</span>
          <button type="button" data-testid="tg-bulk-apply-tag" onClick={() => setApplyOpen(true)} style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${TG.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Apply tag…</button>
          <button type="button" data-testid="tg-bulk-suggest" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${TG.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>✨ Suggest with Numio</button>
          <button type="button" data-testid="tg-bulk-rename" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${TG.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Bulk rename value</button>
          <button type="button" data-testid="tg-bulk-export" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: `1px solid ${TG.aiBd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Export</button>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="tg-bulk-clear" onClick={clearSelection} style={{ fontSize: 11, color: TG.ai, background: "transparent", border: "none", cursor: "pointer" }}>Clear</button>
        </div>
      )}

      <div style={{ background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `28px 1fr 90px 90px ${REQUIRED_KEYS.map(() => "110px").join(" ")} 28px`,
            gap: 12, padding: "9px 14px",
            background: "#fafafa", borderBottom: `1px solid ${TG.border}`,
            fontSize: 10, fontWeight: 500, color: TG.xMuted,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <span />
          <span>RESOURCE</span>
          <span>SERVICE</span>
          <span style={{ textAlign: "right" }}>SPEND/MO</span>
          {REQUIRED_KEYS.map((s) => (
            <span key={s.key} style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "none", color: TG.xMuted }}>
              tag:{s.key}
            </span>
          ))}
          <span />
        </div>

        {visible.length === 0 && (
          <div data-testid="tg-empty-state" style={{ padding: "40px 20px", textAlign: "center", color: TG.muted, fontSize: 13 }}>
            No resources match this view.
          </div>
        )}

        {visible.map((r, idx) => {
          const sel = selected.has(r.id);
          return (
            <div
              key={r.id}
              data-testid={`tg-row-${r.id}`}
              data-selected={sel}
              style={{
                display: "grid",
                gridTemplateColumns: `28px 1fr 90px 90px ${REQUIRED_KEYS.map(() => "110px").join(" ")} 28px`,
                gap: 12, padding: "10px 14px", alignItems: "center",
                minHeight: 36, height: 36,
                background: sel ? "#f5f3ff" : TG.surface,
                boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
                borderBottom: idx < visible.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <span
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                data-testid={`tg-checkbox-${r.id}`}
                onClick={() => toggleRow(r.id)}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleRow(r.id); } }}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1px solid ${sel ? "#6366f1" : "#d1d5db"}`,
                  background: sel ? "#6366f1" : TG.surface,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
                }}
              >
                {sel ? "✓" : ""}
              </span>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: TG.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                  {r.name === "—" ? r.id : r.name}
                </span>
                <span style={{ fontSize: 11, color: TG.xMuted, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>
                  {r.name === "—" ? "" : r.id}
                </span>
              </div>
              <span style={{ fontSize: 12, color: TG.muted }}>{r.svc}</span>
              <span style={{ fontSize: 12, color: TG.text2, fontWeight: 600, textAlign: "right" }}>${r.spend.toLocaleString()}</span>
              {REQUIRED_KEYS.map((s) => (
                <TagChip key={s.key} value={r.tags?.[s.key]} schema={s} />
              ))}
              <button type="button" aria-label="Row actions" style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", color: TG.xMuted, fontSize: 14, cursor: "pointer" }}>⋯</button>
            </div>
          );
        })}

        <div
          ref={sentinelRef}
          data-testid="tg-infinite-sentinel"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", fontSize: 12, color: TG.muted, background: "#fafafa", borderTop: `1px solid ${TG.border}` }}
        >
          {hasMore ? "Loading more…" : "End of results"}
        </div>
      </div>

      {applyOpen && (
        <ApplyTagModal
          resourceIds={[...selected]}
          onClose={() => setApplyOpen(false)}
          onApplied={clearSelection}
        />
      )}
    </div>
  );
}

const CONFLICT_LABELS = {
  required_mismatch: "Required mismatch",
  allowed_values_diff: "Allowed values differ",
  case_sensitivity: "Case sensitivity",
  missing_in_numio: "Missing in Numio",
};

function SchemaConflicts({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div
      data-testid="tg-schema-conflicts"
      style={{
        marginBottom: 12, background: TG.dangerBg, border: `1px solid ${TG.dangerBd}`,
        borderRadius: 10, padding: "10px 14px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: TG.danger, marginBottom: 6 }}>
        {conflicts.length} conflict(s) with the AWS Organizations tag policy
      </div>
      {conflicts.map((c) => (
        <div
          key={`${c.tag_key}-${c.conflict_type}`}
          data-testid={`tg-conflict-${c.tag_key}-${c.conflict_type}`}
          style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0", fontSize: 12, color: TG.text2 }}
        >
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500, color: TG.text }}>{c.tag_key}</span>
          <span style={{ fontSize: 10, color: TG.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {CONFLICT_LABELS[c.conflict_type] || c.conflict_type}
          </span>
          <span>{c.detail}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: 11, color: TG.muted }}>
        Read-only — Numio does not reconcile AWS Org policies in this release.
      </div>
    </div>
  );
}

function SchemaPane({ conflicts = [] }) {
  return (
    <div>
      <SchemaConflicts conflicts={conflicts} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="tg-new-tag-key" style={btnPrimary}>+ New tag key</button>
      </div>
      <div data-testid="tg-schema-table" style={{ background: TG.surface, border: `1px solid ${TG.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 1fr 90px 110px 28px",
            gap: 12, padding: "9px 14px",
            background: "#fafafa", borderBottom: `1px solid ${TG.border}`,
            fontSize: 10, fontWeight: 500, color: TG.xMuted,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <span>KEY</span><span>REQUIRED</span><span>ALLOWED VALUES</span><span style={{ textAlign: "right" }}>COVERAGE</span><span>OWNER</span><span />
        </div>
        {TG_SCHEMA.map((s, idx) => {
          const tone = coverageColor(s.coverage);
          return (
            <div
              key={s.key}
              data-testid={`tg-schema-row-${s.key}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 1fr 90px 110px 28px",
                gap: 12, padding: "10px 14px", alignItems: "center",
                borderBottom: idx < TG_SCHEMA.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: TG.text, fontWeight: 500 }}>{s.key}</span>
              <span style={{ fontSize: 11, color: s.required ? TG.danger : TG.muted, fontWeight: s.required ? 600 : 400 }}>
                {s.required ? "required" : "optional"}
              </span>
              <span style={{ fontSize: 11, color: TG.muted, fontFamily: "JetBrains Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.allowed ? s.allowed.join(", ") : "(any value)"}
              </span>
              <span
                data-testid={`tg-coverage-${s.key}`}
                data-coverage-tone={s.coverage >= 85 ? "ok" : s.coverage >= 60 ? "warn" : "danger"}
                style={{
                  fontSize: 11, fontWeight: 600, color: tone.color,
                  background: tone.bg, border: `1px solid ${tone.bd}`,
                  padding: "2px 8px", borderRadius: 9999, textAlign: "right", width: "fit-content", marginLeft: "auto",
                }}
              >
                {s.coverage}%
              </span>
              <span style={{ fontSize: 12, color: TG.muted }}>{s.owner}</span>
              <button type="button" aria-label={`Edit ${s.key}`} style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", color: TG.xMuted, fontSize: 14, cursor: "pointer" }}>⋯</button>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 10, fontSize: 12, color: TG.muted }}>
        Schema changes are versioned · <Link to="/govern/audit" style={{ color: TG.ai2, textDecoration: "none" }}>Activity →</Link>
      </p>
    </div>
  );
}

export default function TagGovernancePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "schema" ? "schema" : "resources";
  const viewId = params.get("view") || "missing-req";
  const statusFilter = params.get("status") || null;
  const search = params.get("q") || "";

  const [conflicts, setConflicts] = useState([]);
  useEffect(() => {
    let active = true;
    listSchemaConflicts()
      .then((res) => { if (active) setConflicts(res?.conflicts || []); })
      .catch(() => { if (active) setConflicts([]); });
    return () => { active = false; };
  }, []);

  const setTab = (t) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("tab", t); return np; });
  const setStatus = (s) => setParams((prev) => { const np = new URLSearchParams(prev); if (s) np.set("status", s); else np.delete("status"); return np; });
  const setSearchParam = (s) => setParams((prev) => { const np = new URLSearchParams(prev); if (s) np.set("q", s); else np.delete("q"); return np; });
  const setView = (v) => setParams((prev) => {
    const np = new URLSearchParams(prev);
    np.set("view", v.id);
    if (v.filter) np.set("status", v.filter);
    return np;
  });

  const onCopyLink = useCallback((view) => {
    const url = new URL(window.location.href);
    if (view?.id) url.searchParams.set("view", view.id);
    try { navigator.clipboard?.writeText(url.toString()); } catch { /* noop */ }
  }, []);

  return (
    <div
      data-testid="tag-governance-page"
      style={{ padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box", background: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: TG.text, margin: 0 }}>Tag Governance</h1>
          <p style={{ fontSize: 13, color: TG.muted, margin: "4px 0 0" }}>
            73% required-tag coverage · 5 missing-required · 1 drift · $7.4k/mo at risk
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Tag governance tabs" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${TG.border}`, marginBottom: 16 }}>
        {[
          { id: "resources", label: "Resources" },
          { id: "schema", label: "Tag schema" },
        ].map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`tg-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 18px", fontSize: 14,
                background: "none", border: "none", cursor: "pointer",
                color: on ? TG.text : TG.muted,
                fontWeight: on ? 500 : 400,
                borderBottom: on ? "2px solid #111827" : "2px solid transparent",
                marginBottom: -1,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              {t.id === "schema" && conflicts.length > 0 && (
                <span
                  data-testid="tg-schema-conflicts-badge"
                  title={`${conflicts.length} schema conflict(s) with the AWS Org tag policy`}
                  style={{
                    fontSize: 11, fontWeight: 600, lineHeight: 1,
                    color: TG.danger, background: TG.dangerBg, border: `1px solid ${TG.dangerBd}`,
                    padding: "2px 7px", borderRadius: 9999,
                  }}
                >
                  {conflicts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "resources" ? (
        <ResourcesPane
          viewId={viewId}
          onViewSelect={setView}
          onCopyLink={onCopyLink}
          statusFilter={statusFilter}
          setStatusFilter={setStatus}
          search={search}
          setSearch={setSearchParam}
        />
      ) : (
        <SchemaPane conflicts={conflicts} />
      )}
    </div>
  );
}
