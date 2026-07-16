import { overviewSummary } from "./mockOverview";

export const crossCloudSummary = {
  aws: 58210,
  gcp: 40120,
  azure: 27980,
  currency: "USD",
  period: overviewSummary.period,
};

export const lastUpdated = overviewSummary.lastUpdated;

export const workloadComparisons = [
  {
    workload: "Inference API",
    aws: { cost: 18200, perf: "P95 220ms" },
    gcp: { cost: 14200, perf: "P95 210ms" },
    azure: { cost: 16800, perf: "P95 230ms" },
    recommendation: "Move to GCP",
    savings: "$4,000/mo",
  },
  {
    workload: "Batch Training",
    aws: { cost: 25100, perf: "6.2 hrs" },
    gcp: { cost: 21400, perf: "6.4 hrs" },
    azure: { cost: 23500, perf: "6.1 hrs" },
    recommendation: "Stay on AWS",
    savings: "$0",
  },
];

export const providerOpportunities = [
  { provider: "AWS", item: "Reserved Instances for EC2", impact: "$2,120/mo" },
  { provider: "GCP", item: "Sustained use discounts", impact: "$1,480/mo" },
  { provider: "Azure", item: "Spot VM rebalancing", impact: "$920/mo" },
];
