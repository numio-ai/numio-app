import { overviewSummary } from './mockOverview';

/**
 * Mock Autopilot Data
 *
 * Autopilot configuration, automation rules, and safety controls.
 * Aligned with Overview: period and lastUpdated from overviewSummary.
 */

export const autopilotStatus = {
  enabled: true,
  lastReviewed: '2 days ago',
  reviewedBy: '@fiona',
  activity: {
    period: overviewSummary.period,
    actionsExecuted: 47,
    savings: 1247,
    incidents: 0,
    actionsBlocked: 2
  }
};

export const actionTiers = [
  {
    tier: 1,
    name: 'INFORM',
    description: 'Detect + Explain + Notify',
    status: 'always-on',
    capabilities: [
      'Monitor all costs continuously',
      'Detect anomalies and patterns',
      'Generate explanations',
      'Send alerts'
    ],
    appliesTo: 'All environments',
    approvalRequired: false
  },
  {
    tier: 2,
    name: 'RECOMMEND',
    description: 'Propose remediation plans',
    status: 'always-on',
    capabilities: [
      'Analyze resource utilization',
      'Generate recommendations',
      'Rank by impact and risk',
      'Present to users'
    ],
    appliesTo: 'All environments',
    approvalRequired: false
  },
  {
    tier: 3,
    name: 'EXECUTE (Guarded)',
    description: 'Low-risk actions only, when explicitly enabled',
    status: 'partial',
    capabilities: [
      'Execute pre-approved low-risk actions',
      'Non-prod environments only (default)',
      'Cost impact <$500/month threshold',
      'Rollback capability required',
      'Complete audit trail'
    ],
    appliesTo: 'dev, staging (Paused for: GPU)',
    approvalRequired: false
  },
  {
    tier: 4,
    name: 'ESCALATE',
    description: 'Require approval for high-impact changes',
    status: 'always-on',
    capabilities: [
      'Requires 2+ approvers',
      'Cost impact >$1,500/month',
      'Production environment changes',
      'Difficult to reverse',
      '24-hour approval window'
    ],
    approvers: ['devops-team (min 2)', 'finops-lead'],
    approvalRequired: true
  }
];

export const autonomousRules = [
  {
    id: 'rule-001',
    name: 'Stop non-prod EC2 instances after 3 days idle',
    enabled: true,
    environments: ['dev', 'staging'],
    maxImpact: 100,
    warningBefore: '48h',
    safety: 'Create snapshot before stopping',
    schedule: 'Daily at 9:00 PM',
    rollback: 'Restart instance within 10 min',
    nextRun: 'Tonight, 9:00 PM'
  },
  {
    id: 'rule-002',
    name: 'Suspend dev GPU instances outside business hours (9am-6pm PST)',
    enabled: true,
    environments: ['dev'],
    excludedResources: ['gpu-always-on-*'],
    autoResume: '9am PST next business day',
    schedule: 'Weekdays 6:05 PM',
    rollback: 'Auto-resume on next workday',
    nextRun: 'Today, 6:05 PM'
  },
  {
    id: 'rule-003',
    name: 'Delete EBS snapshots older than 90 days',
    enabled: true,
    environments: ['all'],
    keep: 'Last 10 snapshots per volume (always)',
    excluded: 'Snapshots tagged "retain=true"',
    schedule: 'Sundays at 1:00 AM',
    rollback: 'Restore from retained snapshot',
    nextRun: 'Sunday, 1:00 AM'
  },
  {
    id: 'rule-004',
    name: 'Enable S3 Intelligent-Tiering on eligible buckets',
    enabled: true,
    eligible: 'Buckets >100GB with mixed access patterns',
    excluded: 'Buckets tagged "lifecycle_managed=true"',
    schedule: 'Weekly on Monday',
    rollback: 'Disable Intelligent-Tiering',
    nextRun: 'Monday, 10:00 AM'
  }
];

export const approvalRules = [
  {
    id: 'approval-001',
    name: 'Any production environment resource changes',
    approvers: ['devops-team'],
    minApprovers: 2,
    timeout: '24 hours (then auto-cancel)'
  },
  {
    id: 'approval-002',
    name: 'Actions with cost impact >$500/month',
    approvers: ['finops-lead'],
    requires: 'Cost-benefit analysis attached'
  },
  {
    id: 'approval-003',
    name: 'GPU or RDS instance type changes',
    approvers: ['engineering-manager'],
    requires: 'Performance impact analysis'
  }
];

export const neverExecuteRules = [
  {
    id: 'never-001',
    name: 'Database deletions (RDS, DynamoDB, etc.)',
    reason: 'Too risky, requires manual confirmation'
  },
  {
    id: 'never-002',
    name: 'Production instance termination',
    reason: 'Potential for service disruption'
  },
  {
    id: 'never-003',
    name: 'Security group or IAM policy modifications',
    reason: 'Security impact, requires security team review'
  }
];

export const safetyControls = {
  maxActionsPerHour: 10,
  maxActionsPerDay: 100,
  maxCostImpactPerAction: 500,
  maxTotalCostImpactPerDay: 5000,
  maintenanceWindowsOnly: false,
  maintenanceWindow: 'Saturday 2:00 AM - 6:00 AM PST',
  circuitBreaker: {
    enabled: true,
    triggers: [
      '>3 failed actions in 1 hour',
      'Any action causes service outage',
      'User triggers Andon Cord'
    ]
  }
};

export const recentSafetyEvents = [
  {
    id: 'safety-001',
    time: '2026-01-18T16:30:00Z',
    type: 'blocked',
    action: 'Attempted to resize prod RDS instance',
    reason: 'Production resource requires approval',
    result: 'Created approval request: APR-123'
  },
  {
    id: 'safety-002',
    time: '2026-01-15T09:00:00Z',
    type: 'blocked',
    action: 'Attempted to stop instance i-prod-critical',
    reason: 'Resource tagged "critical=true"',
    result: 'Action canceled, user notified'
  }
];

export const andonCord = {
  status: 'ready', // ready, paused
  description: 'Use this if you suspect automation is causing issues. This will immediately stop all pending and future automated actions.',
  warning: 'This should only be used in emergencies.'
};
