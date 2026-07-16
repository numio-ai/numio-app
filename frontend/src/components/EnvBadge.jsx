/**
 * Unified environment badge (prod, dev, staging, all).
 * Use across Recommendations, Autopilot, and other pages.
 */
import React from "react";

export default function EnvBadge({ env }) {
  const key = (env || "all").toLowerCase();
  const modifier = ["prod", "staging", "dev", "all"].includes(key) ? key : "all";
  return (
    <span className={`badge-env badge-env-${modifier}`}>
      {key}
    </span>
  );
}
