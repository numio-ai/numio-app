/**
 * Mock Audit Log Data
 *
 * Action history and filters for Govern > Audit Log.
 * Used with Overview lastUpdated for consistency.
 */

import { overviewSummary } from "./mockOverview";

export const auditFilters = {
  outcomes: ["Good", "Neutral", "Harmful"],
  types: ["Right-size", "Idle cleanup", "Policy", "Commitment"],
};

export const lastUpdated = overviewSummary.lastUpdated;

export const auditEntries = [
  {
    id: "log-001",
    action: "Stopped 3 idle dev instances",
    when: "Jan 22, 09:14",
    reason: "Idle >72hrs in dev",
    impact: "$72/day",
    outcome: "Good",
    approvedBy: "Auto",
    environment: "dev",
  },
  {
    id: "log-002",
    action: "Right-sized 5 EC2 instances",
    when: "Jan 21, 18:42",
    reason: "Avg CPU 23% vs target 60%",
    impact: "$308/mo",
    outcome: "Good",
    approvedBy: "John Doe",
    environment: "prod",
  },
  {
    id: "log-003",
    action: "Paused GPU automation",
    when: "Jan 20, 13:05",
    reason: "Prod GPU incident opened",
    impact: "$0",
    outcome: "Neutral",
    approvedBy: "SRE team",
    environment: "prod",
  },
];
