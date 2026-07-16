/**
 * Mock Billing & Plans Data
 *
 * Plan usage, available plans, and billing details.
 * Tied to Overview for account spend context (single source of truth).
 * Used in: Settings > Billing & Plans (payment)
 */

import { overviewSummary } from "./mockOverview";

/** Current plan usage (tracked spend vs plan limit) */
export const usage = {
  used: 8.53,
  limit: 2500,
  note: "Usage is based on last month's spend across all integrations.",
};

/** Account MTD from Overview — for display on billing page */
export const accountMTD = overviewSummary.currentMTD;

/** Available plans */
export const plans = [
  { name: "Starter", price: "Free", limit: "$2,500/mo", limitValue: 2500, current: false },
  { name: "Pro", price: "$250 + 15% of savings", limit: "$7,500/mo", limitValue: 7500, current: false },
  { name: "Enterprise", price: "$450 + 10% of savings", limit: "$30,000/mo", limitValue: 30000, current: true },
];

/** Billing email for invoices */
export const billingEmail = "billing@example.com";

/** Payment method placeholder */
export const paymentMethod = {
  cardholderName: "John Smith",
  cardLast4: "4242",
};

export const lastUpdated = overviewSummary.lastUpdated;
