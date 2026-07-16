/**
 * Inline "Updated Xh ago" label used on dashboard widgets.
 *
 * - Renders as a keyboard-accessible link to /ingestion so users can
 *   investigate staleness at the point of doubt.
 * - Turns amber when the underlying data source is stale or failed.
 * - Hover / focus reveals the absolute ISO timestamp via `title`.
 *
 * Intended for compact placement (card footer / widget header). For the
 * "TOTAL SPEND" style pill that already carries CostSourceLabel, use
 * CostSourceLabel's showFreshness prop instead so both values stay on
 * one line.
 */
import React from "react";
import { Link } from "react-router-dom";
import useIngestionFreshness from "../hooks/useIngestionFreshness";

function formatRelativeHours(hoursAgo) {
  if (hoursAgo == null) return "never";
  if (hoursAgo < 1 / 60) return "just now";
  if (hoursAgo < 1) return `${Math.max(1, Math.round(hoursAgo * 60))}m ago`;
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`;
  return `${Math.round(hoursAgo / 24)}d ago`;
}

export default function FreshnessLabel({ dataSource, prefix = "Updated" }) {
  const { lastSyncAt, hoursAgo, isStale, isFailed } = useIngestionFreshness(dataSource);

  const color = isFailed || isStale ? "#d97706" : "var(--text-tertiary, #9ca3af)";
  const text = lastSyncAt ? `${prefix} ${formatRelativeHours(hoursAgo)}` : "Not synced yet";
  const title = lastSyncAt ? `${dataSource || "Data"} · ${new Date(lastSyncAt).toLocaleString()}` : "No ingestion has run yet for this data source";

  return (
    <Link
      to="/ingestion"
      title={title}
      aria-label={`${text}${dataSource ? ` for ${dataSource}` : ""}. View ingestion details`}
      style={{
        fontSize: 11,
        color,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderBottom: `1px dotted ${color === "#d97706" ? "#d97706" : "transparent"}`,
      }}
    >
      {text}
    </Link>
  );
}
