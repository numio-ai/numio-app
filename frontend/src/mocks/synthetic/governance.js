/**
 * Synthetic governance & compliance dataset (spec §5.2, task synthetic_data_governance).
 *
 * Shape authority: backend schemas behind frontend/src/api/tagGovernance.js and
 * the governance functions in dashboard.js. Decimal fields serialize as strings;
 * the two exceptions that are real JSON floats are CloudResourceResponse.cost and
 * AffectedResource.monthly_cost.
 *
 * Cross-domain integrity (AC3): a single canonical resource inventory is built
 * here from the core accounts/services/regions. Findings, recommendations,
 * policy violations, and non-compliant results all reference inventory IDs, so
 * a resource flagged on one screen is the same resource everywhere. Core (spec
 * §5.1) defines accounts/services/regions/window but not resources, so the
 * inventory is owned here and sourced entirely from canonical entities.
 */
import { ACCOUNTS, SERVICES, REGIONS } from "./entities";
import { CORE_SEED, makeRng, rngFloat, rngInt, rngPick, round2 } from "./seed";

const CURRENCY = "USD";
const money = (n) => round2(n).toFixed(2);
const WS = "00000000-0000-0000-0000-000000000000";
const uuidFrom = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const rng = makeRng(CORE_SEED + 2);

// Resource types per canonical service, with a provider-id prefix.
const RESOURCE_KINDS = [
  { serviceKey: "ec2", resource_type: "Instance", idPrefix: "i-" },
  { serviceKey: "ebs", resource_type: "Volume", idPrefix: "vol-" },
  { serviceKey: "rds", resource_type: "DBInstance", idPrefix: "db-" },
  { serviceKey: "s3", resource_type: "Bucket", idPrefix: "bucket-" },
  { serviceKey: "lambda", resource_type: "Function", idPrefix: "fn-" },
  { serviceKey: "eks", resource_type: "Cluster", idPrefix: "eks-" },
  { serviceKey: "dynamodb", resource_type: "Table", idPrefix: "tbl-" },
];

const hex = (len) => {
  let s = "";
  for (let i = 0; i < len; i++) s += "0123456789abcdef"[rngInt(rng, 0, 15)];
  return s;
};

/** Canonical resource inventory — every governance surface references these. */
function buildInventory() {
  const items = [];
  let n = 1;
  // Two resources per kind, spread across accounts/regions.
  RESOURCE_KINDS.forEach((kind) => {
    for (let i = 0; i < 2; i++) {
      const account = rngPick(rng, ACCOUNTS);
      const region = rngPick(rng, REGIONS).code;
      const service = SERVICES.find((s) => s.key === kind.serviceKey);
      const providerId = `${kind.idPrefix}${hex(12)}`;
      items.push({
        id: uuidFrom(n),
        workspace_id: WS,
        account_id: account.id,
        region,
        service: service.name,
        resource_type: kind.resource_type,
        resource_id: providerId,
        arn: `arn:aws:${kind.serviceKey}:${region}:${account.id}:${kind.resource_type.toLowerCase()}/${providerId}`,
        name: `${account.alias}-${kind.resource_type.toLowerCase()}-${i + 1}`,
        state: rngPick(rng, ["running", "running", "stopped", "available"]),
        creation_date: "2026-01-15T00:00:00Z",
        tags: { Environment: account.environment, ManagedBy: i % 2 === 0 ? "terraform" : "" },
        resource_metadata: null,
        first_seen_at: "2026-01-15T00:00:00Z",
        last_seen_at: "2026-05-27T00:00:00Z",
        terminated_at: null,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-05-27T00:00:00Z",
        cost: round2(rngFloat(rng, 60, 2200)), // float per backend
      });
      n += 1;
    }
  });
  return items;
}

const INVENTORY = buildInventory();
// Resources missing the required ManagedBy tag are the non-compliant set.
const NON_COMPLIANT = INVENTORY.filter((r) => !r.tags.ManagedBy);

/** GET /api/v1/resources → CloudResourceListResponse */
export function resourcesList() {
  return { resources: INVENTORY, count: INVENTORY.length };
}

// --- findings ---------------------------------------------------------------

const FINDING_TYPES = ["anomaly", "zombie", "idle", "policy_violation", "tag_violation"];
const SEVERITIES = ["critical", "high", "medium", "low", "info"];

function buildFindings() {
  // Eight findings, each tied to an inventory resource (by provider resource_id).
  return INVENTORY.slice(0, 8).map((r, i) => {
    const type = FINDING_TYPES[i % FINDING_TYPES.length];
    const severity = SEVERITIES[i % SEVERITIES.length];
    const status = i % 4 === 0 ? "acknowledged" : "open";
    return {
      id: uuidFrom(100 + i),
      workspace_id: WS,
      type,
      severity,
      status,
      title: `${type.replace("_", " ")} on ${r.name}`,
      description: `${r.service} resource ${r.resource_id} flagged by ${type} detection.`,
      resource_id: r.resource_id,
      detection_source: type === "tag_violation" ? "tag_audit" : "anomaly_detector",
      suggested_action: "Review the resource and remediate or suppress.",
      estimated_cost_impact: money(r.cost * 0.3),
      suppression_reason: null,
      detected_at: "2026-05-20T08:00:00Z",
      last_seen_at: "2026-05-27T08:00:00Z",
      acknowledged_at: status === "acknowledged" ? "2026-05-21T09:00:00Z" : null,
      resolved_at: null,
      created_at: "2026-05-20T08:00:00Z",
      updated_at: "2026-05-27T08:00:00Z",
    };
  });
}

const FINDINGS = buildFindings();

/** GET /api/v1/findings → FindingListResponse */
export function findingsList({ type, severity, status } = {}) {
  let list = FINDINGS;
  if (type) list = list.filter((f) => f.type === type);
  if (severity) list = list.filter((f) => f.severity === severity);
  if (status) list = list.filter((f) => f.status === status);
  return { findings: list, count: list.length };
}

/** GET /api/v1/findings/:id → FindingDetailResponse (with transitions) */
export function findingById(id) {
  const f = FINDINGS.find((x) => x.id === id);
  if (!f) return null;
  const transitions = [
    { id: uuidFrom(200), from_status: "open", to_status: f.status, changed_by: "demo@numio.ai", reason: "Triaged", created_at: "2026-05-21T09:00:00Z" },
  ];
  return { ...f, transitions: f.status === "open" ? [] : transitions };
}

// --- recommendations + savings ---------------------------------------------

const REC_CATEGORIES = ["right_sizing", "zombie_cleanup", "idle_shutdown"];

function buildRecommendations() {
  // Six recommendations; monthly saving never exceeds the resource monthly cost.
  return INVENTORY.slice(0, 6).map((r, i) => {
    const category = REC_CATEGORIES[i % REC_CATEGORIES.length];
    const status = i % 3 === 0 ? "implemented" : i % 3 === 1 ? "accepted" : "open";
    const saving = round2(r.cost * rngFloat(rng, 0.2, 0.6)); // < resource cost
    return {
      id: uuidFrom(300 + i),
      workspace_id: WS,
      finding_id: FINDINGS[i] ? FINDINGS[i].id : null,
      category,
      status,
      confidence: rngPick(rng, ["high", "medium", "low"]),
      title: `${category.replace("_", " ")} for ${r.name}`,
      description: `Estimated monthly saving on ${r.resource_id}.`,
      resource_id: r.resource_id,
      remediation_commands: null,
      estimated_monthly_savings: money(saving),
      actual_savings: status === "implemented" ? money(saving) : null,
      savings_data_label: "monthly",
      accepted_at: status !== "open" ? "2026-05-22T00:00:00Z" : null,
      implemented_at: status === "implemented" ? "2026-05-24T00:00:00Z" : null,
      dismissed_at: null,
      created_at: "2026-05-20T00:00:00Z",
      updated_at: "2026-05-27T00:00:00Z",
      _saving: saving, // internal for reconciliation
    };
  });
}

const RECOMMENDATIONS = buildRecommendations();
const recPublic = (r) => {
  const { _saving, ...pub } = r;
  return pub;
};

/** GET /api/v1/recommendations → RecommendationListResponse */
export function recommendationsList({ category, status } = {}) {
  let list = RECOMMENDATIONS;
  if (category) list = list.filter((r) => r.category === category);
  if (status) list = list.filter((r) => r.status === status);
  return { recommendations: list.map(recPublic), count: list.length };
}

/** GET /api/v1/recommendations/:id → RecommendationResponse */
export function recommendationById(id) {
  const r = RECOMMENDATIONS.find((x) => x.id === id);
  return r ? recPublic(r) : null;
}

/** GET /api/v1/recommendations/savings/summary → derived from the rec list (reconciles) */
export function savingsSummary() {
  const byCat = new Map();
  let totalEst = 0;
  let totalActual = 0;
  let implemented = 0;
  for (const r of RECOMMENDATIONS) {
    totalEst = round2(totalEst + r._saving);
    if (r.status === "implemented") {
      totalActual = round2(totalActual + r._saving);
      implemented += 1;
    }
    if (!byCat.has(r.category)) byCat.set(r.category, { est: 0, actual: 0, count: 0 });
    const c = byCat.get(r.category);
    c.est = round2(c.est + r._saving);
    if (r.status === "implemented") c.actual = round2(c.actual + r._saving);
    c.count += 1;
  }
  return {
    total_estimated_monthly_savings: money(totalEst),
    total_actual_savings: money(totalActual),
    total_implemented: implemented,
    by_category: [...byCat.entries()].map(([category, c]) => ({
      category,
      estimated_monthly_savings: money(c.est),
      actual_savings: money(c.actual),
      recommendation_count: c.count,
    })),
  };
}

/** GET /api/v1/recommendations/savings/timeline → SavingsTimelineResponse */
export function savingsTimeline() {
  let cumulative = 0;
  const entries = RECOMMENDATIONS.filter((r) => r.status === "implemented").map((r, i) => {
    cumulative = round2(cumulative + r._saving);
    return {
      date: `2026-05-${String(10 + i * 3).padStart(2, "0")}`,
      cumulative_savings: money(cumulative),
      recommendation_id: r.id,
      category: r.category,
      resource_id: r.resource_id,
    };
  });
  return { entries };
}

// --- infrastructure policies ------------------------------------------------

const INFRA_TYPES = ["instance_restriction", "spending_limit", "resource_count_limit", "environment_constraint"];

function buildInfraPolicies() {
  return INFRA_TYPES.map((type, i) => ({
    id: uuidFrom(400 + i),
    workspace_id: WS,
    name: `${type.replace(/_/g, " ")} policy`,
    description: `Guardrail enforcing ${type.replace(/_/g, " ")}.`,
    type,
    severity: ["critical", "high", "medium", "low"][i],
    rule: { kind: type },
    applicability: { accounts: [], services: [], resource_types: [], regions: [] },
    is_guardrail: i < 2,
    is_active: true,
    compliance_percentage: money(70 + i * 7),
    last_evaluated_at: "2026-05-27T06:00:00Z",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-05-27T00:00:00Z",
  }));
}

const INFRA_POLICIES = buildInfraPolicies();

/** GET /api/v1/infra-policies → InfraPolicyListResponse */
export function infraPoliciesList({ type, is_active } = {}) {
  let list = INFRA_POLICIES;
  if (type) list = list.filter((p) => p.type === type);
  if (is_active !== undefined) list = list.filter((p) => p.is_active === is_active);
  return { policies: list, count: list.length };
}

/** GET /api/v1/infra-policies/:id → InfraPolicyDetailResponse (with violations) */
export function infraPolicyById(id) {
  const p = INFRA_POLICIES.find((x) => x.id === id);
  if (!p) return null;
  const violations = NON_COMPLIANT.slice(0, 2).map((r, i) => ({
    finding_id: uuidFrom(500 + i),
    title: `${p.name} violated by ${r.name}`,
    severity: p.severity,
    status: "open",
    resource_id: r.resource_id,
    description: `Resource ${r.resource_id} violates ${p.name}.`,
    detected_at: "2026-05-26T00:00:00Z",
  }));
  return { ...p, violations };
}

// --- tag governance ---------------------------------------------------------

export function tagPoliciesList() {
  const rules = (n) => [
    {
      id: uuidFrom(600 + n),
      tag_name: "Environment",
      value_type: "enum",
      allowed_values: ["production", "staging", "development"],
      equivalence_groups: null,
      default_value: null,
      applicable_resource_types: null,
      applicable_accounts: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  const policies = ["Environment tagging", "Cost-center tagging"].map((name, i) => ({
    id: uuidFrom(610 + i),
    workspace_id: WS,
    name,
    description: `${name} policy.`,
    priority: i + 1,
    is_active: true,
    created_by: "demo@numio.ai",
    updated_by: "demo@numio.ai",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    rules: rules(i),
  }));
  return { policies, count: policies.length };
}

/** GET /api/v1/compliance/summary → ComplianceSummaryResponse */
export function complianceSummary() {
  const totalCost = round2(INVENTORY.reduce((a, r) => a + r.cost, 0));
  const compliantCost = round2(INVENTORY.filter((r) => r.tags.ManagedBy).reduce((a, r) => a + r.cost, 0));
  return {
    overall: {
      dimension: "workspace",
      dimension_value: null,
      cost_weighted_score: money((compliantCost / totalCost) * 100),
      total_cost: money(totalCost),
      compliant_cost: money(compliantCost),
      total_resources: INVENTORY.length,
      compliant_resources: INVENTORY.length - NON_COMPLIANT.length,
    },
    untagged_spend: money(totalCost - compliantCost),
    total_resources: INVENTORY.length,
    compliant_resources: INVENTORY.length - NON_COMPLIANT.length,
    non_compliant_resources: NON_COMPLIANT.length,
  };
}

/** GET /api/v1/compliance/non-compliant → NonCompliantListResponse */
export function nonCompliantList() {
  const results = NON_COMPLIANT.map((r, i) => ({
    id: uuidFrom(700 + i),
    resource_id: r.id, // uuid (compliance results key by the cloud_resources PK)
    policy_id: uuidFrom(610),
    rule_id: uuidFrom(600),
    status: "missing_tag",
    current_value: null,
    resource_cost: money(r.cost),
    resource_arn: r.arn,
    resource_name: r.name,
    resource_type: `${r.service}/${r.resource_type}`,
    account_id: r.account_id,
    service: r.service,
    tag_name: "ManagedBy",
    policy_name: "Cost-center tagging",
  }));
  return {
    results,
    count: results.length,
    total_non_compliant_cost: money(NON_COMPLIANT.reduce((a, r) => a + r.cost, 0)),
  };
}

/** GET /api/v1/compliance/by-dimension → ComplianceByDimensionResponse */
export function complianceByDimension(dimension = "account") {
  const scores = ACCOUNTS.map((a) => {
    const rows = INVENTORY.filter((r) => r.account_id === a.id);
    const total = round2(rows.reduce((s, r) => s + r.cost, 0));
    const compliant = round2(rows.filter((r) => r.tags.ManagedBy).reduce((s, r) => s + r.cost, 0));
    return {
      dimension,
      dimension_value: a.id,
      cost_weighted_score: money(total ? (compliant / total) * 100 : 100),
      total_cost: money(total),
      compliant_cost: money(compliant),
      total_resources: rows.length,
      compliant_resources: rows.filter((r) => r.tags.ManagedBy).length,
    };
  });
  return { dimension, scores };
}

/** GET /api/v1/compliance/trend → ComplianceTrendResponse */
export function complianceTrend() {
  const trend = ["2026-03-01", "2026-04-01", "2026-05-01"].map((d, i) => ({
    snapshot_date: `${d}T00:00:00Z`,
    audit_run_id: uuidFrom(800 + i),
    cost_weighted_score: money(72 + i * 6),
    total_cost: money(INVENTORY.reduce((a, r) => a + r.cost, 0)),
    compliant_cost: money(INVENTORY.reduce((a, r) => a + r.cost, 0) * (0.72 + i * 0.06)),
    total_resources: INVENTORY.length,
    compliant_resources: INVENTORY.length - NON_COMPLIANT.length + i,
  }));
  return { dimension: "workspace", dimension_value: null, trend };
}

/** GET /api/v1/aws-org-tag-policy → AwsOrgTagPolicyListResponse */
export function awsOrgTagPolicyList() {
  const policies = ["Environment", "CostCenter", "Owner"].map((tag, i) => ({
    id: uuidFrom(900 + i),
    tag_key: tag,
    required: i < 2,
    allowed_values: tag === "Environment" ? ["production", "staging", "development"] : null,
    case_sensitive: true,
    source_policy_id: `p-${hex(8)}`,
    source_policy_arn: `arn:aws:organizations::${ACCOUNTS[0].id}:policy/o-demo/tag_policy/p-${hex(8)}`,
    synced_at: "2026-05-26T00:00:00Z",
  }));
  return { policies, count: policies.length };
}

/** GET /api/v1/tags/schema/conflicts → ConflictListResponse */
export function schemaConflictsList() {
  const conflicts = [
    { tag_key: "CostCenter", conflict_type: "required_mismatch", detail: "Required in AWS Org but optional in Numio.", numio_required: false, aws_required: true, numio_allowed_values: null, aws_allowed_values: null },
    { tag_key: "Environment", conflict_type: "allowed_values_diff", detail: "Allowed values differ between Numio and AWS Org.", numio_required: true, aws_required: true, numio_allowed_values: ["production", "staging", "development"], aws_allowed_values: ["prod", "stage", "dev"] },
  ];
  return { conflicts, count: conflicts.length };
}

/** GET /api/v1/campaigns → CampaignListResponse */
export function campaignsList() {
  const campaigns = [
    {
      id: uuidFrom(1000),
      workspace_id: WS,
      name: "Q2 tag remediation",
      description: "Bring untagged resources into compliance.",
      deadline: "2026-06-30T00:00:00Z",
      target_compliance_goal: money(95),
      status: "active",
      before_compliance_score: money(72),
      resource_count: NON_COMPLIANT.length,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-27T00:00:00Z",
    },
  ];
  return { campaigns, count: campaigns.length };
}

/** POST /api/v1/tags/apply/preview → TagApplyPreviewResponse (monthly_cost is a float) */
export function tagApplyPreview() {
  return {
    risky: true,
    reasons: ["Writes tags to live AWS resources."],
    affected_resources: NON_COMPLIANT.slice(0, 3).map((r) => ({
      resource_id: r.id,
      arn: r.arn,
      name: r.name,
      env: r.tags.Environment,
      monthly_cost: r.cost, // float per AffectedResource
    })),
  };
}

// Internal handles for tests / cross-domain reconciliation.
export const __gov = { INVENTORY, NON_COMPLIANT, FINDINGS, RECOMMENDATIONS, INFRA_POLICIES };
