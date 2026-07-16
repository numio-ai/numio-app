/**
 * Mock AI Workloads Data
 *
 * AI & token consumption, LLM spend, GPU utilization, K8s attribution.
 * Aligned with Overview ExecCardAIToken: Total AI Spend $8,920, 14.2M tokens, 23% GPU util.
 * Used in: Overview (AI & Token Consumption), Resources > AI Workloads
 */

/** AI apps by model — matches Overview AI & Token card; sum = $8,920 */
export const aiAppsData = [
  { app: "Chatbot Prod", model: "GPT-4", inputK: 4200, outputK: 1800, cost: 4120, pct: 46 },
  { app: "Code Assistant", model: "Claude 3.5", inputK: 3100, outputK: 980, cost: 2280, pct: 26 },
  { app: "Doc Summarizer", model: "GPT-3.5", inputK: 2800, outputK: 420, cost: 1420, pct: 16 },
  { app: "Internal Search", model: "Embeddings", inputK: 1100, outputK: 0, cost: 620, pct: 7 },
  { app: "Other", model: "Mixed", inputK: 480, outputK: 120, cost: 480, pct: 5 },
];

/** Summary — matches Overview ExecCardAIToken */
export const aiWorkloadsSummary = {
  totalSpend: 8920,
  totalTokens: "14.2M",
  tokensVsJan: "12.1M",
  tokensTrend: "↑17%",
  costPer1k: "$0.45",
  gpuUtilization: 23,
  gpuInstanceCount: 3,
  gpuMtdCost: 9864,
  gpuWastedPerDay: 320,
  spendTrend: "↑ 18% vs last mo",
  lastUpdated: "2 min ago",
};

/** LLM spend by provider — sums to Overview total $8,920 */
export const llmSpend = [
  { provider: "OpenAI", costPer1k: "$0.015", costPerInf: "$0.0021", monthly: 5540 }, // Chatbot + Doc Summarizer
  { provider: "Anthropic", costPer1k: "$0.018", costPerInf: "$0.0026", monthly: 2280 }, // Code Assistant
  { provider: "Cohere", costPer1k: "$0.010", costPerInf: "$0.0015", monthly: 620 }, // Internal Search
  { provider: "Other", costPer1k: "$0.012", costPerInf: "$0.0018", monthly: 480 },
];

/** GPU instances — avg util aligns with Overview 23% */
export const gpuUtilization = [
  {
    gpu: "gpu-ml-03",
    instanceType: "p3.2xlarge",
    workload: "ml-training-job-47",
    env: "dev",
    computeUtil: 8,
    memoryUtil: 14,
    idleHours: "52h",
    costPerHour: 4.1,
    mtdCost: 2952,
    recommendation: "terminate",
    recommendationLabel: "Terminate — idle 52h in dev, $4.1/hr wasted",
  },
  {
    gpu: "gpu-train-11",
    instanceType: "A100 40GB",
    workload: "training-run-prod-v3",
    env: "prod",
    computeUtil: 64,
    memoryUtil: 61,
    idleHours: "2h",
    costPerHour: 6.2,
    mtdCost: 4464,
    recommendation: "on-track",
    recommendationLabel: "On track",
  },
  {
    gpu: "gpu-infer-02",
    instanceType: "A10G",
    workload: "inference-api-staging",
    env: "staging",
    computeUtil: 22,
    memoryUtil: 58,
    idleHours: "18h",
    costPerHour: 3.4,
    mtdCost: 2448,
    recommendation: "schedule",
    recommendationLabel: "Schedule off-hours — idle 18h in staging",
  },
];

/** K8s namespaces — AI/ML workloads; costs within AI spend context */
export const k8sCosts = [
  {
    namespace: "ml-training",
    cost: 3500,
    pods: 28,
    util: 72,
    models: ["GPT-4", "Claude 3.5"],
    gpuBacked: "gpu-train-11 (prod)",
    costPerRun: "$124/run",
    status: "healthy",
  },
  {
    namespace: "inference",
    cost: 2800,
    pods: 16,
    util: 61,
    models: ["GPT-3.5", "Embeddings"],
    gpuBacked: "gpu-infer-02 (staging)",
    costPerRun: "$0.003/req",
    status: "over-provisioned",
  },
  {
    namespace: "platform",
    cost: 1200,
    pods: 12,
    util: 48,
    models: ["Mixed"],
    gpuBacked: "gpu-ml-03 (dev)",
    costPerRun: "—",
    status: "idle",
  },
];
