/**
 * Shared design tokens — Overview benchmark (apply app-wide).
 * H1–H5, font sizes, colors, progress bars match /overview.
 */

/** Spacing between consecutive text blocks or sections (marginTop/marginBottom). Use everywhere for unified 10px padding. */
export const blockSpacing = "10px";

/** Card container — use overview-card class for same look as Overview */
export const execCardClass = "overview-card";

/** Section header — small uppercase label (Overview benchmark) */
export const execHeaderClass = "overview-card__section-label";

/** Overview benchmark — page title (H1) style */
export const pageTitleStyle = { fontSize: "16px", fontWeight: 500, color: "var(--text-primary)", margin: 0 };

/** Overview benchmark — section label (uppercase) */
export const sectionLabelStyle = { fontSize: "10px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 };

/** Overview benchmark — hero/metric value */
export const metricStyle = { fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" };

/** Overview benchmark — body/secondary text */
export const bodyStyle = { fontSize: "13px", color: "var(--text-muted)" };

/** Progress bar — height (3px app-wide) */
export const progressBarHeight = "3px";

/** Progress bar — fill colors (status) */
export const progressColors = { default: "#111827", success: "#16a34a", warning: "#d97706", danger: "#dc2626" };

/** Inline style for compact summary bar (use with className flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white) */
export const compactSummaryBarStyle = {
  marginBottom: "24px",
  borderColor: "var(--border)",
  borderRadius: "var(--radius-lg)",
};

/** Format currency; forceCents true for values under 100 or when decimals needed */
export function formatCurrency(amount, forceCents = false) {
  if (forceCents || amount < 100)
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Current month label (e.g. "February 2026") */
export function formatCurrentMonth() {
  const d = new Date();
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Use overview-card for cards; use overview-card__section-label for section headers. */
