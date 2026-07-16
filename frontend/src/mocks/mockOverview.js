/**
 * Mock Overview Data
 *
 * Dashboard overview data including summary, greeting, and agent narrative.
 * Used in: Overview (Agent-First Dashboard)
 */

export const overviewGreeting = {
  name: 'James Cooper',
  timeOfDay: 'evening', // morning, afternoon, evening
  message: 'Monitoring your costs 24/7 • Overnight findings:',
  subMessage: ""
};

/** Single source of truth for spend, budget, and comparison metrics across the app */
export const overviewSummary = {
  period: 'February 2026',
  currentMTD: 18420,
  forecast: 26100,
  budget: 50000,
  lastMonth: 24800,
  vsLastMonth: 673.44, // percentage change
  vsJan: 17200, // prior month spend (Jan) for "vs Jan" comparison
  threeMoAvg: 16800, // 3-month average for "3-mo avg"
  percentUsed: 36.84, // 18420 / 50000
  percentForecast: 52.2, // 26100 / 50000
  status: 'on-track', // on-track, warning, over
  statusMessage: 'On track to stay under budget',
  lastUpdated: '2 min ago'
};

export const monitoringStatus = {
  lastCheck: "2 min ago",
  nextCheck: "in 15 min",
  status: "Active",
};

export const baselineComparison = [
  { label: "Normal (30d)", value: "$15.70/day" },
  { label: "Current", value: "$221/day" },
  { label: "Change", value: "+1314%" },
];

export const changeTimeline = [
  { time: "3:24 PM", event: "5 EC2 instances launched", owner: "deploy-bot", impact: "+$205.30/day" },
  { time: "3:38 PM", event: "RDS instance upgraded", owner: "data-pipeline", impact: "+$53/day" },
  { time: "4:05 PM", event: "S3 egress spike detected", owner: "ml-team", impact: "+$21/day" },
];

export const alertHistory = [
  { id: "alert-001", severity: "Urgent", title: "Prod EC2 15x baseline", time: "Jan 15, 3:24 PM" },
  { id: "alert-002", severity: "Warning", title: "S3 egress spike", time: "Jan 18, 11:42 AM" },
  { id: "alert-003", severity: "Info", title: "New tagging gaps detected", time: "Jan 20, 08:11 AM" },
];

export const urgentInsight = {
  id: 'urgent-001',
  severity: 'critical',
  title: 'Prod costs spiked 1,314% yesterday',
  environment: 'prod',
  investigation: {
    summary: 'I investigated and found the cause:',
    findings: [
      '5 new m5.xlarge EC2 instances launched at 3:24 PM',
      'Launched by: deploy-bot (GitHub Actions workflow)',
      'Project: DataPipeline (CostCenter: Engineering)',
      'Daily impact: +$205.30/day ($6,160/mo if unchanged)'
    ]
  },
  recommendations: [
    { text: 'Review if all 5 instances are needed (avg CPU: 23%)', savings: null },
    { text: 'Right-size to m5.large', savings: 30800 },
    { text: 'Enable auto-scaling', savings: 18400 }
  ],
  origins: [
    { service: "EC2 Compute", impact: "$152.30/day" },
    { service: "RDS", impact: "$53/day" },
    { service: "S3 Egress", impact: "$21/day" },
  ],
  ticketOpened: {
    id: 'DEV-1234',
    notified: '@dan'
  },
  actions: [
    { label: 'Approve Right-sizing', type: 'primary', action: 'approve-rightsizing' },
    { label: 'View Full Analysis', type: 'secondary', action: 'view-analysis' },
    { label: 'Dismiss', type: 'ghost', action: 'dismiss' }
  ]
};

export const automaticActions = [
  { action: 'Stopped 3 idle dev instances', savings: 2000, unit: 'day' },
  { action: 'Enabled S3 Intelligent-Tiering on 8 buckets', savings: 1200, unit: 'mo' },
  { action: 'Suspended non-prod GPUs outside business hours', savings: null }
];

export const activeIssues = {
  title: 'Anomalies (Last 7 Days)',
  count: 2,
  items: [
    {
      id: 'anomaly-001',
      severity: 'critical',
      title: 'Prod EC2 15x baseline',
      time: 'Jan 15, 3:24 PM',
      impact: '+$4,500/day',
      action: 'Investigate'
    },
    {
      id: 'anomaly-002',
      severity: 'warning',
      title: 'S3 egress spike',
      time: 'Jan 18, 11:42 AM',
      impact: '+$1,200/day',
      action: 'Investigate'
    }
  ]
};

export const topRecommendations = {
  title: 'Potential Savings',
  totalSavings: 284700,
  items: [
    { id: 'rec-001', title: 'Right-size 8 EC2 instances', savings: 89200, risk: 'Low', action: 'Apply' },
    { id: 'rec-002', title: 'Enable Autopilot on 12 VMs', savings: 23400, risk: 'Very low', action: 'Enable' },
    { id: 'rec-003', title: 'Migrate 3 RDS to RIs', savings: 172100, risk: 'No risk', commitment: '1yr', action: 'View Details' }
  ]
};

export const policyCompliance = {
  title: 'Policy Compliance',
  violationCount: 3,
  items: [
    { severity: 'critical', title: '2x Unapproved GPU types', owner: 'ml-team', action: 'Open Ticket' },
    { severity: 'warning', title: '1x Missing tags', count: 12, resourceType: 'EC2 instances', action: 'Auto-Tag' }
  ]
};

export const quickActions = [
  { label: 'View all idle resources', path: '/optimize/idle' },
  { label: 'Review budget status', path: '/govern/budgets' },
  { label: 'Check policy violations', path: '/govern/policies' },
  { label: 'Download monthly report', action: 'download-report' },
  { label: 'Schedule cost review', action: 'schedule-review' }
];

export const costTrend = {
  title: 'Cost Trend',
  data: [
    { date: '2025-07-01', label: 'Jul 2025', value: 0 },
    { date: '2025-08-01', label: 'Aug 2025', value: 0 },
    { date: '2025-09-01', label: 'Sep 2025', value: 0 },
    { date: '2025-10-01', label: 'Oct 2025', value: 0 },
    { date: '2025-11-01', label: 'Nov 2025', value: 0 },
    { date: '2025-12-01', label: 'Dec 2025', value: 15.70 },
    { date: '2026-01-01', label: 'Jan 1', value: 15.70 },
    { date: '2026-01-05', label: 'Jan 5', value: 35 },
    { date: '2026-01-10', label: 'Jan 10', value: 82 },
    { date: '2026-01-15', label: 'Jan 15', value: 221 },
    { date: '2026-01-20', label: 'Jan 20', value: 317.60 },
    { date: '2026-01-25', label: 'Jan 25 (F)', value: 385, forecast: true },
    { date: '2026-01-30', label: 'Jan 30 (F)', value: 430.50, forecast: true }
  ]
};
