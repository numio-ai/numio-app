import React from "react";
import { Link } from "react-router-dom";
import { formatCurrentMonth } from "../constants/designTokens";
import { useBudget } from "../context/BudgetContext";
import { formatCurrency } from "../utils/format";

/**
 * MTD Spend card for Costs section — matches Overview HeroHeader MTD layout.
 * Design system: 3px progress bar, stacked layout (no cramped single line).
 */
export default function CostsMtdBanner() {
  const {
    mtdSpend,
    forecast,
    monthlyBudget,
    percentUsed,
    status,
    statusLabel,
    statusColor,
    dailyAverage,
    calendar,
  } = useBudget();
  const statusBg =
    status === "on-track" ? "#f0fdf4" : status === "at-risk" ? "#fffbeb" : "#fef2f2";

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #efefef",
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "20px",
      }}
      title={`MTD: ${formatCurrency(mtdSpend)} · Forecast: ${formatCurrency(forecast)} · Budget: ${formatCurrency(monthlyBudget)}`}
    >
      <p
        style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: "4px",
        }}
      >
        MTD SPEND · {formatCurrentMonth()}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
        <span style={{ fontSize: "32px", fontWeight: 600, color: "#111827" }}>
          {formatCurrency(mtdSpend)}
        </span>
        <span style={{ fontSize: "14px", color: "#6b7280" }}>{percentUsed}% of budget used</span>
      </div>
      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
        ${dailyAverage?.toLocaleString() ?? "0"}/day avg · Forecast {formatCurrency(forecast)} · Budget {formatCurrency(monthlyBudget)}
      </div>
      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: 2, marginBottom: 12 }}>
        Updated today · {calendar.daysRemaining} day{calendar.daysRemaining !== 1 ? "s" : ""} remaining in {calendar.monthName}
      </div>
      <div style={{ width: "100%", height: "3px", borderRadius: "9999px", background: "#f3f4f6", margin: "12px 0" }}>
        <div
          style={{
            height: "3px",
            borderRadius: "9999px",
            width: `${Math.min(percentUsed, 100)}%`,
            background: percentUsed >= 100 ? "#dc2626" : percentUsed >= 80 ? "#d97706" : "#111827",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <p
        style={{
          display: "inline-block",
          fontWeight: 500,
          borderRadius: "9999px",
          background: statusBg,
          color: statusColor,
          fontSize: "12px",
          padding: "4px 10px",
          border: "none",
          marginBottom: 0,
        }}
      >
        {statusLabel}
      </p>
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <Link to="/inbox" style={{ fontSize: "13px", fontWeight: 500, color: "#2563eb" }}>
          View Inbox →
        </Link>
        <Link to="/budgets" style={{ fontSize: "13px", fontWeight: 500, color: "#2563eb" }}>
          View budgets →
        </Link>
      </div>
    </section>
  );
}
