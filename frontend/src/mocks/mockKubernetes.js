/**
 * Mock Kubernetes Data
 *
 * K8s efficiency reports and namespace costs.
 * Aligned with Overview: AI Workloads K8s attribution (ml-training, inference, platform).
 * Used in: Resources > Kubernetes, AI Workloads page
 */

import { k8sCosts } from "./mockAIWorkloads";
import { overviewGreeting } from "./mockOverview";

const totalK8sCost = k8sCosts.reduce((sum, ns) => sum + ns.cost, 0);

/** K8s efficiency reports — align with AI Workloads namespace attribution */
export const kubernetesReports = [
  {
    id: "all-k8s",
    name: "All Kubernetes Efficiency Metrics",
    namespace: null,
    team: null,
    cost: totalK8sCost,
    pods: k8sCosts.reduce((s, ns) => s + ns.pods, 0),
    util: "62%",
    createdBy: overviewGreeting.name,
    createdOn: "Feb 1, 2026",
    starred: true,
  },
  ...k8sCosts.map((ns, i) => ({
    id: `k8s-${ns.namespace}`,
    name: `${ns.namespace} efficiency`,
    namespace: ns.namespace,
    team: ns.namespace === "ml-training" ? "ML Platform" : ns.namespace === "inference" ? "ML Platform" : "Engineering / DevOps",
    cost: ns.cost,
    pods: ns.pods,
    util: ns.util,
    createdBy: overviewGreeting.name,
    createdOn: "Jan 24, 2026",
    starred: i === 0,
  })),
];

/** Summary — aligns with AI Workloads K8s section */
export const kubernetesSummary = {
  totalCost: totalK8sCost,
  totalPods: k8sCosts.reduce((s, ns) => s + ns.pods, 0),
  namespaces: k8sCosts.length,
  lastUpdated: "2 min ago",
};
