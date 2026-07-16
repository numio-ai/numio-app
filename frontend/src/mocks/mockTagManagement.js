/**
 * Mock Tag Management Data
 *
 * Realistic tag key definitions, cloud resources with tag assignments,
 * and inconsistency data for the Tag Governance page.
 *
 * v2 additions for the heatmap redesign:
 *   - `source` field on tag keys ("numio" | "aws-org")
 *   - AWS_ORG_POLICY constant + conflict detection helper
 *   - suggestPeerValue() for AI-style peer inference
 *   - tag value drift normalization rules
 */

export const RESOURCE_TYPES = [
  'EC2 Instance',
  'GPU Instance',
  'RDS Instance',
  'S3 Bucket',
  'Lambda Function',
  'K8s Namespace',
];

let _nextTagKeyId = 9;
export function nextTagKeyId() {
  return `tk-${_nextTagKeyId++}`;
}

/**
 * Tag key definitions.
 *
 * `source` indicates provenance:
 *   - "numio"   — defined inside Numio (editable here)
 *   - "aws-org" — inherited from an AWS Organizations tag policy (read-only in Numio,
 *                 changes happen upstream in AWS)
 */
export const initialTagKeys = [
  {
    id: 'tk-1', key: 'env', description: 'Deployment environment',
    required: true, source: 'numio',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: ['production', 'staging', 'dev'],
  },
  {
    id: 'tk-2', key: 'team', description: 'Owning team or business unit',
    required: true, source: 'numio',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: ['engineering', 'ml-platform', 'data-analytics', 'devops', 'qa'],
  },
  {
    id: 'tk-3', key: 'cost-center', description: 'Budget code for cost allocation',
    required: true, source: 'aws-org',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: ['CC-ENG', 'CC-ML', 'CC-DATA', 'CC-OPS'],
    validation: { pattern: '^CC-[A-Z]+$' },
  },
  {
    id: 'tk-4', key: 'owner', description: 'Individual owner (email)',
    required: true, source: 'numio',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: [
      'jchen@acme.com', 'mwong@acme.com', 'dkim@acme.com',
      'szhang@acme.com', 'agarcia@acme.com', 'ktaylor@acme.com', 'rlee@acme.com',
    ],
  },
  {
    id: 'tk-5', key: 'project', description: 'Project or initiative name',
    required: false, source: 'numio',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: ['web-platform', 'data-pipeline', 'llm-training', 'inference-api', 'feature-store'],
  },
  {
    id: 'tk-6', key: 'service', description: 'Application or micro-service',
    required: false, source: 'numio',
    applicableTypes: ['EC2 Instance', 'GPU Instance', 'RDS Instance', 'Lambda Function', 'K8s Namespace'],
    allowedValues: [
      'api-gateway', 'auth-svc', 'batch-processor', 'analytics-warehouse',
      'training-cluster', 'model-serving', 'etl', 'monitoring', 'ci-cd',
      'notifications', 'media-processor', 'user-db', 'feature-db', 'web-cluster',
    ],
  },
  {
    id: 'tk-7', key: 'ai-model', description: 'AI/ML model identifier',
    required: false, source: 'numio',
    applicableTypes: ['GPU Instance'],
    allowedValues: ['gpt-4-finetune', 'claude-3'],
  },
  {
    id: 'tk-8', key: 'compliance', description: 'Regulatory classification (SOC2, PII, …)',
    required: false, source: 'aws-org',
    applicableTypes: [...RESOURCE_TYPES],
    allowedValues: ['soc2', 'pii', 'none'],
  },
];

/**
 * AWS Organizations tag policy — what AWS says about each key it owns.
 * Used to detect schema conflicts (numio schema diverges from AWS).
 */
export const AWS_ORG_POLICY = {
  arn: 'arn:aws:organizations::tagPolicy/acme-prod-required',
  syncedAt: '2026-05-12T13:14:00Z',
  rules: {
    'cost-center': {
      required: true,
      allowedValues: ['CC-ENG', 'CC-ML', 'CC-DATA', 'CC-OPS', 'CC-FIN', 'CC-HR'],
    },
    'compliance': {
      required: false,
      allowedValues: ['soc2', 'pii', 'none'],
    },
  },
};

// -- Resources, by type --

const ec2 = [
  { id: 'r-001', name: 'web-api-prod-1', type: 'EC2 Instance', spend: 4820, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform', service: 'api-gateway' } },
  { id: 'r-002', name: 'web-api-prod-2', type: 'EC2 Instance', spend: 4710, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'api-gateway' } },
  { id: 'r-003', name: 'auth-service-prod', type: 'EC2 Instance', spend: 3120, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'auth-svc' } },
  { id: 'r-004', name: 'batch-worker-01', type: 'EC2 Instance', spend: 1840, tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline', service: 'batch-processor' } },
  { id: 'r-005', name: 'staging-api-01', type: 'EC2 Instance', spend: 920, tags: { env: 'staging', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'api-gateway' } },
  { id: 'r-006', name: 'staging-api-02', type: 'EC2 Instance', spend: 880, tags: { env: 'staging', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com' } },
  { id: 'r-007', name: 'dev-worker-01', type: 'EC2 Instance', spend: 210, tags: { env: 'dev', team: 'engineering', owner: 'rlee@acme.com' } },
  { id: 'r-008', name: 'dev-worker-02', type: 'EC2 Instance', spend: 195, tags: { env: 'dev', owner: 'rlee@acme.com' } },
  { id: 'r-009', name: 'monitoring-prod', type: 'EC2 Instance', spend: 240, tags: { env: 'production', team: 'devops', 'cost-center': 'CC-OPS', owner: 'ktaylor@acme.com', service: 'monitoring' } },
  { id: 'r-010', name: 'ci-runner-01', type: 'EC2 Instance', spend: 180, tags: { env: 'dev', team: 'devops', 'cost-center': 'CC-OPS', owner: 'ktaylor@acme.com', service: 'ci-cd' } },
  { id: 'r-011', name: 'bastion-host', type: 'EC2 Instance', spend: 142, tags: { env: 'prod', team: 'devops', owner: 'ktaylor@acme.com' } },
  { id: 'r-012', name: 'load-test-01', type: 'EC2 Instance', spend: 88, tags: { team: 'qa' } },
];

const gpu = [
  { id: 'r-013', name: 'ml-training-gpu-01', type: 'GPU Instance', spend: 8420, tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'dkim@acme.com', project: 'llm-training', service: 'training-cluster', 'ai-model': 'gpt-4-finetune' } },
  { id: 'r-014', name: 'ml-training-gpu-02', type: 'GPU Instance', spend: 7980, tags: { env: 'production', team: 'ml', owner: 'dkim@acme.com', 'ai-model': 'gpt-4-finetune' } },
  { id: 'r-015', name: 'ml-inference-prod-01', type: 'GPU Instance', spend: 4210, tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'szhang@acme.com', project: 'inference-api', service: 'model-serving', 'ai-model': 'claude-3' } },
];

const rds = [
  { id: 'r-019', name: 'user-db-primary', type: 'RDS Instance', spend: 2840, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'user-db' } },
  { id: 'r-020', name: 'analytics-db', type: 'RDS Instance', spend: 1920, tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline', service: 'analytics-warehouse' } },
  { id: 'r-022', name: 'staging-db-01', type: 'RDS Instance', spend: 740, tags: { env: 'staging', team: 'engineering', owner: 'jchen@acme.com' } },
  { id: 'r-023', name: 'dev-db-01', type: 'RDS Instance', spend: 180, tags: { env: 'dev', team: 'engineering', owner: 'rlee@acme.com' } },
];

const s3 = [
  { id: 'r-024', name: 'app-assets-prod', type: 'S3 Bucket', spend: 410, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform' } },
  { id: 'r-029', name: 'staging-uploads', type: 'S3 Bucket', spend: 64, tags: { env: 'staging', team: 'engineering' } },
  { id: 'r-030', name: 'dev-scratch-01', type: 'S3 Bucket', spend: 12, tags: { team: 'engineering' } },
  { id: 'r-031', name: 'temp-exports', type: 'S3 Bucket', spend: 28, tags: {} },
];

const lambda = [
  { id: 'r-032', name: 'api-authorizer', type: 'Lambda Function', spend: 320, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'auth-svc' } },
  { id: 'r-033', name: 'image-resize', type: 'Lambda Function', spend: 180, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'media-processor' } },
  { id: 'r-037', name: 'dev-webhook-test', type: 'Lambda Function', spend: 6, tags: { env: 'dev', team: 'engineering' } },
];

const k8s = [
  { id: 'r-038', name: 'ns-web-prod', type: 'K8s Namespace', spend: 1840, tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform', service: 'web-cluster' } },
  { id: 'r-041', name: 'ns-staging', type: 'K8s Namespace', spend: 420, tags: { env: 'staging', team: 'engineering' } },
  { id: 'r-042', name: 'ns-dev-sandbox', type: 'K8s Namespace', spend: 90, tags: { env: 'dev' } },
];

export const initialResources = [...ec2, ...gpu, ...rds, ...s3, ...lambda, ...k8s];

// -- Drift / inconsistency rules --

export const INCONSISTENCY_RULES = [
  { tagKey: 'env', valueA: 'prod', valueB: 'production', canonical: 'production' },
  { tagKey: 'team', valueA: 'ml', valueB: 'ml-platform', canonical: 'ml-platform' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getApplicableResources(tagKeyDef, resources) {
  return resources.filter(r => tagKeyDef.applicableTypes.includes(r.type));
}

export function computeTagKeyCoverage(tagKeyDef, resources) {
  const applicable = getApplicableResources(tagKeyDef, resources);
  if (applicable.length === 0) return { total: 0, covered: 0, pct: 100 };
  const covered = applicable.filter(r => r.tags[tagKeyDef.key] !== undefined).length;
  return { total: applicable.length, covered, pct: Math.round((covered / applicable.length) * 100) };
}

export function computeOverallCoverage(tagKeys, resources) {
  const requiredKeys = tagKeys.filter(k => k.required);
  let totalSlots = 0;
  let filledSlots = 0;
  for (const keyDef of requiredKeys) {
    const applicable = getApplicableResources(keyDef, resources);
    totalSlots += applicable.length;
    filledSlots += applicable.filter(r => r.tags[keyDef.key] !== undefined).length;
  }
  return totalSlots === 0 ? 100 : Math.round((filledSlots / totalSlots) * 100);
}

export function countResourcesWithGaps(tagKeys, resources) {
  const requiredKeys = tagKeys.filter(k => k.required);
  return resources.filter(r => {
    return requiredKeys.some(keyDef => {
      if (!keyDef.applicableTypes.includes(r.type)) return false;
      return r.tags[keyDef.key] === undefined;
    });
  }).length;
}

export function getExistingValues(tagKey, resources) {
  const values = new Set();
  for (const r of resources) {
    const v = r.tags[tagKey];
    if (v !== undefined) values.add(v);
  }
  return [...values].sort();
}

export function computeCoverageByType(tagKeyDef, resources) {
  const byType = {};
  for (const type of tagKeyDef.applicableTypes) {
    const ofType = resources.filter(r => r.type === type);
    const covered = ofType.filter(r => r.tags[tagKeyDef.key] !== undefined).length;
    byType[type] = { total: ofType.length, covered, pct: ofType.length === 0 ? 100 : Math.round((covered / ofType.length) * 100) };
  }
  return byType;
}

export function detectInconsistencies(resources) {
  const results = [];
  for (const rule of INCONSISTENCY_RULES) {
    const resA = resources.filter(r => r.tags[rule.tagKey] === rule.valueA);
    const resB = resources.filter(r => r.tags[rule.tagKey] === rule.valueB);
    if (resA.length > 0 && resB.length > 0) {
      results.push({
        tagKey: rule.tagKey,
        valueA: rule.valueA, valueB: rule.valueB,
        canonical: rule.canonical,
        countA: resA.length, countB: resB.length,
        resourceIdsA: resA.map(r => r.id),
        resourceIdsB: resB.map(r => r.id),
      });
    }
  }
  return results;
}

/**
 * Classify a single (resource, tagKey) cell into one of:
 *   "ok" | "drift" | "missing-req" | "missing-opt" | "na"
 * + return the value (if any) and whether it's a drift value.
 */
export function classifyCell(resource, tagKeyDef) {
  const v = resource.tags[tagKeyDef.key];
  if (!tagKeyDef.applicableTypes.includes(resource.type)) return { state: 'na', value: v };
  if (v === undefined || v === null) {
    return { state: tagKeyDef.required ? 'missing-req' : 'missing-opt', value: undefined };
  }
  const driftRule = INCONSISTENCY_RULES.find(r => r.tagKey === tagKeyDef.key && (r.valueA === v || r.valueB === v) && v !== r.canonical);
  if (driftRule) return { state: 'drift', value: v, canonical: driftRule.canonical };
  return { state: 'ok', value: v };
}

/**
 * Compute the per-resource "issue score" — number of required gaps + drift cells.
 * Used to sort the heatmap (worst-first).
 */
export function scoreResource(resource, tagKeys) {
  let gaps = 0, drifts = 0;
  for (const k of tagKeys) {
    const c = classifyCell(resource, k);
    if (c.state === 'missing-req') gaps++;
    if (c.state === 'drift') drifts++;
  }
  return { gaps, drifts };
}

/**
 * Stub for peer-based AI value inference. Returns the most common value for the
 * given tag key among "peer" resources (same team + same env + same project),
 * with a fake confidence score.
 *
 * Backend should replace this with a real model call. The frontend just needs
 * a { value, confidence, source } triple.
 */
export function suggestPeerValue(resource, tagKey, resources, tagKeys) {
  const keyDef = tagKeys.find(k => k.key === tagKey);
  if (!keyDef || !keyDef.applicableTypes.includes(resource.type)) return null;

  // Match peers on team + env (looser fallback if no match)
  const team = resource.tags.team;
  const env = resource.tags.env;
  const peers = resources.filter(r =>
    r.id !== resource.id &&
    r.type === resource.type &&
    r.tags[tagKey] != null &&
    (team ? r.tags.team === team : true) &&
    (env ? r.tags.env === env : true)
  );
  if (peers.length === 0) return null;

  const counts = {};
  for (const p of peers) counts[p.tags[tagKey]] = (counts[p.tags[tagKey]] || 0) + 1;
  const [topValue, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return {
    value: topValue,
    confidence: Math.min(1, topCount / peers.length),
    peerCount: peers.length,
    source: 'peer-inference',
  };
}

/**
 * Detect schema conflicts between Numio tag keys and the AWS Org policy.
 * Returns one entry per conflicted key.
 */
export function detectSchemaConflicts(tagKeys, awsOrgPolicy = AWS_ORG_POLICY) {
  const conflicts = [];
  for (const [key, awsRule] of Object.entries(awsOrgPolicy.rules)) {
    const numioKey = tagKeys.find(k => k.key === key);
    if (!numioKey) {
      conflicts.push({ key, kind: 'missing-in-numio', awsRule });
      continue;
    }
    const numioVals = new Set(numioKey.allowedValues || []);
    const awsVals = new Set(awsRule.allowedValues || []);
    const onlyInAws = [...awsVals].filter(v => !numioVals.has(v));
    const onlyInNumio = [...numioVals].filter(v => !awsVals.has(v));
    if (onlyInAws.length > 0 || onlyInNumio.length > 0 || numioKey.required !== awsRule.required) {
      conflicts.push({
        key, kind: 'value-mismatch',
        numioRule: { required: numioKey.required, allowedValues: [...numioVals] },
        awsRule,
        onlyInAws, onlyInNumio,
      });
    }
  }
  return conflicts;
}

/**
 * Decide whether a planned change to a resource needs the risky-write modal.
 * Triggers: any prod-tagged resource OR aggregate monthly spend > $1000.
 */
export function isRiskyWrite(affectedResources) {
  if (!affectedResources?.length) return false;
  const hasProd = affectedResources.some(r => r.tags.env === 'production' || r.tags.env === 'prod');
  const totalSpend = affectedResources.reduce((a, r) => a + (r.spend || 0), 0);
  return hasProd || totalSpend > 1000;
}
