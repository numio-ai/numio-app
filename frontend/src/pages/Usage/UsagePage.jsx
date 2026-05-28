import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useUsageUrlState from "../../hooks/useUsageUrlState";
import {
  TIME_RANGES,
  TAG_SCHEMA,
  PLATFORM_DIMS,
  SERIES_COLORS,
  UNTAGGED_COLOR,
  GRANULARITY_OPTIONS,
  getScenario,
  getSavedViews,
  variantFor,
} from "./usageMockData";

const card = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 24px" };
const label = { fontSize: 12, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 };

function defaultGroupByFor(scope) {
  return getScenario(scope).defaultGroupBy;
}
function defaultViewFor(scope) {
  return getSavedViews(scope)[0].id;
}

function StackedAreaChart({ series, days = 30, height = 280 }) {
  const data = useMemo(
    () =>
      Array.from({ length: days }, (_, i) =>
        series.map((s) =>
          Math.max(20, s.base + s.drift * i + Math.sin((i + (s.phase || 0)) / 2.1) * s.amp + Math.cos(i / 1.6) * s.amp * 0.6)
        )
      ),
    [series, days]
  );
  const w = 1180, h = height, pl = 56, pr = 8, pt = 8, pb = 28;
  const innerW = w - pl - pr, innerH = h - pt - pb;
  const totals = data.map((r) => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, 1);
  const stepX = innerW / Math.max(days - 1, 1);
  const accum = data.map(() => 0);
  const polygons = series.map((s, sIdx) => {
    const top = [], bottom = [];
    for (let i = 0; i < days; i++) {
      const x = pl + i * stepX;
      const baseY = pt + innerH - (accum[i] / max) * innerH;
      accum[i] += data[i][sIdx];
      const topY = pt + innerH - (accum[i] / max) * innerH;
      top.push(`${x},${topY}`);
      bottom.push(`${x},${baseY}`);
    }
    return { color: s.color, points: `${top.join(" ")} ${bottom.reverse().join(" ")}`, untagged: s.untagged };
  });

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }} role="img" aria-label="Spend over time">
      {[0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pt + p * innerH;
        const v = max * (1 - p);
        const label = v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;
        return (
          <g key={i}>
            <line x1={pl} x2={pl + innerW} y1={y} y2={y} stroke="#f3f4f6" />
            <text x={pl - 6} y={y + 3} fontSize={10} fill="#9ca3af" textAnchor="end">
              {label}
            </text>
          </g>
        );
      })}
      {polygons.map((p, i) => (
        <polygon
          key={i}
          points={p.points}
          fill={p.color}
          fillOpacity={p.untagged ? 0.45 : 0.88}
          stroke={p.untagged ? UNTAGGED_COLOR : "none"}
          strokeDasharray={p.untagged ? "3 3" : undefined}
          strokeWidth={p.untagged ? 1 : 0}
        />
      ))}
    </svg>
  );
}

function GroupByPicker({ groupBy, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const isTag = groupBy?.kind === "tag";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="usage-groupby-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, color: "#111827",
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6,
          cursor: "pointer", fontWeight: 500,
        }}
      >
        <span style={{ color: "#9ca3af", fontWeight: 400 }}>Group by:</span>
        {isTag && (
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9", background: "#ede9fe", padding: "1px 5px", borderRadius: 3 }}>tag</span>
        )}
        <span>{groupBy?.key || "—"}</span>
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Group by"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            minWidth: 260,
            background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            padding: 6, zIndex: 50,
          }}
        >
          <div style={{ padding: "6px 8px 2px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Platform
          </div>
          {PLATFORM_DIMS.map((p) => {
            const active = groupBy?.kind === "platform" && groupBy?.key === p.key;
            return (
              <div
                key={p.key}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => { onChange({ kind: "platform", key: p.key }); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onChange({ kind: "platform", key: p.key }); setOpen(false); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                  background: active ? "#f3f4f6" : "transparent",
                  fontSize: 13, color: "#111827", fontWeight: active ? 500 : 400,
                }}
              >
                <span style={{ width: 14, textAlign: "center", fontSize: 12 }}>{active ? "✓" : ""}</span>
                <span>{p.label}</span>
              </div>
            );
          })}
          <div style={{ height: 1, background: "#f3f4f6", margin: "6px 0" }} />
          <div style={{ padding: "6px 8px 2px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tags
          </div>
          {TAG_SCHEMA.map((t) => {
            const active = groupBy?.kind === "tag" && groupBy?.key === t.key;
            return (
              <div
                key={t.key}
                role="option"
                aria-selected={active}
                tabIndex={0}
                data-testid={`usage-groupby-option-tag-${t.key}`}
                onClick={() => { onChange({ kind: "tag", key: t.key }); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onChange({ kind: "tag", key: t.key }); setOpen(false); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                  background: active ? "#f3f4f6" : "transparent",
                  fontSize: 13, color: "#111827", fontWeight: active ? 500 : 400,
                }}
              >
                <span style={{ width: 14, textAlign: "center", fontSize: 12 }}>{active ? "✓" : ""}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9", background: "#ede9fe", padding: "1px 5px", borderRadius: 3 }}>tag</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{t.key}</span>
                {t.required && <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>required</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ filter, onRemove }) {
  const isTag = filter.kind === "tag";
  const valuesLabel = filter.values.length === 1 ? filter.values[0] : `${filter.values[0]} +${filter.values.length - 1}`;
  return (
    <span
      data-testid={`usage-filter-chip-${filter.kind}-${filter.key}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 4px 5px 10px", fontSize: 12,
        background: isTag ? "#f5f3ff" : "#fff",
        border: `1px solid ${isTag ? "#ddd6fe" : "#e5e5e5"}`,
        color: "#374151", borderRadius: 6, whiteSpace: "nowrap",
      }}
    >
      {isTag && (
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#6d28d9", background: "#ede9fe", padding: "1px 5px", borderRadius: 3 }}>tag</span>
      )}
      <span style={{ color: "#6b7280" }}>{filter.key}:</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{valuesLabel}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${filter.kind}:${filter.key}`}
        style={{
          width: 18, height: 18, padding: 0, marginLeft: 2,
          color: "#9ca3af", background: "transparent", border: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: 4, fontSize: 14, lineHeight: 1, cursor: "pointer",
        }}
      >
        ×
      </button>
    </span>
  );
}

function ViewsPicker({ views, activeId, onSelect, onCopyLink }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const active = views.find((v) => v.id === activeId) || views[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="usage-views-button"
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
        <div
          role="listbox"
          aria-label="Saved views"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            minWidth: 320,
            background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            padding: 6, zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved views</span>
            <button type="button" style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}>
              + Save current
            </button>
          </div>
          {views.map((v) => {
            const on = v.id === activeId;
            return (
              <div
                key={v.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`usage-view-row-${v.id}`}
                onClick={() => { onSelect(v); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSelect(v); setOpen(false); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 8px", borderRadius: 6,
                  background: on ? "#f3f4f6" : "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 14, color: "#111827", fontSize: 12, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#111827", fontWeight: on ? 500 : 400 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {v.owner === "you" ? "Created by you" : v.owner === "shared" ? "Shared workspace view" : `Shared by ${v.owner}`}
                  </div>
                </div>
                <button
                  type="button"
                  title="Copy link"
                  data-testid={`usage-view-copy-${v.id}`}
                  onClick={(e) => { e.stopPropagation(); onCopyLink(v); }}
                  style={{
                    width: 26, height: 26, padding: 0,
                    background: "transparent", border: "none", borderRadius: 4,
                    color: "#6b7280", cursor: "pointer",
                  }}
                >
                  🔗
                </button>
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

function UntaggedCallout({ untaggedRow, dimKey }) {
  if (!untaggedRow || untaggedRow.spend === 0) return null;
  return (
    <div
      data-testid="usage-untagged-callout"
      style={{
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
        padding: "8px 12px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 9, background: "#fde68a", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#92400e", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>!</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>${untaggedRow.spend.toLocaleString()}</span>
      <span style={{ color: "#6b7280" }}>has no</span>
      <code style={{ fontFamily: "JetBrains Mono, monospace", background: "#fff", padding: "1px 6px", borderRadius: 3, color: "#374151" }}>{dimKey}</code>
      <span style={{ color: "#6b7280" }}>tag — can't be allocated.</span>
      <span style={{ flex: 1 }} />
      <Link to="/tag-governance" style={{ fontSize: 12, color: "#6d28d9", fontWeight: 500, textDecoration: "none" }}>Fix in Tag Governance →</Link>
    </div>
  );
}

function UsageBreakdown({ groupBy, rows, scope, periodLabel, onInspect }) {
  const isTag = groupBy.kind === "tag";
  const dimColLabel = isTag ? `tag:${groupBy.key}` : groupBy.key;
  return (
    <div style={card} data-testid="usage-breakdown">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ ...label, marginBottom: 0 }} data-testid="usage-breakdown-header">
          BREAKDOWN BY {isTag ? "TAG · " : ""}
          <span style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "none", letterSpacing: 0, color: "#374151" }}>{groupBy.key}</span>
          <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {periodLabel}</span>
        </p>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{rows.length} groups</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: scope === "cloud" ? "1fr 130px 100px 80px 80px 100px" : "1fr 100px 80px 80px 100px",
        gap: 12, fontSize: 10, fontWeight: 500, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.05em",
        padding: "8px 0", borderBottom: "1px solid #f3f4f6",
      }}>
        <span>{dimColLabel}</span>
        {scope === "cloud" && <span>OWNER (TEAM)</span>}
        <span style={{ textAlign: "right" }}>SPEND</span>
        <span style={{ textAlign: "right" }}>SHARE</span>
        <span style={{ textAlign: "right" }}>Δ vs prev</span>
        <span />
      </div>
      {rows.map((r, idx) => (
        <div key={r.name} style={{
          display: "grid",
          gridTemplateColumns: scope === "cloud" ? "1fr 130px 100px 80px 80px 100px" : "1fr 100px 80px 80px 100px",
          gap: 12, alignItems: "center", padding: "10px 0",
          borderBottom: "1px solid #f3f4f6",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: r.untagged ? UNTAGGED_COLOR : SERIES_COLORS[idx % SERIES_COLORS.length], opacity: r.untagged ? 0.55 : 1 }} />
            <span style={{
              fontSize: 13,
              fontWeight: r.untagged ? 400 : 500,
              color: r.untagged ? "#9ca3af" : "#111827",
              fontFamily: isTag && !r.untagged ? "JetBrains Mono, monospace" : "inherit",
              fontStyle: r.untagged ? "italic" : "normal",
            }}>{r.name}</span>
          </span>
          {scope === "cloud" && <span style={{ fontSize: 12, color: "#6b7280" }}>{r.team || "—"}</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: r.untagged ? "#9ca3af" : "#111827", textAlign: "right" }}>${r.spend.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>{r.share}%</span>
          <span style={{ fontSize: 12, color: r.up ? "#d97706" : "#16a34a", textAlign: "right" }}>{r.trend}</span>
          <span style={{ textAlign: "right" }}>
            <button
              type="button"
              data-testid={`usage-breakdown-inspect-${r.name}`}
              onClick={() => onInspect?.(r)}
              style={{ fontSize: 11, color: "#3B5BDB", background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
            >
              Inspect →
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function buildUsageCsv(rows, groupBy) {
  const dimColLabel = groupBy?.kind === "tag" ? `tag:${groupBy.key}` : groupBy?.key || "dimension";
  const headers = [dimColLabel, "team", "spend", "share", "trend"];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.team || "", r.spend, `${r.share}%`, r.trend].map(escape).join(","));
  }
  return lines.join("\n");
}

function triggerCsvDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function GranularityPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const active = GRANULARITY_OPTIONS.find((o) => o.id === value) || GRANULARITY_OPTIONS[0];
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        data-testid="usage-granularity-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 12, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
      >
        <span style={{ color: "#9ca3af" }}>Granularity:</span>
        <span style={{ color: "#111827", fontWeight: 500 }}>{active.label}</span>
        <span style={{ color: "#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 140, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 4, zIndex: 50 }}>
          {GRANULARITY_OPTIONS.map((o) => {
            const on = o.id === value;
            return (
              <div
                key={o.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                data-testid={`usage-granularity-option-${o.id}`}
                onClick={() => { onChange(o.id); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onChange(o.id); setOpen(false); } }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 4, fontSize: 13, color: "#111827", cursor: "pointer", background: on ? "#f3f4f6" : "transparent" }}
              >
                <span style={{ width: 14, textAlign: "center" }}>{on ? "✓" : ""}</span>
                <span>{o.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

export default function UsagePage() {
  const url = useUsageUrlState({
    groupBy: defaultGroupByFor,
    view: defaultViewFor,
  });
  const { scope, range: rangeId, groupBy, filters, view: viewId } = url;
  const [granularity, setGranularity] = useState("daily");
  const navigate = useNavigate();

  const handleInspect = (row) => {
    // Drill from a usage breakdown row to the matching resources view.
    const params = new URLSearchParams();
    if (groupBy?.kind === "tag" && groupBy.key === "cost-center") {
      params.set("view", "no-cc"); // closest preset that filters by cost-center
    } else {
      params.set("view", "all");
    }
    params.set("filter", `${groupBy?.kind || "platform"}:${groupBy?.key || "service"}=${row.name}`);
    navigate(`/resources?${params.toString()}`);
  };

  const baseScenario = getScenario(scope);
  const variant = variantFor(scope, groupBy);
  const series = variant?.series || baseScenario.series;
  const breakdown = variant?.breakdown || baseScenario.breakdown;
  const savedViews = getSavedViews(scope);
  const activeRange = TIME_RANGES.find((r) => r.id === rangeId) || TIME_RANGES[1];
  const rangeFactor = activeRange.days / 30;

  const scaledBreakdown = useMemo(
    () => breakdown.map((r) => ({ ...r, spend: Math.round(r.spend * rangeFactor) })),
    [breakdown, rangeFactor]
  );
  const total = Math.round(baseScenario.total * rangeFactor);
  const delta = baseScenario.delta;
  const deltaUp = delta > 0;
  const untaggedRow = groupBy?.kind === "tag" ? scaledBreakdown.find((r) => r.untagged) : null;
  const forecast = baseScenario.forecast
    ? { ...baseScenario.forecast, value: Math.round(baseScenario.forecast.value * rangeFactor) }
    : null;

  const chartDays = granularity === "weekly"
    ? Math.max(2, Math.ceil(activeRange.days / 7))
    : activeRange.days;

  const handleCopyLink = (preset) => {
    const url = new URL(window.location.href);
    if (preset?.id) url.searchParams.set("view", preset.id);
    try {
      navigator.clipboard?.writeText(url.toString());
    } catch {
      // clipboard not available; no-op
    }
  };

  const handleRemoveFilter = (filter) => {
    url.setFilters(filters.filter((f) => !(f.kind === filter.kind && f.key === filter.key)));
  };

  const handleExportCsv = () => {
    const csv = buildUsageCsv(scaledBreakdown, groupBy);
    const gbKey = groupBy?.kind === "tag" ? `tag-${groupBy.key}` : groupBy?.key || "default";
    triggerCsvDownload(`usage-${rangeId}-${gbKey}.csv`, csv);
  };

  const cloudTotal = scope === "cloud" ? total : 274_229;
  const aiTotal = scope === "ai" ? total : 8_900;

  return (
    <div
      data-testid="usage-page"
      style={{ padding: 32, maxWidth: 1280, width: "100%", minHeight: "100%", boxSizing: "border-box", background: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>Usage</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Analyze spend across any platform attribute or tag dimension</p>
        </div>
        <div role="tablist" aria-label="Time range" style={{ display: "inline-flex", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {TIME_RANGES.map((t) => {
            const on = t.id === rangeId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`usage-range-${t.id}`}
                onClick={() => url.setRange(t.id)}
                style={{
                  padding: "6px 12px", fontSize: 12,
                  background: on ? "#111827" : "#fff",
                  color: on ? "#fff" : "#6b7280",
                  border: "none", borderRight: "1px solid #e5e5e5",
                  fontWeight: on ? 500 : 400, cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tablist" aria-label="Usage scope" style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e5e5", marginBottom: 16 }}>
        {[
          { id: "cloud", label: "Cloud", count: `$${(cloudTotal / 1000).toFixed(1)}k` },
          { id: "ai", label: "AI", count: `$${(aiTotal / 1000).toFixed(1)}k` },
        ].map((t) => {
          const on = scope === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`usage-scope-${t.id}`}
              onClick={() => url.setScope(t.id)}
              style={{
                padding: "10px 18px", fontSize: 14,
                background: "none", border: "none", cursor: "pointer",
                color: on ? "#111827" : "#6b7280",
                fontWeight: on ? 500 : 400,
                borderBottom: on ? "2px solid #111827" : "2px solid transparent",
                marginBottom: -1,
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              {t.label}
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <ViewsPicker
          views={savedViews}
          activeId={viewId}
          onSelect={(v) => url.setView(v.id, v)}
          onCopyLink={handleCopyLink}
        />
        <button
          type="button"
          onClick={() => handleCopyLink(null)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
          title="Copy view URL"
        >
          🔗 Share link
        </button>
        <button type="button" style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}>
          Save as…
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="usage-export-csv"
          onClick={handleExportCsv}
          style={{ padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer" }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <GroupByPicker groupBy={groupBy} onChange={(g) => url.setGroupBy(g)} />
        <GranularityPicker value={granularity} onChange={setGranularity} />
        <span style={{ flex: 1 }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>Filters</span>
        {filters.map((f) => (
          <FilterChip key={`${f.kind}:${f.key}`} filter={f} onRemove={() => handleRemoveFilter(f)} />
        ))}
        <button type="button" style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px dashed #d1d5db", borderRadius: 6, cursor: "pointer" }}>
          + Filter
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {PLATFORM_DIMS.length} platform · {TAG_SCHEMA.length} tags available ·{" "}
          <Link to="/tag-governance?tab=schema" style={{ color: "#6d28d9", fontWeight: 500, textDecoration: "none" }}>Manage tag schema →</Link>
        </span>
      </div>

      <UntaggedCallout untaggedRow={untaggedRow} dimKey={groupBy?.key} />

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ ...label, marginBottom: 6 }} data-testid="usage-chart-title">
              SPEND OVER TIME · {activeRange.periodUpper} · BY{" "}
              <span style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "none", letterSpacing: 0, color: "#374151" }}>
                {groupBy?.kind === "tag" ? `tag:${groupBy.key}` : groupBy?.key || "—"}
              </span>
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: "#111827", lineHeight: 1 }}>${total.toLocaleString()}</span>
              <span data-testid="usage-delta-caption" style={{ fontSize: 13, color: deltaUp ? "#d97706" : "#16a34a", fontWeight: 500 }}>
                {deltaUp ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
                <span style={{ color: "#9ca3af", fontWeight: 400 }}> vs {activeRange.prev}</span>
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {forecast && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", fontSize: 12, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: "#16a34a" }} />
                Forecast EOM <b style={{ fontWeight: 600 }}>${(forecast.value / 1000).toFixed(1)}k</b>
                <span style={{ color: "#15803d", opacity: 0.7 }}>vs ${(forecast.budget / 1000).toFixed(0)}k budget · {forecast.status}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>CUR · synced 2h ago</span>
          </div>
        </div>

        <StackedAreaChart series={series} days={chartDays} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
          {series.map((s) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, opacity: s.untagged ? 0.55 : 1, border: s.untagged ? `1px dashed ${UNTAGGED_COLOR}` : "none" }} />
              <span style={{
                fontSize: 12,
                color: s.untagged ? "#9ca3af" : "#6b7280",
                fontFamily: s.untagged ? "Inter" : (groupBy?.kind === "tag" ? "JetBrains Mono, monospace" : "Inter"),
                fontStyle: s.untagged ? "italic" : "normal",
              }}>{s.name}</span>
            </span>
          ))}
        </div>
      </div>

      <UsageBreakdown
        groupBy={groupBy || baseScenario.defaultGroupBy}
        rows={scaledBreakdown}
        scope={scope}
        periodLabel={activeRange.period}
        onInspect={handleInspect}
      />
    </div>
  );
}
