/**
 * Mock Resource Reports Data
 *
 * Resource inventory reports aligned with Overview and resourcesSummary.
 * Used in: Resources > Resource Reports
 */

import { resourcesSummary } from "./mockResources";
import { overviewGreeting } from "./mockOverview";
import { teamBudgets } from "./mockBudgets";

/** Resource reports aligned with Overview teams and MTD spend */
export const resourceReports = [
  {
    id: "all-active",
    name: "All Active Resources",
    team: null,
    totalResources: resourcesSummary.totalResources,
    accruedCosts: resourcesSummary.totalCost,
    createdBy: overviewGreeting.name,
    createdOn: "Feb 1, 2026",
    starred: true,
  },
  {
    id: "prod-resources",
    name: "Production Resources",
    team: null,
    totalResources: 98,
    accruedCosts: 14200,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 28, 2026",
    starred: false,
  },
  {
    id: "dev-resources",
    name: "Development Resources",
    team: "Engineering / DevOps",
    totalResources: 42,
    accruedCosts: 5200,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 21, 2026",
    starred: false,
  },
  ...teamBudgets.slice(0, 4).map((t) => ({
    id: `report-${t.id}`,
    name: `${t.team} Resources`,
    team: t.team,
    totalResources: Math.round(t.current / 200), // approximate resource count
    accruedCosts: t.current,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 22, 2026",
    starred: t.id === "budget-eng-devops" || t.id === "budget-ml",
  })),
];
