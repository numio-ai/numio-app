export const STATE_KINDS = {
  good: { color: "#16a34a" },
  bad: { color: "#dc2626" },
  warn: { color: "#d97706" },
  neutral: { color: "#9ca3af" },
  none: { color: "#d1d5db" },
};

export function stateOf(label) {
  if (!label) return { kind: "none", label: "—" };
  const l = String(label).toLowerCase();
  if (["running", "available", "in-use", "associated", "active", "healthy"].includes(l)) return { kind: "good", label };
  if (l === "stopped") return { kind: "bad", label };
  if (["unassociated", "orphan", "idle"].includes(l)) return { kind: "warn", label };
  if (["terminated", "deleting"].includes(l)) return { kind: "neutral", label };
  return { kind: "neutral", label };
}

const BASE_RESOURCES = [
  { id: "i-0a4f8c2d09b3e7a11", name: "payments-api-prod-3", svc: "EC2", type: "m6i.2xlarge", state: "running", region: "us-east-1", acct: "123456789012", spend: 842, gaps: 0, tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", criticality: "tier-1" } },
  { id: "i-0fc7b21e88a4d09c2", name: "ml-train-worker-04", svc: "EC2", type: "g5.12xlarge", state: "running", region: "us-west-2", acct: "987654321098", spend: 3120, gaps: 2, tags: { env: "staging", team: "ml", criticality: "tier-2" } },
  { id: "db-finance-prod-1", name: "finance-prod-1", svc: "RDS", type: "db.r6g.4xl", state: "available", region: "us-east-1", acct: "123456789012", spend: 2840, gaps: 0, tags: { env: "production", team: "finance", "cost-center": "CC-FIN", owner: "diana@" } },
  { id: "vol-079b3f12c4ad99e", name: "logs-archive-volume", svc: "EBS", type: "gp3 · 1.2 TB", state: "unassociated", region: "us-east-1", acct: "123456789012", spend: 96, gaps: 2, tags: { env: "production" } },
  { id: "vol-0a92ed7c1f8b034e", name: "snapshot-attach-1", svc: "EBS", type: "gp3 · 240 GB", state: "in-use", region: "us-east-1", acct: "123456789012", spend: 28, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "eip-0c1f9b2e", name: "—", svc: "EIP", type: "Elastic IP", state: "unassociated", region: "eu-west-1", acct: "123456789012", spend: 4, gaps: 4, tags: {} },
  { id: "i-08fa3c1b9d4e76f02", name: "sandbox-dev-runner", svc: "EC2", type: "t3.medium", state: "stopped", region: "us-east-1", acct: "987654321098", spend: 0, gaps: 0, tags: { env: "sandbox", team: "eng", "cost-center": "CC-ENG" } },
  { id: "arn:lambda:search-api-fn", name: "search-api-fn", svc: "Lambda", type: "512 MB · py3.11", state: null, region: "us-east-1", acct: "123456789012", spend: 318, gaps: 0, tags: { env: "production", team: "eng", "cost-center": "CC-ENG", service: "search-api" } },
  { id: "s3://numio-static-prod", name: "static-assets-prod", svc: "S3", type: "Standard · 4.2 TB", state: null, region: "us-east-1", acct: "123456789012", spend: 612, gaps: 0, tags: { env: "production", team: "eng", "cost-center": "CC-ENG" } },
  { id: "redis-session-1", name: "session-cache-1", svc: "ElastiCache", type: "cache.r6g.large", state: "available", region: "us-east-1", acct: "123456789012", spend: 480, gaps: 1, tags: { env: "production", team: "eng" } },
  { id: "domain-logs-search", name: "logs-search-prod", svc: "OpenSearch", type: "m6g.large.search", state: "active", region: "us-east-1", acct: "123456789012", spend: 660, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "cluster-analytics-x", name: "analytics-warehouse", svc: "Redshift", type: "ra3.4xl × 4", state: "available", region: "us-east-1", acct: "123456789012", spend: 4820, gaps: 0, tags: { env: "production", team: "data", "cost-center": "CC-DAT", criticality: "tier-1" } },
  { id: "i-09ce772ab1f3e0017", name: "checkout-api-prod-1", svc: "EC2", type: "m6i.large", state: "running", region: "us-east-1", acct: "123456789012", spend: 412, gaps: 0, tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "checkout" } },
  { id: "snap-0d7fab1c2", name: "logs-snapshot-2024-02", svc: "EBS Snapshot", type: "880 GB", state: null, region: "us-east-1", acct: "123456789012", spend: 22, gaps: 1, tags: { env: "production" } },
];

const TEAMS = ["payments", "ml", "eng", "data", "finance", "sales"];
const ENVS = ["production", "staging", "sandbox"];
const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"];

function synthesize(n, startIdx) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = startIdx + i;
    const team = TEAMS[idx % TEAMS.length];
    const env = ENVS[idx % ENVS.length];
    const region = REGIONS[idx % REGIONS.length];
    const svc = ["EC2", "RDS", "EBS", "Lambda", "S3", "ElastiCache"][idx % 6];
    const stateMap = { EC2: idx % 5 === 0 ? "stopped" : "running", RDS: "available", EBS: idx % 4 === 0 ? "unassociated" : "in-use", Lambda: null, S3: null, ElastiCache: "available" };
    const spend = Math.max(2, Math.round(50 + Math.sin(idx) * 200 + (idx % 17) * 30));
    const gaps = idx % 7 === 0 ? 2 : idx % 3 === 0 ? 1 : 0;
    out.push({
      id: `${svc.toLowerCase()}-syn-${idx.toString(36)}`,
      name: `${team}-${svc.toLowerCase()}-${idx}`,
      svc,
      type: svc === "EC2" ? "m6i.large" : svc === "RDS" ? "db.r6g.xl" : svc === "EBS" ? "gp3 · 100 GB" : svc === "Lambda" ? "256 MB" : svc === "S3" ? "Standard" : "cache.t4g.small",
      state: stateMap[svc],
      region,
      acct: idx % 2 === 0 ? "123456789012" : "987654321098",
      spend,
      gaps,
      tags: {
        env,
        team,
        ...(gaps === 0 ? { "cost-center": `CC-${team.slice(0, 3).toUpperCase()}` } : {}),
      },
    });
  }
  return out;
}

export const RESOURCES_ALL = [
  ...BASE_RESOURCES,
  ...synthesize(986, BASE_RESOURCES.length),
];

export const TOTAL_RESOURCES_COUNT = 1284;

export const RES_SAVED_VIEWS = [
  { id: "all", label: "All resources", owner: "shared", columns: null, density: "compact" },
  { id: "prod-ec2", label: "EC2 in production", owner: "you", columns: null, density: "compact" },
  { id: "orphans", label: "Orphans (waste)", owner: "you", note: "5 unassoc EBS · 5 EIP · 412 snapshots", columns: null, density: "compact" },
  { id: "no-cc", label: "Missing cost-center", owner: "shared", columns: ["name", "svc", "spend", "tag:cost-center", "tag:env", "gaps"], density: "compact" },
  { id: "by-team", label: "Grouped by team", owner: "you", columns: null, density: "compact" },
  { id: "expensive", label: "$1k/mo and up", owner: "shared", columns: null, density: "comfortable" },
];

export const RES_COLUMNS = [
  { id: "name", label: "Name / ID", width: 280, always: true },
  { id: "svc", label: "Service", width: 92, always: true },
  { id: "spend", label: "Spend/mo", width: 88, always: true, align: "right" },
  { id: "type", label: "Type", width: 130, default: true },
  { id: "state", label: "State", width: 108, default: true },
  { id: "region", label: "Region", width: 86, default: true },
  { id: "acct", label: "Account", width: 88, default: true },
  { id: "gaps", label: "Tags", width: 64, default: true, align: "center" },
  { id: "provider", label: "Provider", width: 70 },
  { id: "created", label: "Created", width: 110 },
  { id: "arn", label: "ARN", width: 200 },
  { id: "tag:env", label: "tag:env", width: 100, tag: true },
  { id: "tag:team", label: "tag:team", width: 100, tag: true },
  { id: "tag:cost-center", label: "tag:cost-center", width: 110, tag: true },
  { id: "tag:owner", label: "tag:owner", width: 110, tag: true },
  { id: "tag:service", label: "tag:service", width: 110, tag: true },
  { id: "tag:criticality", label: "tag:criticality", width: 96, tag: true },
];

export const TAG_DIM_COUNT = RES_COLUMNS.filter((c) => c.tag).length;
export const PLATFORM_DIM_COUNT = 5;

export const DEFAULT_COLUMN_IDS = RES_COLUMNS.filter((c) => c.always || c.default).map((c) => c.id);
