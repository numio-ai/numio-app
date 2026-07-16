/**
 * Mock Cost Allocation Data
 *
 * Allocation summary, attribution tree, and tag recommendations.
 * Derived from Overview (currentMTD, period) and teamBudgets — single source of truth.
 */

import { overviewSummary } from "./mockOverview";
import { teamBudgets } from "./mockBudgets";

function formatCurrency(amount, forceCents = false) {
  if (forceCents || amount < 100) return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** MTD allocated = Overview currentMTD; unallocated = small residual for demo */
const totalAllocated = overviewSummary.currentMTD;
const unallocatedAmount = 0;

export const allocationSummary = {
  total: formatCurrency(totalAllocated),
  unallocated: formatCurrency(unallocatedAmount),
  period: overviewSummary.period,
};

export const lastUpdated = overviewSummary.lastUpdated;

/** Attribution tree from Overview teams (teamBudgets) — same teams and spend as Overview Spend by Team */
export const allocationTree = [
  {
    label: "By team",
    value: formatCurrency(totalAllocated),
    children: teamBudgets.map((t) => ({
      label: t.team,
      value: formatCurrency(t.current),
    })),
  },
];

export const tagRecommendations = [
  { resource: "i-0x891", missing: "cost-center", owner: "ml-team" },
  { resource: "vol-1a2b", missing: "project", owner: "platform" },
  { resource: "s3-logs-prod", missing: "environment", owner: "ops" },
];
