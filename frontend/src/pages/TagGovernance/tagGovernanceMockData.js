export const TG_SCHEMA = [
  { key: "env", required: true, allowed: ["production", "staging", "dev", "sandbox"], coverage: 91, owner: "you" },
  { key: "team", required: true, allowed: ["payments", "ml", "data", "eng", "finance", "sales"], coverage: 84, owner: "alice@" },
  { key: "cost-center", required: true, allowed: ["CC-PAY", "CC-ML", "CC-DAT", "CC-ENG", "CC-FIN", "CC-SAL"], coverage: 73, owner: "diana@" },
  { key: "owner", required: false, allowed: null, coverage: 56, owner: "shared" },
  { key: "service", required: false, allowed: null, coverage: 41, owner: "shared" },
  { key: "criticality", required: false, allowed: ["tier-1", "tier-2", "tier-3"], coverage: 22, owner: "you" },
];

const BASE_RESOURCES = [
  { id: "i-0a4f8c2d", name: "payments-api-prod-3", svc: "EC2", spend: 842, tags: { env: "production", team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "payments-api", criticality: "tier-1" } },
  { id: "i-0fc7b21e", name: "ml-train-worker-04", svc: "EC2", spend: 3120, tags: { env: "staging", team: "ml", service: "ml-train", criticality: "tier-2" } },
  { id: "db-fin-1", name: "finance-prod-1", svc: "RDS", spend: 2840, tags: { env: "production", team: "finance", "cost-center": "CC-FIN", owner: "diana@", service: "finance-svc", criticality: "tier-1" } },
  { id: "vol-079b3", name: "logs-archive-volume", svc: "EBS", spend: 96, tags: { env: "production" } },
  { id: "i-08fa3c1", name: "sandbox-dev-runner", svc: "EC2", spend: 0, tags: { env: "sandbox", team: "eng", "cost-center": "CC-ENG", owner: "carl@" } },
  { id: "lf-search", name: "internal-search-lambda", svc: "Lambda", spend: 318, tags: { env: "production", team: "eng", "cost-center": "CC-ENG", owner: "bob@", service: "search-api", criticality: "tier-2" } },
  { id: "eip-0c1f", name: "—", svc: "EIP", spend: 4, tags: {} },
  { id: "snap-0d7f", name: "logs-snapshot-2024-02", svc: "EBS Snapshot", spend: 22, tags: { env: "production" } },
  { id: "i-09ce772", name: "checkout-api-prod-1", svc: "EC2", spend: 412, tags: { env: "prod", team: "payments", "cost-center": "CC-PAY", owner: "alice@", service: "checkout", criticality: "tier-1" } },
  { id: "redshift-1", name: "analytics-warehouse", svc: "Redshift", spend: 4820, tags: { env: "production", team: "data", "cost-center": "CC-DAT", criticality: "tier-1" } },
  { id: "os-logs", name: "logs-search-prod", svc: "OpenSearch", spend: 660, tags: { env: "production", team: "data", "cost-center": "CC-DAT" } },
  { id: "ec-redis-1", name: "session-cache-1", svc: "ElastiCache", spend: 480, tags: { env: "production", team: "eng" } },
  { id: "s3-static", name: "static-assets-prod", svc: "S3", spend: 612, tags: { env: "production", team: "eng", "cost-center": "CC-ENG" } },
];

const ENV_VALUES = ["production", "staging", "dev", "sandbox"];
const TEAM_VALUES = ["payments", "ml", "data", "eng", "finance", "sales"];
const SVC_VALUES = ["EC2", "RDS", "EBS", "Lambda", "S3", "ElastiCache"];

function synthesize(n, startIdx) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = startIdx + i;
    const env = ENV_VALUES[idx % ENV_VALUES.length];
    const team = TEAM_VALUES[idx % TEAM_VALUES.length];
    const svc = SVC_VALUES[idx % SVC_VALUES.length];
    const spend = Math.max(2, Math.round(50 + Math.sin(idx) * 200 + (idx % 17) * 30));
    const gapsRoll = idx % 11;
    const tags = { env };
    if (gapsRoll !== 0) tags.team = team;
    if (gapsRoll < 8) tags["cost-center"] = `CC-${team.slice(0, 3).toUpperCase()}`;
    if (gapsRoll < 5) tags.owner = `${team[0]}${idx}@numio.local`;
    if (gapsRoll < 3) tags.service = `${svc.toLowerCase()}-svc`;
    if (gapsRoll < 2) tags.criticality = ["tier-1", "tier-2", "tier-3"][idx % 3];
    out.push({
      id: `${svc.toLowerCase()}-tg-${idx.toString(36)}`,
      name: `${team}-${svc.toLowerCase()}-${idx}`,
      svc,
      spend,
      tags,
    });
  }
  return out;
}

export const TG_RESOURCES_ALL = [...BASE_RESOURCES, ...synthesize(487, BASE_RESOURCES.length)];

export const TG_VIEWS = [
  { id: "missing-req", label: "Resources missing required tags", owner: "shared", note: "5 resources · $7.4k/mo at risk", filter: "missing-req" },
  { id: "drift", label: "Drift (invalid values)", owner: "shared", note: "1 resource flagged", filter: "drift" },
  { id: "no-cc", label: "Missing cost-center", owner: "shared", filter: "missing-cc" },
  { id: "by-svc", label: "Grouped by service", owner: "you", filter: "all" },
  { id: "all", label: "All resources", owner: "shared", filter: "all" },
];

export function classifyCell(value, schema) {
  if (value == null) return schema.required ? "missing-req" : "missing-opt";
  if (schema.allowed && !schema.allowed.includes(value)) return "drift";
  return "ok";
}

export function rowCoverageState(resource) {
  let missingReq = 0;
  let drift = 0;
  for (const s of TG_SCHEMA) {
    const v = resource.tags?.[s.key];
    const c = classifyCell(v, s);
    if (c === "missing-req") missingReq += 1;
    if (c === "drift") drift += 1;
  }
  if (missingReq > 0) return "missing-req";
  if (drift > 0) return "drift";
  return "ok";
}

export function applyFilter(filter, resources) {
  if (!filter || filter === "all") return resources;
  if (filter === "missing-req") return resources.filter((r) => rowCoverageState(r) === "missing-req");
  if (filter === "drift") return resources.filter((r) => rowCoverageState(r) === "drift");
  if (filter === "missing-cc") return resources.filter((r) => !r.tags || r.tags["cost-center"] == null);
  return resources;
}

export function coverageColor(pct) {
  if (pct >= 85) return { color: "#16a34a", bg: "#f0fdf4", bd: "#bbf7d0" };
  if (pct >= 60) return { color: "#d97706", bg: "#fffbeb", bd: "#fde68a" };
  return { color: "#dc2626", bg: "#fef2f2", bd: "#fecaca" };
}
