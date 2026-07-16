export const INITIAL_RULES = [
  {
    id: "rule-hibernate-dev",
    name: "Hibernate dev/sandbox nightly",
    description: "Stops <2% CPU instances 8pm–6am",
    schedule: "Daily · 8pm local",
    runs7d: 7,
    saved7d: 2710,
    lastRun: "2h ago",
    state: "active",
    archived: false,
  },
  {
    id: "rule-pr-cost-guard",
    name: "PR cost guard",
    description: "Blocks merges projecting > 20% cost regression",
    schedule: "On PR open",
    runs7d: 14,
    saved7d: 4310,
    lastRun: "32m ago",
    state: "active",
    archived: false,
  },
  {
    id: "rule-reclaim-ebs",
    name: "Reclaim unattached EBS",
    description: "Snapshots + deletes volumes idle > 30 days",
    schedule: "Daily · 2am UTC",
    runs7d: 4,
    saved7d: 612,
    lastRun: "6h ago",
    state: "active",
    archived: false,
  },
  {
    id: "rule-archive-logs",
    name: "Archive logs to Glacier",
    description: "Moves logs > 30 days old to Glacier IR",
    schedule: "Weekly · Sunday",
    runs7d: 1,
    saved7d: 240,
    lastRun: "3d ago",
    state: "active",
    archived: false,
  },
  {
    id: "rule-resize-rds",
    name: "Resize over-provisioned RDS",
    description: "Recommends + applies smaller tier when CPU < 15% for 7d",
    schedule: "Weekly · Friday",
    runs7d: 0,
    saved7d: 0,
    lastRun: "—",
    state: "paused",
    archived: false,
  },
  {
    id: "rule-old-snapshot",
    name: "Clean ancient snapshots",
    description: "Deletes snapshots > 365 days old (archived 2026-04-12)",
    schedule: "Daily · 1am UTC",
    runs7d: 0,
    saved7d: 0,
    lastRun: "—",
    state: "paused",
    archived: true,
  },
];

const TIME_180_MIN = 180 * 60 * 1000;
const TIME_20_HR = 20 * 60 * 60 * 1000;
const TIME_8_DAY = 8 * 24 * 60 * 60 * 1000;

export const INITIAL_HISTORY = [
  {
    id: "ah-2026-05-16-001",
    when: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    ruleId: "rule-hibernate-dev",
    rule: "Hibernate dev/sandbox nightly",
    target: "12 EC2 instances · dev fleet",
    outcome: "stopped",
    saved: 980,
    actionType: "reversible",
    autoResumed: false,
  },
  {
    id: "ah-2026-05-16-002",
    when: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ruleId: "rule-pr-cost-guard",
    rule: "PR cost guard",
    target: "github://payments/service-ledger#4821",
    outcome: "blocked",
    saved: 4310,
    actionType: "reversible",
    autoResumed: false,
  },
  {
    id: "ah-2026-05-16-003",
    when: new Date(Date.now() - TIME_20_HR).toISOString(),
    ruleId: "rule-reclaim-ebs",
    rule: "Reclaim unattached EBS",
    target: "8 EBS volumes",
    outcome: "deleted",
    saved: 156,
    actionType: "reversible",
    autoResumed: false,
  },
  {
    id: "ah-2026-05-16-004",
    when: new Date(Date.now() - TIME_180_MIN).toISOString(),
    ruleId: "rule-hibernate-dev",
    rule: "Hibernate dev/sandbox nightly",
    target: "ml-train-worker-04",
    outcome: "resumed",
    saved: 0,
    actionType: "reversible",
    autoResumed: true,
  },
  {
    id: "ah-2026-05-16-005",
    when: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    ruleId: "rule-pr-cost-guard",
    rule: "PR cost guard advisory",
    target: "github://data/etl#1142",
    outcome: "advised",
    saved: 0,
    actionType: "advisory",
    autoResumed: false,
  },
  {
    id: "ah-2026-05-16-006",
    when: new Date(Date.now() - TIME_8_DAY).toISOString(),
    ruleId: "rule-archive-logs",
    rule: "Archive logs to Glacier",
    target: "logs-bucket-prod",
    outcome: "stopped",
    saved: 240,
    actionType: "reversible",
    autoResumed: false,
  },
];

export const RULE_TEMPLATES = [
  { id: "tpl-hibernate", name: "Hibernate idle instances", note: "Stop low-CPU instances during off-hours" },
  { id: "tpl-pr-guard", name: "PR cost guard", note: "Block merges projecting cost regressions" },
  { id: "tpl-ebs-reclaim", name: "Reclaim orphan EBS", note: "Snapshot then delete long-unattached volumes" },
  { id: "tpl-rds-resize", name: "Right-size RDS", note: "Recommend smaller tier on sustained low CPU" },
];

export function undoStateFor(action, now = Date.now()) {
  if (action.actionType === "advisory") return { kind: "advisory" };
  if (action.autoResumed) return { kind: "auto" };
  const t = new Date(action.when).getTime();
  const elapsed = now - t;
  const window = 24 * 60 * 60 * 1000;
  if (elapsed >= window) return { kind: "expired" };
  const remaining = window - elapsed;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
  return { kind: "within", label };
}

export function outcomeChipTone(outcome) {
  if (outcome === "blocked" || outcome === "deleted") return { color: "#9a3412", bg: "#fff7ed", bd: "#fed7aa" };
  if (outcome === "stopped" || outcome === "resized") return { color: "#3730a3", bg: "#eef2ff", bd: "#c7d2fe" };
  if (outcome === "resumed") return { color: "#166534", bg: "#f0fdf4", bd: "#bbf7d0" };
  return { color: "#374151", bg: "#f3f4f6", bd: "#e5e5e5" };
}
