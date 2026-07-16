/**
 * Mock Issues & Tickets Data
 *
 * Ticket summary and open tickets for Govern > Issues.
 * Aligned with Overview (anomalies, policy, budget).
 */

import { overviewSummary } from "./mockOverview";

export const issueSummary = {
  open: 6,
  routed: 4,
  resolved: 18,
};

export const lastUpdated = overviewSummary.lastUpdated;

export const issueTickets = [
  {
    id: "JIRA-1234",
    title: "Prod costs spike",
    owner: "devops-lead",
    status: "Open",
    created: "2 hours ago",
    type: "Anomaly",
  },
  {
    id: "OPS-221",
    title: "Unapproved GPU type in dev",
    owner: "ml-team",
    status: "In Review",
    created: "Yesterday",
    type: "Policy",
  },
  {
    id: "FIN-098",
    title: "Budget overrun forecast",
    owner: "finance",
    status: "Open",
    created: "Jan 19",
    type: "Budget",
  },
];

