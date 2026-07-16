/**
 * Unified TIER badge (TIER 1–4).
 * TIER 1–2: green, TIER 3: amber, TIER 4: red.
 * Use in Budget Alerts, Recommendations, Autopilot.
 */
import React from "react";

const TIER_STYLES = {
  1: { bg: "#22c55e", label: "TIER 1: INFORM", color: "white" },
  2: { bg: "#22c55e", label: "TIER 2: RECOMMEND", color: "white" },
  3: { bg: "#f59e0b", label: "TIER 3: EXECUTE", color: "white" },
  4: { bg: "#ef4444", label: "TIER 4: ESCALATE", color: "white" },
  AI_OPTIMIZATION: { bg: "var(--ai-accent-light)", label: "AI OPTIMIZATION", color: "var(--ai-accent-text)" },
};

export default function TierBadge({ tier }) {
  const isAI = tier && String(tier).toUpperCase().includes("AI OPTIMIZATION");
  if (isAI) {
    const s = TIER_STYLES.AI_OPTIMIZATION;
    return (
      <span
        className="badge-tier"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          color: s.color,
          backgroundColor: s.bg,
        }}
      >
        {s.label}
      </span>
    );
  }
  const num = tier && /(\d)/.test(tier) ? parseInt(tier.match(/(\d)/)[1], 10) : 2;
  const s = TIER_STYLES[num] || TIER_STYLES[2];
  const displayLabel = s.label;
  return (
    <span
      className="badge-tier"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: "white",
        backgroundColor: s.bg,
      }}
    >
      {displayLabel}
    </span>
  );
}
