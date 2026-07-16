/**
 * Mock Notifications Data
 *
 * Alert routing, quiet hours, digest, and suppression.
 * Aligned with Overview alert context.
 * Used in: Settings > Notifications
 */

import { overviewSummary } from "./mockOverview";

/** Alert routing rules */
export const alertRoutingRules = [
  {
    id: "rule-1",
    alertType: "Budget Overruns",
    recipients: "@finance-team, @engineering-leads",
    channels: ["Email", "Slack"],
    priority: "warning",
  },
  {
    id: "rule-2",
    alertType: "Critical Anomalies (>$500 spike)",
    recipients: "@finops-lead, @on-call",
    channels: ["Email", "Slack", "PagerDuty"],
    priority: "critical",
  },
  {
    id: "rule-3",
    alertType: "Idle Resources Detected",
    recipients: "Resource Owner, @team-lead",
    channels: ["Email"],
    priority: "info",
  },
];

/** Quiet hours */
export const quietHours = {
  enabled: true,
  start: "22:00",
  end: "08:00",
  timezone: "Pacific Time (PT)",
};

/** Digest settings */
export const digestSettings = {
  enabled: true,
  time: "9:00 AM",
  include: {
    budgetStatus: true,
    idleResources: true,
    recommendations: true,
    policyViolations: false,
  },
};

/** Alert suppressions */
export const alertSuppressions = [
  {
    id: "sup-1",
    resource: "i-gpu-prod-123",
    reason: "Maintenance window",
    until: "Until Feb 10, 18:00",
  },
];

/** Last updated (from Overview) */
export const lastUpdated = overviewSummary.lastUpdated;
