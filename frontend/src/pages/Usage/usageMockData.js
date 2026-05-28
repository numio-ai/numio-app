export const TIME_RANGES = [
  { id: "7D", label: "7D", period: "last 7 days", periodUpper: "LAST 7 DAYS", prev: "previous 7 days", days: 7 },
  { id: "30D", label: "30D", period: "last 30 days", periodUpper: "LAST 30 DAYS", prev: "previous 30 days", days: 30 },
  { id: "MTD", label: "MTD", period: "MTD", periodUpper: "MTD", prev: "previous month-to-date", days: 27 },
  { id: "QTD", label: "QTD", period: "QTD", periodUpper: "QTD", prev: "previous quarter-to-date", days: 58 },
  { id: "YTD", label: "YTD", period: "YTD", periodUpper: "YTD", prev: "previous year-to-date", days: 147 },
];

export const GRANULARITY_OPTIONS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
];

export const TAG_SCHEMA = [
  { key: "env", required: true },
  { key: "team", required: true },
  { key: "cost-center", required: true },
  { key: "owner", required: false },
  { key: "service", required: false },
  { key: "criticality", required: false },
];

export const PLATFORM_DIMS = [
  { key: "service", label: "Service" },
  { key: "account", label: "Account" },
  { key: "region", label: "Region" },
  { key: "provider", label: "Provider" },
  { key: "resource_type", label: "Resource type" },
];

export const SERIES_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
export const UNTAGGED_COLOR = "#9ca3af";

export const CLOUD_SCENARIO = {
  total: 274229,
  delta: -6.4,
  forecast: { value: 297500, budget: 320000, status: "on track" },
  defaultGroupBy: { kind: "tag", key: "cost-center" },
  defaultFilters: [
    { kind: "platform", key: "service", values: ["Amazon Bedrock"] },
    { kind: "tag", key: "env", values: ["production"] },
  ],
  series: [
    { name: "CC-PAY", color: SERIES_COLORS[0], base: 1400, drift: 12, amp: 90, phase: 0 },
    { name: "CC-ML", color: SERIES_COLORS[1], base: 1020, drift: 18, amp: 80, phase: 2 },
    { name: "CC-ENG", color: SERIES_COLORS[2], base: 820, drift: 4, amp: 60, phase: 1 },
    { name: "CC-DAT", color: SERIES_COLORS[3], base: 540, drift: 6, amp: 45, phase: 3 },
    { name: "CC-FIN", color: SERIES_COLORS[4], base: 410, drift: 1, amp: 32, phase: 4 },
    { name: "CC-SAL", color: SERIES_COLORS[5], base: 280, drift: 2, amp: 22, phase: 5 },
    { name: "Untagged", color: UNTAGGED_COLOR, base: 50, drift: 0, amp: 6, phase: 6, untagged: true },
  ],
  breakdown: [
    { name: "CC-PAY", team: "payments", spend: 84120, share: 31, trend: "−2.1%", up: false },
    { name: "CC-ML", team: "ml", spend: 62840, share: 23, trend: "+8.4%", up: true },
    { name: "CC-ENG", team: "eng", spend: 51300, share: 19, trend: "−1.0%", up: false },
    { name: "CC-DAT", team: "data", spend: 32180, share: 12, trend: "+3.2%", up: true },
    { name: "CC-FIN", team: "finance", spend: 24500, share: 9, trend: "+0.4%", up: true },
    { name: "CC-SAL", team: "sales", spend: 16400, share: 6, trend: "+1.8%", up: true },
    { name: "Untagged", team: "—", spend: 2840, share: 1, trend: "+12%", up: true, untagged: true },
  ],
};

export const AI_SCENARIO = {
  total: 8900,
  delta: 18.0,
  forecast: null,
  defaultGroupBy: { kind: "tag", key: "team" },
  defaultFilters: [
    { kind: "platform", key: "provider", values: ["OpenAI"] },
  ],
  series: [
    { name: "payments", color: SERIES_COLORS[0], base: 110, drift: 4, amp: 12, phase: 0 },
    { name: "eng", color: SERIES_COLORS[1], base: 78, drift: 3, amp: 10, phase: 2 },
    { name: "data", color: SERIES_COLORS[2], base: 44, drift: -1, amp: 6, phase: 1 },
    { name: "sales", color: SERIES_COLORS[3], base: 22, drift: 2, amp: 5, phase: 3 },
    { name: "ml", color: SERIES_COLORS[4], base: 20, drift: 0, amp: 4, phase: 4 },
    { name: "Untagged", color: UNTAGGED_COLOR, base: 12, drift: 0, amp: 3, phase: 5, untagged: true },
  ],
  breakdown: [
    { name: "payments", spend: 3840, share: 43, trend: "+12%", up: true },
    { name: "eng", spend: 2280, share: 26, trend: "+5%", up: true },
    { name: "data", spend: 1240, share: 14, trend: "−3%", up: false },
    { name: "sales", spend: 620, share: 7, trend: "+42%", up: true },
    { name: "ml", spend: 580, share: 7, trend: "+8%", up: true },
    { name: "Untagged", spend: 340, share: 4, trend: "+25%", up: true, untagged: true },
  ],
};

/**
 * Alternate breakdowns keyed by `<kind>:<key>` so changing Group by produces
 * visibly different rows and series in the mock. When a group-by is not in
 * the map, the scenario's default breakdown / series are used.
 */
export const CLOUD_GROUP_BY_VARIANTS = {
  "platform:service": {
    series: [
      { name: "EC2", color: SERIES_COLORS[0], base: 1600, drift: 8, amp: 70, phase: 0 },
      { name: "RDS", color: SERIES_COLORS[1], base: 920, drift: 6, amp: 60, phase: 1 },
      { name: "S3", color: SERIES_COLORS[2], base: 480, drift: 2, amp: 28, phase: 2 },
      { name: "Lambda", color: SERIES_COLORS[3], base: 290, drift: 1, amp: 18, phase: 3 },
      { name: "OpenSearch", color: SERIES_COLORS[4], base: 220, drift: 0, amp: 14, phase: 4 },
    ],
    breakdown: [
      { name: "EC2", team: "—", spend: 118400, share: 43, trend: "+1.2%", up: true },
      { name: "RDS", team: "—", spend: 64200, share: 23, trend: "−0.8%", up: false },
      { name: "S3", team: "—", spend: 41800, share: 15, trend: "+4.0%", up: true },
      { name: "Lambda", team: "—", spend: 24300, share: 9, trend: "+2.2%", up: true },
      { name: "OpenSearch", team: "—", spend: 16100, share: 6, trend: "+0.5%", up: true },
      { name: "EBS", team: "—", spend: 9429, share: 4, trend: "−2.4%", up: false },
    ],
  },
  "platform:account": {
    series: [
      { name: "prod-a (···9012)", color: SERIES_COLORS[0], base: 1620, drift: 10, amp: 80, phase: 0 },
      { name: "prod-b (···1098)", color: SERIES_COLORS[1], base: 940, drift: 6, amp: 60, phase: 1 },
      { name: "staging (···4476)", color: SERIES_COLORS[2], base: 520, drift: 3, amp: 32, phase: 2 },
      { name: "sandbox (···8821)", color: SERIES_COLORS[3], base: 230, drift: 0, amp: 16, phase: 3 },
    ],
    breakdown: [
      { name: "prod-a (···9012)", team: "platform", spend: 138400, share: 50, trend: "−2.0%", up: false },
      { name: "prod-b (···1098)", team: "ml", spend: 86200, share: 31, trend: "+6.4%", up: true },
      { name: "staging (···4476)", team: "eng", spend: 38800, share: 14, trend: "+1.0%", up: true },
      { name: "sandbox (···8821)", team: "dev", spend: 10829, share: 5, trend: "−4.0%", up: false },
    ],
  },
  "platform:region": {
    series: [
      { name: "us-east-1", color: SERIES_COLORS[0], base: 1900, drift: 14, amp: 100, phase: 0 },
      { name: "us-west-2", color: SERIES_COLORS[1], base: 840, drift: 4, amp: 50, phase: 1 },
      { name: "eu-west-1", color: SERIES_COLORS[2], base: 360, drift: 1, amp: 22, phase: 2 },
    ],
    breakdown: [
      { name: "us-east-1", team: "—", spend: 178400, share: 65, trend: "−1.1%", up: false },
      { name: "us-west-2", team: "—", spend: 70200, share: 26, trend: "+3.8%", up: true },
      { name: "eu-west-1", team: "—", spend: 25629, share: 9, trend: "+0.4%", up: true },
    ],
  },
  "tag:team": {
    series: [
      { name: "payments", color: SERIES_COLORS[0], base: 1300, drift: 9, amp: 80, phase: 0 },
      { name: "ml", color: SERIES_COLORS[1], base: 970, drift: 14, amp: 70, phase: 1 },
      { name: "eng", color: SERIES_COLORS[2], base: 760, drift: 3, amp: 55, phase: 2 },
      { name: "data", color: SERIES_COLORS[3], base: 470, drift: 5, amp: 40, phase: 3 },
      { name: "finance", color: SERIES_COLORS[4], base: 360, drift: 1, amp: 26, phase: 4 },
      { name: "sales", color: SERIES_COLORS[5], base: 240, drift: 1, amp: 18, phase: 5 },
      { name: "Untagged", color: UNTAGGED_COLOR, base: 50, drift: 0, amp: 6, phase: 6, untagged: true },
    ],
    breakdown: [
      { name: "payments", team: "payments", spend: 89500, share: 33, trend: "−1.8%", up: false },
      { name: "ml", team: "ml", spend: 64200, share: 23, trend: "+9.1%", up: true },
      { name: "eng", team: "eng", spend: 49600, share: 18, trend: "−0.6%", up: false },
      { name: "data", team: "data", spend: 30100, share: 11, trend: "+3.2%", up: true },
      { name: "finance", team: "finance", spend: 22800, share: 8, trend: "+0.4%", up: true },
      { name: "sales", team: "sales", spend: 15200, share: 6, trend: "+1.8%", up: true },
      { name: "Untagged", team: "—", spend: 2829, share: 1, trend: "+12%", up: true, untagged: true },
    ],
  },
  "tag:env": {
    series: [
      { name: "production", color: SERIES_COLORS[0], base: 2200, drift: 12, amp: 120, phase: 0 },
      { name: "staging", color: SERIES_COLORS[1], base: 540, drift: 2, amp: 32, phase: 1 },
      { name: "dev", color: SERIES_COLORS[2], base: 280, drift: 0, amp: 18, phase: 2 },
    ],
    breakdown: [
      { name: "production", team: "—", spend: 220500, share: 80, trend: "−1.2%", up: false },
      { name: "staging", team: "—", spend: 35200, share: 13, trend: "+2.8%", up: true },
      { name: "dev", team: "—", spend: 18529, share: 7, trend: "+5.4%", up: true },
    ],
  },
};

export function variantFor(scope, groupBy) {
  if (!groupBy) return null;
  const key = `${groupBy.kind}:${groupBy.key}`;
  if (scope === "cloud") return CLOUD_GROUP_BY_VARIANTS[key] || null;
  return null;
}

export const SAVED_VIEWS_CLOUD = [
  { id: "by-cc", label: "By cost-center · prod", owner: "you", groupBy: { kind: "tag", key: "cost-center" }, filters: [{ kind: "tag", key: "env", values: ["production"] }] },
  { id: "by-team", label: "By team", owner: "you", groupBy: { kind: "tag", key: "team" }, filters: [] },
  { id: "by-env", label: "By environment", owner: "shared", groupBy: { kind: "tag", key: "env" }, filters: [] },
  { id: "by-account", label: "By account", owner: "shared", groupBy: { kind: "platform", key: "account" }, filters: [] },
  { id: "by-service", label: "By service", owner: "alice@", groupBy: { kind: "platform", key: "service" }, filters: [] },
];

export const SAVED_VIEWS_AI = [
  { id: "by-team", label: "By team", owner: "you", groupBy: { kind: "tag", key: "team" }, filters: [] },
  { id: "by-workload", label: "By workload", owner: "you", groupBy: { kind: "tag", key: "service" }, filters: [] },
  { id: "by-model", label: "By model", owner: "shared", groupBy: { kind: "platform", key: "resource_type" }, filters: [] },
  { id: "by-cc", label: "By cost-center", owner: "shared", groupBy: { kind: "tag", key: "cost-center" }, filters: [] },
];

export function getScenario(scope) {
  return scope === "ai" ? AI_SCENARIO : CLOUD_SCENARIO;
}

export function getSavedViews(scope) {
  return scope === "ai" ? SAVED_VIEWS_AI : SAVED_VIEWS_CLOUD;
}
