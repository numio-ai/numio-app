/**
 * Mock Cost Reports Data
 *
 * Aligned with Overview teams and Spend by Team.
 * Used in: Costs > Cost Reports
 */

import { overviewSummary, overviewGreeting } from "./mockOverview";
import { teamBudgets } from "./mockBudgets";

/** AI-related team names for "AI Cost Reports" tab filter */
export const AI_TEAMS = ["ML Platform"];

/** Cost reports aligned with Overview teams and MTD spend */
export const costReports = [
  {
    id: "all",
    name: "All Resources",
    team: null,
    spend: overviewSummary.currentMTD,
    aiSpend: Math.round(overviewSummary.currentMTD * 0.48),
    createdBy: overviewGreeting.name,
    createdOn: "Feb 1, 2026",
    starred: true,
    lastViewed: "2026-02-09T14:00:00",
  },
  {
    id: "prod",
    name: "All Resources — Prod",
    team: null,
    spend: 14200,
    aiSpend: 6100,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 28, 2026",
    starred: false,
    lastViewed: "2026-02-08T10:00:00",
  },
  {
    id: "dev",
    name: "Development Costs",
    team: "Engineering / DevOps",
    spend: 5200,
    aiSpend: 0,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 21, 2026",
    starred: false,
    lastViewed: "2026-02-07T09:00:00",
  },
  ...teamBudgets.slice(0, 4).map((t, i) => ({
    id: t.id,
    name: t.team,
    team: t.team,
    spend: t.current,
    aiSpend: AI_TEAMS.includes(t.team) ? Math.round(t.current * 0.85) : Math.round(t.current * 0.1),
    budget: t.budget,
    status: t.status,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 22, 2026",
    starred: t.id === "budget-eng-devops" || t.id === "budget-ml",
    lastViewed: ["2026-02-09T08:00:00", "2026-02-08T16:00:00", "2026-02-08T12:00:00", "2026-02-07T14:00:00"][i],
  })),
];
