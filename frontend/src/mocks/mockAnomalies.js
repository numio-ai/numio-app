/**
 * Mock Anomalies Data
 *
 * Anomaly detection data for cost spikes, unusual patterns, and drift detection.
 * Used in: Overview (Active Issues), Anomaly Investigation View
 */

export const anomalies = [
  {
    id: 'anomaly-001',
    title: 'Prod EC2 Cost Spike',
    severity: 'critical', // critical, warning, info
    status: 'investigating', // new, investigating, resolved, dismissed
    detectedAt: '2026-01-15T15:26:00Z',
    impact: {
      daily: 450,
      monthly: 13500,
      description: '+$450/day (+$13,500/mo if unchanged)'
    },
    summary: 'Prod costs spiked 1,314% yesterday',
    description: '5 new m5.xlarge EC2 instances launched at 3:24 PM',
    rootCause: {
      primary: 'Manual scaling for load testing (based on commit message)',
      factors: [
        'Instances are over-provisioned (avg CPU: 23%, avg memory: 31%)',
        'No auto-scaling group configured',
        'Missing cost alert threshold for this account'
      ],
      historical: 'Similar pattern 3 times in last 6 months'
    },
    affectedResources: [
      { id: 'i-0x123', type: 'EC2', instanceType: 'm5.xlarge', region: 'us-east-1a', state: 'running', costPerHour: 0.96, cpu: 23, memory: 31, uptime: '18h' },
      { id: 'i-0x456', type: 'EC2', instanceType: 'm5.xlarge', region: 'us-east-1b', state: 'running', costPerHour: 0.96, cpu: 25, memory: 29, uptime: '18h' },
      { id: 'i-0x789', type: 'EC2', instanceType: 'm5.xlarge', region: 'us-east-1a', state: 'running', costPerHour: 0.96, cpu: 21, memory: 33, uptime: '18h' },
      { id: 'i-0xabc', type: 'EC2', instanceType: 'm5.xlarge', region: 'us-east-1c', state: 'running', costPerHour: 0.96, cpu: 24, memory: 30, uptime: '18h' },
      { id: 'i-0xdef', type: 'EC2', instanceType: 'm5.xlarge', region: 'us-east-1b', state: 'running', costPerHour: 0.96, cpu: 22, memory: 32, uptime: '18h' }
    ],
    tags: {
      Environment: 'prod',
      Team: 'backend',
      CostCenter: 'engineering',
      Project: 'DataPipeline',
      Owner: 'dan'
    },
    timeline: [
      { time: '2026-01-15T15:24:00Z', event: '5 m5.xlarge instances launched', details: 'Launched by: deploy-bot (GitHub Actions)', metadata: { workflow: '.github/workflows/deploy-pipeline.yml', commit: 'abc123 "Scale up for load test"' } },
      { time: '2026-01-15T15:25:00Z', event: 'Cost rate increased', details: 'From $1.57/hr to $6.37/hr (daily: $152.88)' },
      { time: '2026-01-15T15:26:00Z', event: 'Anomaly detected (15x baseline)', details: 'Alert sent to: Slack #cloud-costs, email to @dan' },
      { time: '2026-01-15T15:30:00Z', event: 'Ticket JIRA-1234 opened', details: 'Assigned to: @dan' },
      { time: 'now', event: 'Instances still running (18 hours)', details: 'Current waste: $2,751 since launch' }
    ],
    assignedTo: { name: 'Dan', email: 'dan@company.com', role: 'DevOps Engineer' },
    ticket: { id: 'JIRA-1234', url: '#', title: 'Prod costs spike' },
    notes: [
      { author: '@dan', time: '2 hours ago', text: 'We finished load testing yesterday. I forgot to stop these instances. Will right-size and add auto-shutdown policy.' },
      { author: 'Numio', time: '2 hours ago', text: "I've prepared a right-sizing plan ready for your approval. Also created a draft policy to auto-stop test instances after 24h. Want to review?" }
    ]
  },
  {
    id: 'anomaly-002',
    title: 'S3 Egress Spike',
    severity: 'warning',
    status: 'new',
    detectedAt: '2026-01-18T11:42:00Z',
    impact: {
      daily: 120,
      monthly: 3600,
      description: '+$120/day'
    },
    summary: 'S3 egress charges unusual spike',
    description: 'Data transfer out increased 5x from baseline',
    rootCause: {
      primary: 'Increased API traffic to external consumers',
      factors: [
        'New partner integration went live',
        'No CloudFront caching configured'
      ]
    },
    affectedResources: [
      { id: 'bucket-api-assets', type: 'S3', region: 'us-east-1', costPerDay: 85 },
      { id: 'bucket-data-exports', type: 'S3', region: 'us-east-1', costPerDay: 35 }
    ],
    assignedTo: null,
    ticket: null,
    notes: []
  }
];

export const getAnomalyById = (id) => anomalies.find(a => a.id === id);

export const getAnomaliesBySeverity = (severity) => anomalies.filter(a => a.severity === severity);

export const getActiveAnomalies = () => anomalies.filter(a => a.status !== 'resolved' && a.status !== 'dismissed');
