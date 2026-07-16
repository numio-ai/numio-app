/**
 * Mock People / Team Members Data
 *
 * Connected to Overview: teams align with Spend by Team and teamBudgets.
 * Used in: Settings > People, Overview (implicit)
 */

import { overviewGreeting } from "./mockOverview";
import { teamBudgets } from "./mockBudgets";

/** Account owner — matches Overview greeting */
export const accountOwner = {
  initials: "JC",
  name: overviewGreeting.name,
  email: "james.cooper@acme.com",
  role: "Admin",
  roleBadge: "badge--purple",
  lastActive: "Active now",
  isOwner: true,
};

/** Team members mapped to Overview teams (teamBudgets) */
export const teamMembers = [
  {
    initials: "JC",
    name: overviewGreeting.name,
    email: "james.cooper@acme.com",
    role: "Admin",
    roleBadge: "badge--purple",
    lastActive: "Active now",
    isOwner: true,
    team: null,
  },
  {
    initials: "DR",
    name: "Dan Rivera",
    email: "dan@acme.com",
    role: "FinOps Engineer",
    roleBadge: "badge--warning",
    lastActive: "2 hours ago",
    isOwner: false,
    team: "Engineering / DevOps",
  },
  {
    initials: "AT",
    name: "Alice Tang",
    email: "alice@acme.com",
    role: "Developer",
    roleBadge: "badge--info",
    lastActive: "Yesterday",
    isOwner: false,
    team: "ML Platform",
  },
  {
    initials: "MK",
    name: "Mike Kim",
    email: "mike@acme.com",
    role: "Developer",
    roleBadge: "badge--info",
    lastActive: "1 hour ago",
    isOwner: false,
    team: "Data & Analytics",
  },
  {
    initials: "ES",
    name: "Emma Santos",
    email: "emma@acme.com",
    role: "Developer",
    roleBadge: "badge--info",
    lastActive: "3 hours ago",
    isOwner: false,
    team: "Marketing",
  },
  {
    initials: "CL",
    name: "Chris Lee",
    email: "chris@acme.com",
    role: "Viewer",
    roleBadge: "badge--info",
    lastActive: "Yesterday",
    isOwner: false,
    team: "Sales",
  },
  {
    initials: "FL",
    name: "Finance Lead",
    email: "finance@acme.com",
    role: "FinOps Engineer",
    roleBadge: "badge--warning",
    lastActive: "4 hours ago",
    isOwner: false,
    team: "Corporate / Other",
  },
];

/** Teams with members — aligned with teamBudgets */
export const teamsWithMembers = teamBudgets.map((t) => ({
  id: t.id,
  team: t.team,
  budget: t.budget,
  current: t.current,
  status: t.status,
  members: teamMembers.filter((m) => m.team === t.team),
}));
