import { overviewSummary } from "./mockOverview";

export const lastUpdated = overviewSummary.lastUpdated;

export const savingsTimeline = {
  range: "Last 90 days",
  projected: [120, 130, 140, 150, 165, 180, 190, 210, 230, 245, 260, 280],
  actual: [120, 128, 135, 146, 158, 166, 170, 182, 190, 198, 205, 212],
  savings: [0, 2, 5, 4, 7, 14, 20, 28, 40, 47, 55, 68],
  labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
};

export const savingsBreakdown = [
  { type: "Right-sizing", amount: 8420 },
  { type: "Idle cleanup", amount: 3920 },
  { type: "Commitment plans", amount: 6240 },
  { type: "Storage optimization", amount: 2180 },
];

export const savingsActions = [
  { id: "act-01", action: "Stopped 12 idle EC2 instances", impact: "$1,120/mo", date: "Jan 12" },
  { id: "act-02", action: "Right-sized 6 RDS instances", impact: "$980/mo", date: "Jan 18" },
  { id: "act-03", action: "Enabled S3 Intelligent-Tiering", impact: "$320/mo", date: "Jan 21" },
];
