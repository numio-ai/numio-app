/**
 * Mock Network Flow / Data Transfer Data
 *
 * Network egress, data transfer, VPC flow metrics.
 * Aligned with Overview: S3 egress spike $21/day, changeTimeline, alertHistory, urgentInsight.
 * Used in: Overview (alerts, change timeline), Resources > Network Flow
 */

/** Summary — aligns with Overview MTD and egress context */
export const networkSummary = {
  totalEgressCost: 412, // $/mo MTD — S3 egress + data transfer
  egressDaily: 21, // $/day — matches Overview S3 Egress $21/day
  vsJan: 380,
  lastUpdated: "2 min ago",
};

/** Data transfer by service — S3 egress from Overview urgentInsight */
export const dataTransferByService = [
  { service: "S3 Egress", cost: 189, pct: 46, trend: "up", trendVal: "23%", team: "ML Platform" },
  { service: "Inter-AZ Transfer", cost: 98, pct: 24, trend: "flat", trendVal: "0%", team: "Engineering / DevOps" },
  { service: "CloudFront", cost: 62, pct: 15, trend: "down", trendVal: "5%", team: "Marketing" },
  { service: "VPC Peering", cost: 41, pct: 10, trend: "up", trendVal: "8%", team: "Data & Analytics" },
  { service: "NAT Gateway", cost: 22, pct: 5, trend: "flat", trendVal: "0%", team: "Engineering / DevOps" },
];

/** Recent network alerts — matches Overview alertHistory */
export const networkAlerts = [
  { id: "alert-002", severity: "warning", title: "S3 egress spike", time: "Jan 18, 11:42 AM", impact: "+$21/day", owner: "ml-team" },
  { id: "nw-001", severity: "info", title: "VPC flow logs enabled", time: "Jan 15, 9:00 AM", impact: null, owner: null },
];

/** Change timeline — matches Overview changeTimeline for network events */
export const networkChangeTimeline = [
  { time: "4:05 PM", event: "S3 egress spike detected", owner: "ml-team", impact: "+$21/day" },
  { time: "2:30 PM", event: "CloudFront cache hit rate improved", owner: "platform-team", impact: "-$3/day" },
  { time: "10:15 AM", event: "New VPC peering connection", owner: "data-pipeline", impact: "+$2/day" },
];

/** Top egress sources — buckets/endpoints */
export const topEgressSources = [
  { source: "s3://ml-models", bytes: "2.4 TB", cost: 89, team: "ML Platform" },
  { source: "s3://data-pipeline-output", bytes: "1.1 TB", cost: 52, team: "Data & Analytics" },
  { source: "s3://customer-uploads", bytes: "0.8 TB", cost: 38, team: "Marketing" },
];
