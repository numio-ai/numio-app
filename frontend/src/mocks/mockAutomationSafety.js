/**
 * Mock Automation Safety Data
 *
 * Impact thresholds, domain pauses, and approval settings.
 * Aligned with Overview budget/forecast context.
 * Used in: Settings > Automation Safety
 */

import { overviewSummary } from "./mockOverview";

/** Impact thresholds for auto-execute vs require approval */
export const impactThresholds = {
  autoExecuteMax: "$500/mo",
  requireApprovalOver: "$1,500/mo",
};

/** Domain-level automation pause state */
export const domainPauses = [
  { domain: "GPU Automation", status: "Paused" },
  { domain: "Storage Automation", status: "Active" },
];

/** Approval configuration for high-impact actions */
export const approvals = {
  highImpactApprovers: "finops-lead, devops-lead",
  minimumApprovals: 2,
};

export const lastUpdated = overviewSummary.lastUpdated;
