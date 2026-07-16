/**
 * Mock Integrations Data
 *
 * Cloud providers and integrations aligned with Overview.
 * AWS connected = source of Overview MTD $18,420, resources, cost data.
 * Used in: Settings > Integrations
 */

import { overviewSummary } from "./mockOverview";

/** Cloud providers — AWS connected feeds Overview data */
export const cloudProviders = [
  {
    name: "AWS",
    status: "Connected",
    account: "123456789012",
    lastSync: overviewSummary.lastUpdated,
    health: [
      { label: "Billing", status: "ok" },
      { label: "Cost explorer", status: "ok" },
      { label: "EC2", status: "warning" },
    ],
  },
  {
    name: "GCP",
    status: "Not Connected",
  },
  {
    name: "Azure",
    status: "Not Connected",
  },
  {
    name: "Oracle Cloud",
    status: "Not Connected",
  },
];
