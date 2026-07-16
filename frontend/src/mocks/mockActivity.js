/**
 * Mock Activity Data
 *
 * Recent activity feed showing automated actions, tickets, and notifications.
 * Used in: Overview (Recent Activity), Audit Log
 */

export const recentActivity = [
  {
    id: 'activity-001',
    type: 'ticket',
    icon: 'ticket',
    time: '2 hours ago',
    timestamp: '2026-01-19T08:00:00Z',
    title: 'Opened JIRA-1234: "Prod costs spike"',
    details: 'Assigned to: @devops-lead',
    link: { label: 'View Ticket', url: '#' }
  },
  {
    id: 'activity-002',
    type: 'alert',
    icon: 'warning',
    time: '5 hours ago',
    timestamp: '2026-01-19T05:00:00Z',
    title: 'Alerted @ml-team about idle GPUs via Slack',
    link: { label: 'View Thread', url: '#' }
  },
  {
    id: 'activity-003',
    type: 'action',
    icon: 'check',
    time: 'Yesterday',
    timestamp: '2026-01-18T18:00:00Z',
    title: 'Auto-stopped 3 non-prod instances outside business hours',
    details: 'Saved: $24.00',
    link: { label: 'View Details', url: '#' }
  },
  {
    id: 'activity-004',
    type: 'action',
    icon: 'check',
    time: 'Yesterday',
    timestamp: '2026-01-18T14:00:00Z',
    title: 'Enabled S3 Intelligent-Tiering on 8 buckets',
    details: 'Projected savings: $31/mo',
    link: { label: 'View Details', url: '#' }
  },
  {
    id: 'activity-005',
    type: 'recommendation',
    icon: 'lightbulb',
    time: '2 days ago',
    timestamp: '2026-01-17T10:00:00Z',
    title: 'Generated 5 new cost optimization recommendations',
    details: 'Potential savings: $1,247/mo',
    link: { label: 'View Recommendations', url: '/optimize/recommendations' }
  },
  {
    id: 'activity-006',
    type: 'policy',
    icon: 'shield',
    time: '2 days ago',
    timestamp: '2026-01-17T09:00:00Z',
    title: 'Policy violation detected: 2 unapproved GPU instances',
    details: 'Owner notified: @ml-team',
    link: { label: 'View Violation', url: '/govern/policies' }
  },
  {
    id: 'activity-007',
    type: 'budget',
    icon: 'dollar',
    time: '3 days ago',
    timestamp: '2026-01-16T12:00:00Z',
    title: 'Budget alert: ML Team at 80% of monthly budget',
    details: 'Alert sent to: @ml-lead, @finops-lead',
    link: { label: 'View Budget', url: '/govern/budgets' }
  }
];

export const actionHistory = [
  {
    id: 'action-001',
    type: 'auto',
    action: 'Stop instances',
    target: '3 non-prod EC2 instances',
    timestamp: '2026-01-18T18:00:00Z',
    status: 'completed',
    savings: 24,
    rollbackAvailable: true,
    approvedBy: 'Autopilot (policy: idle-instance-stop)',
    details: {
      instances: ['i-dev-001', 'i-dev-002', 'i-staging-003'],
      reason: 'Idle >72 hours',
      snapshotsCreated: true
    }
  },
  {
    id: 'action-002',
    type: 'auto',
    action: 'Enable S3 Intelligent-Tiering',
    target: '8 S3 buckets',
    timestamp: '2026-01-18T14:00:00Z',
    status: 'completed',
    savings: 31,
    rollbackAvailable: false,
    approvedBy: 'Autopilot (policy: s3-optimization)',
    details: {
      buckets: ['bucket-1', 'bucket-2', 'bucket-3', '...'],
      reason: 'Mixed access patterns detected'
    }
  },
  {
    id: 'action-003',
    type: 'manual',
    action: 'Right-size RDS instance',
    target: 'rds-analytics-prod',
    timestamp: '2026-01-15T10:00:00Z',
    status: 'completed',
    savings: 140,
    rollbackAvailable: true,
    approvedBy: '@emma (Engineering Manager)',
    details: {
      from: 'db.r5.xlarge',
      to: 'db.r5.large',
      reason: 'Utilization consistently <30%'
    }
  },
  {
    id: 'action-004',
    type: 'blocked',
    action: 'Resize prod RDS instance',
    target: 'rds-main-prod',
    timestamp: '2026-01-18T16:30:00Z',
    status: 'blocked',
    reason: 'Production resource requires approval',
    approvalRequest: 'APR-123'
  }
];

export const auditLog = [
  {
    id: 'audit-001',
    timestamp: '2026-01-19T10:00:00Z',
    actor: 'Numio Autopilot',
    action: 'EXECUTE',
    resource: 'i-dev-001, i-dev-002, i-staging-003',
    result: 'SUCCESS',
    details: 'Stopped 3 idle instances per policy idle-instance-stop'
  },
  {
    id: 'audit-002',
    timestamp: '2026-01-19T08:00:00Z',
    actor: 'Numio',
    action: 'CREATE_TICKET',
    resource: 'JIRA-1234',
    result: 'SUCCESS',
    details: 'Created ticket for prod cost spike anomaly'
  },
  {
    id: 'audit-003',
    timestamp: '2026-01-18T16:30:00Z',
    actor: 'Numio Autopilot',
    action: 'BLOCKED',
    resource: 'rds-main-prod',
    result: 'BLOCKED',
    details: 'Resize blocked: production resource requires approval'
  }
];

export const getActivityByType = (type) => recentActivity.filter(a => a.type === type);

export const getActionHistoryByStatus = (status) => actionHistory.filter(a => a.status === status);
