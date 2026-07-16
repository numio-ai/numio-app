export const REC_HIBERNATE = {
  id: "r-201",
  title: "Hibernate 142 idle dev/sandbox resources nightly",
  category: "Idle resource",
  scope: "aws://dev/* + gcp://sandbox/*",
  saving: 11820,
  effort: "Low",
  confidence: "High",
  autopilot: true,
  source: "ai",
  affectedCount: 142,
  signals: [
    "142 resources averaged <2% CPU for 14 consecutive nights (8pm–6am local).",
    "Tagged owners' last activity > 9 days ago.",
    "No active incidents or PR pushes affecting these resources in the last 14 days.",
    "Tag Governance flagged 6 production-adjacent resources — auto-excluded.",
  ],
  sample: [
    { name: "ml-train-worker-04", svc: "EC2", type: "g5.12xlarge", spend: 3120, idle: "14/14 nights" },
    { name: "data-eda-3", svc: "EC2", type: "m6i.4xlarge", spend: 980, idle: "14/14 nights" },
    { name: "k8s-dev-cluster-2", svc: "EKS", type: "t3.large × 8", spend: 620, idle: "13/14 nights" },
    { name: "analytics-dev-warehouse", svc: "Redshift", type: "ra3.xl × 2", spend: 480, idle: "14/14 nights" },
    { name: "jupyter-dev-04", svc: "EC2", type: "m6i.2xlarge", spend: 324, idle: "14/14 nights" },
  ],
  remainingCount: 137,
  remainingSpend: 6296,
  whatHappens: [
    "Stops EC2 / EKS / Redshift instances at 8pm local time when CPU has been <2% for 4+ hours.",
    "Resumes on next PR push to the resource's repository or at 6am local — whichever comes first.",
    "Reversible: any user can manually resume from the dashboard. Volumes and data are preserved.",
  ],
  exclusions: "6 resources tagged production-adjacent by Tag Governance are excluded from this rule.",
  manualRemediation: {
    note: "Prefer Send to Autopilot for nightly enforcement. To apply once manually:",
    cmd: "$ numio actions hibernate \\\n    --filter \"env IN (dev,sandbox) AND cpu < 2% for 4h\" \\\n    --exclude \"tag:criticality = production-adjacent\" \\\n    --dry-run",
  },
  risk: { level: "low", text: "No production traffic on affected fleet. Worst case: cold-start delay on resume (≈45s for EC2, ≈2min for EKS)." },
  rule: [
    { kw: "WHEN", expr: "env IN (dev, sandbox)" },
    { kw: "", expr: "AND CPU < 2% for 4h" },
    { kw: "", expr: "AND time > 8pm local" },
    { kw: "DO", expr: "stop_instance" },
    { kw: "THEN", expr: "resume_on PR_push OR time = 6am" },
    { kw: "EXCEPT", expr: "tag:criticality = production-adjacent" },
  ],
  safety: [
    "Reversible by any user within 7 days; resource state restored exactly.",
    "Stops are idempotent — no-op for already-stopped resources.",
    "First 3 runs flagged for manual review; emails owner before action.",
    "Hard cap: 200 resources stopped per run, halts on >5% failure rate.",
  ],
};

export const REC_LIST = [
  REC_HIBERNATE,
  { id: "r-198", title: "Block merge: PR #4821 projects +23% us-east-1 cost", scope: "github://payments/service-ledger", category: "PR cost regression", saving: 4310, effort: "Low", confidence: "High", autopilot: true, source: "ai", affectedCount: 1, signals: ["Projected cost increase from PR diff exceeds 20% threshold."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Block the merge until cost review completes."], exclusions: "None.", risk: { level: "med", text: "Affects deploy velocity by ≈30 minutes per blocked PR." } },
  { id: "r-195", title: "Switch Doc Summarizer to GPT-3.5 Turbo batch", scope: "openai://doc-summarizer", category: "Model switch", saving: 620, effort: "Low", confidence: "High", autopilot: false, source: "ai", affectedCount: 1, signals: ["Standard-mode API used for non-interactive batch workload."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Rewrite endpoint call to use batch mode; 50% lower per-token cost."], exclusions: "None.", risk: { level: "low", text: "Batch responses arrive within 24h; current SLA is 48h." } },
  { id: "r-192", title: "Reclaim 38 unattached EBS volumes (avg age 41d)", scope: "aws://prod/storage", category: "Orphan reclaim", saving: 612, effort: "Low", confidence: "Medium", autopilot: true, source: "rule", affectedCount: 38, signals: ["38 EBS volumes with no attachment for ≥30 days."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Snapshot then delete unattached volumes older than 30 days."], exclusions: "Volumes tagged backup:true are excluded.", risk: { level: "low", text: "Snapshots retained 90 days for rollback." }, manualRemediation: { note: "Or run manually:", cmd: "$ numio actions reclaim-ebs --age 30d --dry-run" } },
  { id: "r-189", title: "Consolidate ML Training jobs to off-peak", scope: "aws://ml/training", category: "Scheduling", saving: 480, effort: "Medium", confidence: "Medium", autopilot: false, source: "ai", affectedCount: 6, signals: ["6 training jobs running peak-hour 9am–6pm."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Reschedule to off-peak (10pm–6am); 30% lower per-hour."], exclusions: "Jobs flagged time-sensitive are excluded.", risk: { level: "med", text: "Training results delayed by up to 8 hours." } },
  { id: "r-184", title: "Negotiate volume discount with OpenAI", scope: "openai://*", category: "Procurement", saving: 678, effort: "Medium", confidence: "Low", autopilot: false, source: "ai", affectedCount: null, signals: ["$6,780 MTD spend qualifies for 10–15% volume pricing."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Contact OpenAI sales for volume contract."], exclusions: "None.", risk: { level: "low", text: "Contract negotiation timeline 2-4 weeks." } },
  { id: "r-180", title: "Move logs archive to S3 Glacier Instant Retrieval", scope: "aws://prod/logs", category: "Storage tier", saving: 240, effort: "Medium", confidence: "High", autopilot: false, source: "rule", affectedCount: 12, signals: ["12 buckets storing logs > 30 days old with rare access."], sample: [], remainingCount: 0, remainingSpend: 0, whatHappens: ["Move objects > 30 days old to Glacier Instant Retrieval tier."], exclusions: "Buckets tagged hot-access excluded.", risk: { level: "low", text: "Retrieval latency increases from ms to seconds." } },
];

export const REC_CATEGORIES = ["All", "Idle resource", "Orphan reclaim", "Rightsizing", "Model switch", "Storage tier", "Scheduling", "Procurement", "PR cost regression"];

export const REC_SAVED_VIEWS = [
  { id: "all", label: "All recommendations", owner: "shared", note: "Everything ranked by impact", filterCategories: null },
  { id: "zombie", label: "Zombie Hunter", owner: "shared", note: "Idle & orphaned resources costing you money", filterCategories: ["Idle resource", "Orphan reclaim"] },
  { id: "ai-ready", label: "Autopilot-ready", owner: "shared", note: "Low-effort, high-confidence, automatable", filterCategories: null, autopilotOnly: true },
  { id: "high-impact", label: "$1k/mo and up", owner: "you", filterCategories: null, minSaving: 1000 },
  { id: "this-week", label: "Generated this week", owner: "shared", filterCategories: null },
  { id: "my-team", label: "My team", owner: "you", filterCategories: null },
];

export function applyView(view, items) {
  if (!view) return items;
  let out = items;
  if (view.filterCategories) out = out.filter((r) => view.filterCategories.includes(r.category));
  if (view.autopilotOnly) out = out.filter((r) => r.autopilot && r.effort === "Low" && r.confidence === "High");
  if (view.minSaving) out = out.filter((r) => r.saving >= view.minSaving);
  return out;
}
