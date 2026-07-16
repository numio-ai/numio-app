/**
 * Shared formatting for currency and percentages across the app.
 */

export function formatCurrency(value, compact = false) {
  const n = Number(value);
  if (Number.isNaN(n)) return "$0";
  if (compact && n >= 1000) {
    return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format with cents when value < 100 or when needed for budgets */
export function formatCurrencyWithCents(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(value) {
  return Math.round(value) + "%";
}
