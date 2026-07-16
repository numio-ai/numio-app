/**
 * Mock Tag Management Data
 *
 * Realistic tag key definitions, cloud resources with tag assignments,
 * and inconsistency data for the Controls > Tags page.
 *
 * Coverage targets: ~80% overall, with deliberate gaps per resource type.
 */

export const RESOURCE_TYPES = [
  'EC2 Instance',
  'GPU Instance',
  'RDS Instance',
  'S3 Bucket',
  'Lambda Function',
  'K8s Namespace',
];

let _nextTagKeyId = 8;
export function nextTagKeyId() {
  return `tk-${_nextTagKeyId++}`;
}

export const initialTagKeys = [
  {
    id: 'tk-1', key: 'env', description: 'Deployment environment',
    required: true, applicableTypes: [...RESOURCE_TYPES],
  },
  {
    id: 'tk-2', key: 'team', description: 'Owning team or business unit',
    required: true, applicableTypes: [...RESOURCE_TYPES],
  },
  {
    id: 'tk-3', key: 'cost-center', description: 'Budget code for cost allocation',
    required: true, applicableTypes: [...RESOURCE_TYPES],
  },
  {
    id: 'tk-4', key: 'owner', description: 'Individual owner (email)',
    required: true, applicableTypes: [...RESOURCE_TYPES],
  },
  {
    id: 'tk-5', key: 'project', description: 'Project or initiative name',
    required: false, applicableTypes: [...RESOURCE_TYPES],
  },
  {
    id: 'tk-6', key: 'service', description: 'Application or micro-service',
    required: false,
    applicableTypes: ['EC2 Instance', 'GPU Instance', 'RDS Instance', 'Lambda Function', 'K8s Namespace'],
  },
  {
    id: 'tk-7', key: 'ai-model', description: 'AI/ML model identifier',
    required: false, applicableTypes: ['GPU Instance'],
  },
];

// --- Resources grouped by type ---

const ec2 = [
  { id: 'r-001', name: 'web-api-prod-1', type: 'EC2 Instance', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform', service: 'api-gateway' } },
  { id: 'r-002', name: 'web-api-prod-2', type: 'EC2 Instance', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'api-gateway' } },
  { id: 'r-003', name: 'auth-service-prod', type: 'EC2 Instance', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'auth-svc' } },
  { id: 'r-004', name: 'batch-worker-01', type: 'EC2 Instance', tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline', service: 'batch-processor' } },
  { id: 'r-005', name: 'staging-api-01', type: 'EC2 Instance', tags: { env: 'staging', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'api-gateway' } },
  { id: 'r-006', name: 'staging-api-02', type: 'EC2 Instance', tags: { env: 'staging', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com' } },
  { id: 'r-007', name: 'dev-worker-01', type: 'EC2 Instance', tags: { env: 'dev', team: 'engineering', owner: 'rlee@acme.com' } },
  { id: 'r-008', name: 'dev-worker-02', type: 'EC2 Instance', tags: { env: 'dev', owner: 'rlee@acme.com' } },
  { id: 'r-009', name: 'monitoring-prod', type: 'EC2 Instance', tags: { env: 'production', team: 'devops', 'cost-center': 'CC-OPS', owner: 'ktaylor@acme.com', service: 'monitoring' } },
  { id: 'r-010', name: 'ci-runner-01', type: 'EC2 Instance', tags: { env: 'dev', team: 'devops', 'cost-center': 'CC-OPS', owner: 'ktaylor@acme.com', service: 'ci-cd' } },
  { id: 'r-011', name: 'bastion-host', type: 'EC2 Instance', tags: { env: 'prod', team: 'devops', owner: 'ktaylor@acme.com' } },
  { id: 'r-012', name: 'load-test-01', type: 'EC2 Instance', tags: { team: 'qa' } },
];

const gpu = [
  { id: 'r-013', name: 'ml-training-gpu-01', type: 'GPU Instance', tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'dkim@acme.com', project: 'llm-training', service: 'training-cluster', 'ai-model': 'gpt-4-finetune' } },
  { id: 'r-014', name: 'ml-training-gpu-02', type: 'GPU Instance', tags: { env: 'production', team: 'ml', owner: 'dkim@acme.com', 'ai-model': 'gpt-4-finetune' } },
  { id: 'r-015', name: 'ml-inference-prod-01', type: 'GPU Instance', tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'szhang@acme.com', project: 'inference-api', service: 'model-serving', 'ai-model': 'claude-3' } },
  { id: 'r-016', name: 'ml-inference-prod-02', type: 'GPU Instance', tags: { env: 'prod', team: 'ml', owner: 'szhang@acme.com', 'ai-model': 'claude-3' } },
  { id: 'r-017', name: 'ml-dev-gpu-01', type: 'GPU Instance', tags: { team: 'ml-platform', owner: 'dkim@acme.com' } },
  { id: 'r-018', name: 'ml-experiment-01', type: 'GPU Instance', tags: { env: 'dev', team: 'ml', 'cost-center': 'CC-ML' } },
];

const rds = [
  { id: 'r-019', name: 'user-db-primary', type: 'RDS Instance', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'user-db' } },
  { id: 'r-020', name: 'analytics-db', type: 'RDS Instance', tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline', service: 'analytics-warehouse' } },
  { id: 'r-021', name: 'ml-features-db', type: 'RDS Instance', tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'szhang@acme.com', project: 'feature-store', service: 'feature-db' } },
  { id: 'r-022', name: 'staging-db-01', type: 'RDS Instance', tags: { env: 'staging', team: 'engineering', owner: 'jchen@acme.com' } },
  { id: 'r-023', name: 'dev-db-01', type: 'RDS Instance', tags: { env: 'dev', team: 'engineering', owner: 'rlee@acme.com' } },
];

const s3 = [
  { id: 'r-024', name: 'app-assets-prod', type: 'S3 Bucket', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform' } },
  { id: 'r-025', name: 'data-lake-raw', type: 'S3 Bucket', tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline' } },
  { id: 'r-026', name: 'ml-training-data', type: 'S3 Bucket', tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'dkim@acme.com' } },
  { id: 'r-027', name: 'backup-vault', type: 'S3 Bucket', tags: { env: 'prod', team: 'devops', 'cost-center': 'CC-OPS' } },
  { id: 'r-028', name: 'logs-archive', type: 'S3 Bucket', tags: { env: 'production', team: 'devops', owner: 'ktaylor@acme.com' } },
  { id: 'r-029', name: 'staging-uploads', type: 'S3 Bucket', tags: { env: 'staging', team: 'engineering' } },
  { id: 'r-030', name: 'dev-scratch-01', type: 'S3 Bucket', tags: { team: 'engineering' } },
  { id: 'r-031', name: 'temp-exports', type: 'S3 Bucket', tags: {} },
];

const lambda = [
  { id: 'r-032', name: 'api-authorizer', type: 'Lambda Function', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'mwong@acme.com', project: 'web-platform', service: 'auth-svc' } },
  { id: 'r-033', name: 'image-resize', type: 'Lambda Function', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', service: 'media-processor' } },
  { id: 'r-034', name: 'etl-transform', type: 'Lambda Function', tags: { env: 'production', team: 'data-analytics', 'cost-center': 'CC-DATA', owner: 'agarcia@acme.com', project: 'data-pipeline', service: 'etl' } },
  { id: 'r-035', name: 'slack-notifier', type: 'Lambda Function', tags: { env: 'prod', team: 'devops', 'cost-center': 'CC-OPS', owner: 'ktaylor@acme.com', service: 'notifications' } },
  { id: 'r-036', name: 'cost-anomaly-checker', type: 'Lambda Function', tags: { env: 'production', team: 'devops', owner: 'ktaylor@acme.com', service: 'monitoring' } },
  { id: 'r-037', name: 'dev-webhook-test', type: 'Lambda Function', tags: { env: 'dev', team: 'engineering' } },
];

const k8s = [
  { id: 'r-038', name: 'ns-web-prod', type: 'K8s Namespace', tags: { env: 'production', team: 'engineering', 'cost-center': 'CC-ENG', owner: 'jchen@acme.com', project: 'web-platform', service: 'web-cluster' } },
  { id: 'r-039', name: 'ns-ml-serving', type: 'K8s Namespace', tags: { env: 'production', team: 'ml-platform', 'cost-center': 'CC-ML', owner: 'szhang@acme.com', project: 'inference-api', service: 'model-serving' } },
  { id: 'r-040', name: 'ns-data-jobs', type: 'K8s Namespace', tags: { env: 'production', team: 'data-analytics', owner: 'agarcia@acme.com', project: 'data-pipeline' } },
  { id: 'r-041', name: 'ns-staging', type: 'K8s Namespace', tags: { env: 'staging', team: 'engineering' } },
  { id: 'r-042', name: 'ns-dev-sandbox', type: 'K8s Namespace', tags: { env: 'dev' } },
];

export const initialResources = [...ec2, ...gpu, ...rds, ...s3, ...lambda, ...k8s];

// --- Inconsistency rules ---

export const INCONSISTENCY_RULES = [
  { tagKey: 'env', valueA: 'prod', valueB: 'production', canonical: 'production' },
  { tagKey: 'team', valueA: 'ml', valueB: 'ml-platform', canonical: 'ml-platform' },
];

// --- Helper functions ---

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
        valueA: rule.valueA,
        valueB: rule.valueB,
        canonical: rule.canonical,
        countA: resA.length,
        countB: resB.length,
        resourceIdsA: resA.map(r => r.id),
        resourceIdsB: resB.map(r => r.id),
      });
    }
  }
  return results;
}
