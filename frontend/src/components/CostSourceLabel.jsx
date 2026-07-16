/**
 * Indicates whether displayed cost data is "Actual" (from CUR) or
 * "Estimated" (from Cost Explorer).
 *
 * Usage:
 *   <CostSourceLabel source="cur" />                     → "Actual"
 *   <CostSourceLabel source="estimated" />                → "Estimated"
 *   <CostSourceLabel source="cur" showFreshness />        → "Actual · Updated 3h ago"
 *
 * When showFreshness is true, the freshness segment is a link to
 * /ingestion and turns amber when the underlying data source is stale
 * or failed. The freshness signal comes from useIngestionFreshness which
 * shares one backing fetch across all widgets via IngestionStatusContext.
 */
import React from "react";
import FreshnessLabel from "./FreshnessLabel";

const styles = {
  cur: {
    background: "var(--success-bg, #f0fdf4)",
    color: "var(--success, #16a34a)",
    border: "1px solid #dcfce7",
  },
  estimated: {
    background: "var(--warning-light, #fffbeb)",
    color: "var(--warning, #d97706)",
    border: "1px solid #fde68a",
  },
};

const labels = {
  cur: "Actual",
  estimated: "Estimated",
};

export default function CostSourceLabel({ source = "cur", showFreshness = false }) {
  const s = styles[source] || styles.cur;
  const label = labels[source] || source;
  const pill = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.03em",
        padding: "2px 8px",
        borderRadius: "var(--radius-full, 9999px)",
        ...s,
      }}
      title={source === "cur" ? "Data from AWS Cost & Usage Report" : "Data from AWS Cost Explorer (may differ from final bill)"}
    >
      {label}
    </span>
  );

  if (!showFreshness) return pill;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {pill}
      <span style={{ color: "var(--text-tertiary, #9ca3af)", fontSize: 11 }} aria-hidden>
        ·
      </span>
      <FreshnessLabel dataSource={source} />
    </span>
  );
}
