/**
 * Mock Policies Data
 *
 * Policy definitions, compliance status, and violations.
 * Aligned with Overview. Used in: Overview (Policy Compliance), Govern > Policies page
 */

import { overviewSummary } from './mockOverview';

export const policySummary = {
  totalPolicies: 12,
  compliance: {
    resourcesInCompliance: 847,
    resourcesFlagged: 42,
    percentCompliant: 95
  },
  violations: {
    total: 3,
    critical: 2,
    high: 0,
    medium: 1
  }
};

export const policies = [
  {
    id: 'policy-001',
    name: 'No unapproved GPU instances in production',
    severity: 'critical',
    status: 'active',
    scope: {
      environments: ['prod'],
      resourceTypes: ['EC2']
    },
    rule: {
      description: 'Instance type matches p3.* or p4.* or g4.* AND tag "approved_gpu" != "true"',
      conditions: [
        { field: 'instance_type', operator: 'matches', value: 'p3.*|p4.*|g4.*' },
        { field: 'tag:approved_gpu', operator: 'not_equals', value: 'true' }
      ]
    },
    enforcement: {
      alert: { channels: ['Slack #security'], email: 'security-team' },
      ticket: { system: 'Jira', project: 'SEC' },
      preventCreation: false
    },
    violations: [
      {
        resourceId: 'i-gpu-prod-123',
        resourceType: 'EC2',
        instanceType: 'p3.8xlarge',
        owner: 'ml-team',
        age: '2 days',
        region: 'us-east-1'
      },
      {
        resourceId: 'i-gpu-prod-456',
        resourceType: 'EC2',
        instanceType: 'p4d.24xlarge',
        owner: 'ml-team',
        age: '2 days',
        region: 'us-east-1'
      }
    ],
    actions: ['view-details', 'edit', 'disable', 'delete']
  },
  {
    id: 'policy-002',
    name: 'All resources must have required tags',
    severity: 'medium',
    status: 'active',
    scope: {
      environments: ['all'],
      resourceTypes: ['all']
    },
    rule: {
      description: 'Must have tags: CostCenter, Environment (prod/dev/staging), Owner',
      conditions: [
        { field: 'tag:CostCenter', operator: 'exists', value: true },
        { field: 'tag:Environment', operator: 'in', value: ['prod', 'dev', 'staging'] },
        { field: 'tag:Owner', operator: 'exists', value: true }
      ]
    },
    enforcement: {
      alert: { channels: ['Slack #cloud-governance'] },
      autoRemediate: 'Add tags if values can be inferred',
      escalate: 'Create ticket if not fixed in 7 days'
    },
    violations: [
      { type: 'Missing CostCenter', count: 8, resourceType: 'EC2' },
      { type: 'Missing Environment', count: 4, resourceType: 'EC2' }
    ],
    totalViolations: 12,
    actions: ['view-details', 'auto-tag-all', 'edit', 'disable']
  },
  {
    id: 'policy-003',
    name: 'Non-prod instances auto-stop after 72h idle',
    severity: 'low',
    status: 'active',
    scope: {
      environments: ['dev', 'staging'],
      resourceTypes: ['EC2']
    },
    rule: {
      description: 'EC2 instance idle (CPU <5%) for >72 hours',
      conditions: [
        { field: 'cpu_utilization', operator: 'less_than', value: 5 },
        { field: 'idle_duration', operator: 'greater_than', value: '72h' }
      ]
    },
    enforcement: {
      warnOwner: { at: '48 hours', via: 'email' },
      autoStop: { at: '72 hours', createSnapshot: true },
      auditLog: true
    },
    activity: {
      period: 'last 7 days',
      instancesStopped: 8,
      savings: 192,
      rollbacks: 0
    },
    violations: [],
    actions: ['view-activity', 'edit', 'disable']
  },
  {
    id: 'policy-004',
    name: 'Budget alerts at 80% threshold',
    severity: 'medium',
    status: 'active',
    scope: {
      environments: ['all'],
      resourceTypes: ['budget']
    },
    rule: {
      description: 'Alert when team budget reaches 80% of monthly allocation'
    },
    enforcement: {
      alert: { channels: ['Email', 'Slack'], recipients: ['team-lead', 'finops'] }
    },
    violations: [],
    actions: ['edit', 'disable']
  },
  {
    id: 'policy-005',
    name: 'No public S3 buckets',
    severity: 'critical',
    status: 'active',
    scope: {
      environments: ['all'],
      resourceTypes: ['S3']
    },
    rule: {
      description: 'S3 bucket ACL or policy allows public access'
    },
    enforcement: {
      alert: { channels: ['Slack #security'], email: 'security-team' },
      ticket: { system: 'Jira', project: 'SEC', priority: 'critical' }
    },
    violations: [],
    actions: ['view-details', 'edit', 'disable']
  }
];

export const policyTemplates = [
  { id: 'tpl-001', name: 'Require resource tagging', category: 'governance' },
  { id: 'tpl-002', name: 'Auto-stop idle instances', category: 'cost-optimization' },
  { id: 'tpl-003', name: 'Budget threshold alerts', category: 'cost-optimization' },
  { id: 'tpl-004', name: 'No public cloud resources', category: 'security' },
  { id: 'tpl-005', name: 'Approved instance types only', category: 'governance' }
];

export const lastUpdated = overviewSummary.lastUpdated;

export const getPolicyById = (id) => policies.find(p => p.id === id);

export const getPoliciesBySeverity = (severity) => policies.filter(p => p.severity === severity);

export const getPoliciesWithViolations = () => policies.filter(p => p.violations && p.violations.length > 0);
