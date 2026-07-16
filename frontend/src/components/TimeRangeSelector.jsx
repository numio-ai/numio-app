import React, { useState } from "react";

const OPTIONS = ["MTD", "Last Month", "Last Quarter", "Custom"];

function getPeriodLabel(value) {
  const d = new Date();
  if (value === "MTD") {
    return d.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  }
  if (value === "Last Month") {
    const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return last.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  }
  if (value === "Last Quarter") {
    const q = Math.floor(d.getMonth() / 3) + 1;
    const y = d.getFullYear();
    const startMonth = (q - 1) * 3;
    const start = new Date(y, startMonth, 1);
    const end = new Date(y, startMonth + 3, 0);
    return `${start.toLocaleString("en-US", { month: "short" })} – ${end.toLocaleString("en-US", { month: "short", year: "numeric" })}`.toUpperCase();
  }
  return value;
}

/**
 * Compute {startDate, endDate} (YYYY-MM-DD strings) for the selected range.
 * endDate is exclusive (day after last included day) to match backend conventions.
 */
function computeDateRange(value, customFrom, customTo) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  if (value === "Custom" && customFrom && customTo) {
    // endDate exclusive: add one day
    const end = new Date(customTo);
    end.setDate(end.getDate() + 1);
    return { startDate: customFrom, endDate: fmt(end) };
  }

  if (value === "Last Month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: fmt(start), endDate: fmt(end) };
  }

  if (value === "Last Quarter") {
    const q = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), (q - 1) * 3, 1);
    const end = new Date(today.getFullYear(), q * 3, 1);
    return { startDate: fmt(start), endDate: fmt(end) };
  }

  // MTD (default)
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function useTimeRange(initial = "MTD") {
  const [value, setValue] = useState(initial);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const periodLabel = value === "Custom" && customFrom && customTo
    ? `${customFrom} – ${customTo}`.toUpperCase()
    : getPeriodLabel(value);
  const dateRange = computeDateRange(value, customFrom, customTo);
  return { value, setValue, customFrom, setCustomFrom, customTo, setCustomTo, periodLabel, dateRange };
}

export default function TimeRangeSelector({ value, onChange, customFrom, customTo, onCustomFromChange, onCustomToChange }) {
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (opt) => {
    if (opt === "Custom") {
      setShowCustom(true);
      onChange("Custom");
    } else {
      setShowCustom(false);
      onChange(opt);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleSelect(opt)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: value === opt ? 500 : 400,
              border: "none",
              borderRight: opt !== OPTIONS[OPTIONS.length - 1] ? "1px solid var(--border)" : "none",
              background: value === opt ? "var(--text-primary)" : "var(--card)",
              color: value === opt ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {showCustom && value === "Custom" && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 10 }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange?.(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange?.(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6 }}
          />
        </div>
      )}
    </div>
  );
}

export { getPeriodLabel };
