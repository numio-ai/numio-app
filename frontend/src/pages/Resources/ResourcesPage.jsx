import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  RESOURCES_ALL,
  TOTAL_RESOURCES_COUNT,
  RES_COLUMNS,
  RES_SAVED_VIEWS,
  DEFAULT_COLUMN_IDS,
  TAG_DIM_COUNT,
  PLATFORM_DIM_COUNT,
  STATE_KINDS,
  stateOf,
} from "./resourcesMockData";

const PAGE_SIZE = 50;

function useOutsideClick(ref, onClose, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [enabled, onClose, ref]);
}

function StateCell({ state }) {
  const s = stateOf(state);
  if (s.kind === "none") {
    return <span data-testid="state-cell" data-state-kind="none" style={{ color: "#d1d5db", fontSize: 13 }}>—</span>;
  }
  const k = STATE_KINDS[s.kind];
  return (
    <span data-testid="state-cell" data-state-kind={s.kind} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: k.color }} />
      <span style={{ fontSize: 12, color: "#374151" }}>{s.label}</span>
    </span>
  );
}

function TagsCell({ gaps }) {
  if (gaps === 0) {
    return (
      <span title="All required tags present" style={{
        display: "inline-flex", width: 18, height: 18, borderRadius: 9,
        alignItems: "center", justifyContent: "center",
        background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, lineHeight: 1,
      }}>✓</span>
    );
  }
  return (
    <span title={`${gaps} required tag${gaps === 1 ? "" : "s"} missing`} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, color: "#dc2626",
      background: "#fef2f2", border: "1px solid #fecaca",
      padding: "1px 6px", borderRadius: 9, lineHeight: 1.4,
    }}>
      ⚠ {gaps}
    </span>
  );
}

function renderCell(r, col) {
  switch (col.id) {
    case "name":
      return (
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
            {r.name === "—" ? r.id : r.name}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.name === "—" ? "" : r.id.length > 24 ? r.id.slice(0, 22) + "…" : r.id}
          </span>
        </div>
      );
    case "svc":
      return <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{r.svc}</span>;
    case "type":
      return <span style={{ fontSize: 12, color: "#6b7280" }}>{r.type}</span>;
    case "state":
      return <StateCell state={r.state} />;
    case "region":
      return <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "JetBrains Mono, monospace" }}>{r.region}</span>;
    case "acct":
      return <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "JetBrains Mono, monospace" }}>···{r.acct.slice(-4)}</span>;
    case "spend":
      return <span style={{ fontSize: 13, fontWeight: 600, color: r.spend === 0 ? "#9ca3af" : "#111827", fontVariantNumeric: "tabular-nums" }}>${r.spend.toLocaleString()}</span>;
    case "gaps":
      return <TagsCell gaps={r.gaps} />;
    default:
      if (col.tag) {
        const k = col.id.slice(4);
        const v = r.tags?.[k];
        if (v == null) {
          return (
            <span data-testid={`tag-cell-missing-${k}`} style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "1px 6px", borderRadius: 3, fontFamily: "JetBrains Mono, monospace" }}>
              —
            </span>
          );
        }
        return (
          <span data-testid={`tag-cell-${k}`} style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", padding: "1px 6px", borderRadius: 3, fontFamily: "JetBrains Mono, monospace" }}>
            {v}
          </span>
        );
      }
      return <span style={{ color: "#d1d5db" }}>—</span>;
  }
}

function ViewsPicker({ activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const active = RES_SAVED_VIEWS.find((v) => v.id === activeId) || RES_SAVED_VIEWS[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="resources-views-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 13,
          background: open ? "#f3f4f6" : "#fff",
          border: "1px solid #e5e5e5", borderRadius: 6,
          color: "#111827", fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>View:</span>
        {active.label}
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Saved views" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 340, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 6, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button type="button" style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer" }}>+ Save current</button>
          </div>
          {RES_SAVED_VIEWS.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`resources-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                  borderRadius: 6, background: on ? "#f3f4f6" : "transparent", cursor: "pointer",
                }}
              >
                <span style={{ width: 14, color: "#111827", fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#111827", fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {v.note ? v.note : v.owner === "you" ? "Created by you" : v.owner === "shared" ? "Shared workspace view" : `Shared by ${v.owner}`}
                  </div>
                </div>
                <button type="button" title="Copy link" style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: "#6b7280", cursor: "pointer" }}>🔗</button>
                <button type="button" title="More" style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: "#6b7280", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>⋯</button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <button type="button" style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#6b7280", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Manage all views…
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnsPicker({ activeCols, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const sections = [
    { title: "Always shown", items: RES_COLUMNS.filter((c) => c.always) },
    { title: "Built-in", items: RES_COLUMNS.filter((c) => !c.always && !c.tag) },
    { title: "Tag columns", items: RES_COLUMNS.filter((c) => c.tag) },
  ];
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        data-testid="resources-columns-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12,
          background: open ? "#f3f4f6" : "#fff",
          border: "1px solid #e5e5e5", borderRadius: 6,
          color: "#111827", fontWeight: 500, cursor: "pointer",
        }}
      >
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>Columns:</span>
        {activeCols.length}
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Columns" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: 280, maxHeight: 460, overflow: "auto",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 8, zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Columns</span>
          </div>
          {sections.map((s) => (
            <div key={s.title} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", padding: "6px 4px 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.title}</div>
              {s.items.map((c) => {
                const on = activeCols.includes(c.id);
                return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={on}
                    tabIndex={c.always ? -1 : 0}
                    data-testid={`resources-column-option-${c.id}`}
                    onClick={() => { if (!c.always) onToggle(c.id); }}
                    onKeyDown={(e) => { if (!c.always && e.key === "Enter") onToggle(c.id); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 6px", fontSize: 12, color: "#374151",
                      borderRadius: 4, cursor: c.always ? "default" : "pointer",
                      opacity: c.always ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 3,
                      border: `1px solid ${on ? "#111827" : "#d1d5db"}`,
                      background: on ? "#111827" : "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 10, lineHeight: 1,
                    }}>{on ? "✓" : ""}</span>
                    <span style={{ fontFamily: c.tag ? "JetBrains Mono, monospace" : "inherit" }}>{c.label}</span>
                    {c.always && <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>required</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildResourcesCsv(rows, cols) {
  const headers = ["id", "name", ...cols.map((c) => c.id).filter((id) => id !== "name")];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = headers.map((h) => {
      if (h === "id") return r.id;
      if (h === "name") return r.name;
      if (h.startsWith("tag:")) return r.tags?.[h.slice(4)] ?? "";
      return r[h] ?? "";
    });
    lines.push(cells.map(escape).join(","));
  }
  return lines.join("\n");
}

function triggerDownload(filename, content, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ResourceDetailPanel({ resource, onClose }) {
  if (!resource) return null;
  return (
    <div
      data-testid="resources-detail-panel"
      role="dialog"
      aria-label="Resource details"
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420, zIndex: 80,
        background: "#fff", borderLeft: "1px solid #e5e5e5", boxShadow: "-10px 0 30px rgba(0,0,0,0.08)",
        padding: "20px 24px", overflowY: "auto", fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Resource</p>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "4px 0 0", wordBreak: "break-word" }}>{resource.name || resource.id}</h2>
          <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0", wordBreak: "break-all" }}>{resource.id}</p>
        </div>
        <button
          type="button"
          data-testid="resources-detail-close"
          onClick={onClose}
          aria-label="Close detail panel"
          style={{ width: 26, height: 26, padding: 0, background: "transparent", border: "none", color: "#6b7280", fontSize: 18, lineHeight: 1, cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, color: "#111827", marginBottom: 16 }}>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Service</div>{resource.svc}</div>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Type</div>{resource.type}</div>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Region</div>{resource.region}</div>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Account</div>···{resource.acct?.slice(-4)}</div>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>State</div><StateCell state={resource.state} /></div>
        <div><div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Spend/mo</div>${resource.spend?.toLocaleString()}</div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tags</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {Object.keys(resource.tags || {}).length === 0 && <span style={{ fontSize: 12, color: "#9ca3af" }}>No tags</span>}
        {Object.entries(resource.tags || {}).map(([k, v]) => (
          <span key={k} data-testid={`resources-detail-tag-${k}`} style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
            {k}={v}
          </span>
        ))}
      </div>
    </div>
  );
}

function RowActionMenu({ resource, onCopyId, onViewDetails, onClose }) {
  const ref = useRef(null);
  useOutsideClick(ref, onClose, true);
  return (
    <div
      ref={ref}
      data-testid={`resources-row-menu-${resource.id}`}
      role="menu"
      style={{
        position: "absolute", top: 22, right: 0, minWidth: 160,
        background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 4, zIndex: 60,
      }}
    >
      <button
        type="button"
        data-testid={`resources-row-menu-copy-id-${resource.id}`}
        onClick={() => { onCopyId(resource); onClose(); }}
        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 12, color: "#111827", background: "transparent", border: "none", borderRadius: 4, cursor: "pointer" }}
      >
        Copy ID
      </button>
      <button
        type="button"
        data-testid={`resources-row-menu-view-${resource.id}`}
        onClick={() => { onViewDetails(resource); onClose(); }}
        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 12, color: "#111827", background: "transparent", border: "none", borderRadius: 4, cursor: "pointer" }}
      >
        View details
      </button>
    </div>
  );
}

export default function ResourcesPage() {
  const [params, setParams] = useSearchParams();
  const viewId = params.get("view") || "all";
  const density = params.get("density") === "comfortable" ? "comfortable" : "compact";

  const activeCols = useMemo(() => {
    const fromUrl = params.get("cols");
    if (fromUrl) return fromUrl.split(",").filter((id) => RES_COLUMNS.some((c) => c.id === id));
    return DEFAULT_COLUMN_IDS;
  }, [params]);

  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [detailResource, setDetailResource] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const sentinelRef = useRef(null);
  const scrollerRef = useRef(null);

  const setView = useCallback((v) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("view", v.id);
      if (v.density) np.set("density", v.density);
      if (v.columns) np.set("cols", v.columns.join(","));
      else np.delete("cols");
      return np;
    });
  }, [setParams]);

  const setDensity = useCallback((d) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("density", d);
      return np;
    });
  }, [setParams]);

  const toggleColumn = useCallback((id) => {
    const next = activeCols.includes(id) ? activeCols.filter((c) => c !== id) : [...activeCols, id];
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("cols", next.join(","));
      return np;
    });
  }, [activeCols, setParams]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setPage((p) => Math.min(p + 1, Math.ceil(RESOURCES_ALL.length / PAGE_SIZE)));
        }
      }
    }, { rootMargin: "200px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > window.innerHeight);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visibleResources = useMemo(() => {
    const slice = RESOURCES_ALL.slice(0, page * PAGE_SIZE);
    if (!search) return slice;
    const q = search.toLowerCase();
    return slice.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.id.toLowerCase().includes(q)) return true;
      const tagMatch = Object.values(r.tags || {}).some((v) => String(v).toLowerCase().includes(q));
      return tagMatch;
    });
  }, [page, search]);

  const cols = activeCols.map((id) => RES_COLUMNS.find((c) => c.id === id)).filter(Boolean);
  const gridTemplate = cols.map((c) => `${c.width}px`).join(" ");
  const rowH = density === "compact" ? 36 : 52;
  const cellPadV = density === "compact" ? 7 : 12;
  const selCount = Object.values(selected).filter(Boolean).length;
  const hasMore = page * PAGE_SIZE < RESOURCES_ALL.length;

  const toggleRow = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const clearSelection = () => setSelected({});

  const handleShareLink = useCallback(() => {
    try {
      navigator.clipboard?.writeText(window.location.href);
    } catch {
      // clipboard unavailable; silent
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = buildResourcesCsv(visibleResources, cols);
    triggerDownload(`resources-${viewId}.csv`, csv);
  }, [visibleResources, cols, viewId]);

  const handleCopyId = useCallback((r) => {
    try {
      navigator.clipboard?.writeText(r.id);
    } catch {
      // silent
    }
  }, []);

  return (
    <div
      ref={scrollerRef}
      data-testid="resources-page"
      style={{
        padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box",
        background: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Resources</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            {TOTAL_RESOURCES_COUNT.toLocaleString()} resources across 4 accounts · synced 18m ago
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ViewsPicker activeId={viewId} onSelect={setView} />
        <button
          type="button"
          data-testid="resources-share-link"
          onClick={handleShareLink}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
        >
          🔗 Share link
        </button>
        <button type="button" style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}>
          Save as…
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="resources-export-csv"
          onClick={handleExportCsv}
          style={{ padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ColumnsPicker activeCols={activeCols} onToggle={toggleColumn} />
        <div data-testid="resources-density-toggle" style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
          {[{ id: "compact", l: "Compact" }, { id: "comfortable", l: "Comfortable" }].map((d) => {
            const on = d.id === density;
            return (
              <button
                key={d.id}
                type="button"
                data-testid={`resources-density-${d.id}`}
                aria-selected={on}
                onClick={() => setDensity(d.id)}
                style={{
                  padding: "5px 10px", fontSize: 12,
                  background: on ? "#111827" : "#fff",
                  color: on ? "#fff" : "#6b7280",
                  border: "none", borderRight: "1px solid #e5e5e5",
                  fontWeight: on ? 500 : 400, cursor: "pointer",
                }}
              >
                {d.l}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {PLATFORM_DIM_COUNT} platform · {TAG_DIM_COUNT} tags available ·{" "}
          <Link to="/tag-governance" style={{ color: "#6d28d9", fontWeight: 500, textDecoration: "none" }}>Manage tag schema →</Link>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 13, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6 }}>
          <span style={{ color: "#9ca3af" }}>🔍</span>
          <input
            data-testid="resources-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name, ARN, or tag value…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111827", fontFamily: "inherit" }}
          />
        </div>
        {selCount === 0 && (
          <span style={{ fontSize: 11, color: "#9ca3af" }} data-testid="resources-status-line">
            Showing 1–{visibleResources.length} of {TOTAL_RESOURCES_COUNT.toLocaleString()}
          </span>
        )}
      </div>

      {selCount > 0 && (
        <div
          data-testid="resources-bulk-action-bar"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", marginBottom: 8,
            background: "#eef2ff", border: "1px solid #c7d2fe",
            borderRadius: 8, fontSize: 12, color: "#3730a3",
          }}
        >
          <span style={{ fontWeight: 600 }}>{selCount} selected</span>
          <span style={{ color: "#6366f1" }}>·</span>
          <button type="button" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Apply tag…</button>
          <button type="button" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Hibernate</button>
          <button type="button" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Send to Recommendations</button>
          <button type="button" style={{ fontSize: 12, fontWeight: 500, color: "#4338ca", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Export selected</button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            data-testid="resources-bulk-clear"
            onClick={clearSelection}
            style={{ fontSize: 11, color: "#6366f1", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `28px ${gridTemplate} 28px`,
          gap: 12, padding: "9px 14px",
          background: "#fafafa", borderBottom: "1px solid #f3f4f6",
          fontSize: 10, fontWeight: 500, color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.05em",
          position: "sticky", top: 0, zIndex: 1,
        }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid #d1d5db", background: "#fff" }} />
          {cols.map((c) => (
            <span
              key={c.id}
              style={{
                textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
                fontFamily: c.tag ? "JetBrains Mono, monospace" : "inherit",
                textTransform: c.tag ? "none" : "uppercase",
                color: "#9ca3af",
              }}
            >
              {c.label}
            </span>
          ))}
          <span />
        </div>

        {visibleResources.map((r, idx) => {
          const sel = !!selected[r.id];
          return (
            <div
              key={r.id}
              data-testid={`resources-row-${r.id}`}
              data-selected={sel}
              style={{
                display: "grid",
                gridTemplateColumns: `28px ${gridTemplate} 28px`,
                gap: 12, padding: `${cellPadV}px 14px`,
                alignItems: "center",
                minHeight: rowH, height: rowH,
                borderBottom: idx < visibleResources.length - 1 ? "1px solid #f3f4f6" : "none",
                background: sel ? "#f5f3ff" : "#fff",
                boxShadow: sel ? "inset 3px 0 0 #6366f1" : "none",
              }}
            >
              <span
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                data-testid={`resources-checkbox-${r.id}`}
                onClick={() => toggleRow(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(r.id); } }}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1px solid ${sel ? "#6366f1" : "#d1d5db"}`,
                  background: sel ? "#6366f1" : "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, lineHeight: 1, cursor: "pointer",
                }}
              >
                {sel ? "✓" : ""}
              </span>
              {cols.map((c) => (
                <div
                  key={c.id}
                  data-testid={c.id === "name" ? `resources-row-open-${r.id}` : undefined}
                  onClick={c.id === "name" ? () => setDetailResource(r) : undefined}
                  role={c.id === "name" ? "button" : undefined}
                  tabIndex={c.id === "name" ? 0 : undefined}
                  onKeyDown={c.id === "name" ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailResource(r); } } : undefined}
                  style={{
                    fontSize: 12, color: "#111827",
                    textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
                    minWidth: 0,
                    display: c.align === "center" ? "flex" : "block",
                    justifyContent: c.align === "center" ? "center" : undefined,
                    whiteSpace: "nowrap", overflow: "hidden",
                    cursor: c.id === "name" ? "pointer" : undefined,
                  }}
                >
                  {renderCell(r, c)}
                </div>
              ))}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  data-testid={`resources-row-menu-button-${r.id}`}
                  aria-label="Row actions"
                  aria-haspopup="menu"
                  aria-expanded={menuOpenFor === r.id}
                  onClick={() => setMenuOpenFor((cur) => (cur === r.id ? null : r.id))}
                  style={{ width: 22, height: 22, padding: 0, background: "transparent", border: "none", borderRadius: 4, color: "#9ca3af", fontSize: 14, lineHeight: 1, cursor: "pointer" }}
                >
                  ⋯
                </button>
                {menuOpenFor === r.id && (
                  <RowActionMenu
                    resource={r}
                    onCopyId={handleCopyId}
                    onViewDetails={(res) => setDetailResource(res)}
                    onClose={() => setMenuOpenFor(null)}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div
          ref={sentinelRef}
          data-testid="resources-infinite-sentinel"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 14px", fontSize: 12, color: "#9ca3af",
            background: "#fafafa", borderTop: "1px solid #f3f4f6",
          }}
        >
          {hasMore ? (
            <>
              <span style={{ width: 12, height: 12, borderRadius: 6, border: "2px solid #d1d5db", borderTopColor: "#6366f1", animation: "resSpin 700ms linear infinite", display: "inline-block" }} />
              <span>Loading more…</span>
            </>
          ) : (
            <span>End of results</span>
          )}
        </div>
        <style>{`@keyframes resSpin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          Showing 1–{visibleResources.length} of {TOTAL_RESOURCES_COUNT.toLocaleString()} · scroll for more
        </span>
        {showBackToTop && (
          <button
            type="button"
            data-testid="resources-back-to-top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{ padding: "4px 10px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
          >
            ↑ Back to top
          </button>
        )}
      </div>

      <ResourceDetailPanel resource={detailResource} onClose={() => setDetailResource(null)} />
    </div>
  );
}
