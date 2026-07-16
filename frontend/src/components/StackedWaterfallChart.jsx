import React from "react";

/**
 * Stacked Waterfall Chart - cost breakdown as one horizontal stacked bar (segments = parts of total).
 * data: { title?, startLabel, startValue, segments: [{ label, value }], endLabel, endValue }
 */
export default function StackedWaterfallChart({ data }) {
  if (!data?.segments?.length) return null;
  const total = data.segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const colors = ["var(--primary)", "#0d9488", "#ca8a04", "#c2410c", "#7c3aed"];

  return (
    <div className="chatMessage__waterfall" role="img" aria-label={data.title || "Cost breakdown"}>
      {data.title && <div className="chatMessage__waterfallTitle">{data.title}</div>}
      <div className="chatMessage__waterfallBar">
        {data.segments.map((seg, i) => {
          const value = Number(seg.value) || 0;
          const widthPct = total ? (value / total) * 100 : 0;
          return (
            <div
              key={i}
              className="chatMessage__waterfallSegment"
              style={{
                flex: `${widthPct} 1 0`,
                minWidth: widthPct < 15 ? "0" : "40px",
                backgroundColor: colors[i % colors.length],
              }}
              title={`${seg.label}: $${value.toLocaleString()}`}
            >
              <span className="chatMessage__waterfallSegmentLabel">{seg.label}</span>
              <span className="chatMessage__waterfallSegmentValue">
                ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="chatMessage__waterfallTotal">
        {data.endLabel && <span className="chatMessage__waterfallTotalLabel">{data.endLabel}</span>}
        <span className="chatMessage__waterfallTotalValue">
          ${Number(data.endValue ?? total).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
