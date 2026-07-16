export const TIME_RANGES = [
  { id: "7D", label: "7D", period: "last 7 days", periodUpper: "LAST 7 DAYS", prev: "previous 7 days" },
  { id: "30D", label: "30D", period: "last 30 days", periodUpper: "LAST 30 DAYS", prev: "previous 30 days" },
  { id: "MTD", label: "MTD", period: "MTD", periodUpper: "MTD", prev: "previous month-to-date" },
  { id: "QTD", label: "QTD", period: "QTD", periodUpper: "QTD", prev: "previous quarter-to-date" },
  { id: "YTD", label: "YTD", period: "YTD", periodUpper: "YTD", prev: "previous year-to-date" },
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
