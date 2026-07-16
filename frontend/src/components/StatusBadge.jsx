/**
 * Unified status pill badges.
 * Use for Open, In Review, Connected, On track, Warning, etc.
 */
import React from "react";

const STATUS_STYLES = {
  active: { bg: "#f0fdf4", color: "#16a34a" },
  "on-track": { bg: "#f0fdf4", color: "#16a34a" },
  resolved: { bg: "#f0fdf4", color: "#16a34a" },
  connected: { bg: "#f0fdf4", color: "#16a34a" },
  warning: { bg: "#fffbeb", color: "#d97706" },
  "in-review": { bg: "#fffbeb", color: "#d97706" },
  pending: { bg: "#fffbeb", color: "#d97706" },
  open: { bg: "#fef2f2", color: "#dc2626" },
  paused: { bg: "#fef2f2", color: "#dc2626" },
  critical: { bg: "#fef2f2", color: "#dc2626" },
  violation: { bg: "#fef2f2", color: "#dc2626" },
  neutral: { bg: "#f3f4f6", color: "#4b5563" },
  inactive: { bg: "#f3f4f6", color: "#4b5563" },
};

export default function StatusBadge({ status }) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "-");
  const s = STATUS_STYLES[key] || STATUS_STYLES.neutral;
  return (
    <span
      className="badge-status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {status}
    </span>
  );
}
