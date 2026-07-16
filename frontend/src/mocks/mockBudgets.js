/**
 * Mock Budgets Data
 *
 * Budget tracking, forecasts, and alerts data.
 * companyBudget derived from Overview (single source of truth).
 * Used in: Overview (Budget Status), Govern > Budgets page
 */

import { overviewSummary } from './mockOverview';

/** Account-level budget — derived from Overview */
export const companyBudget = {
  period: overviewSummary.period,
  total: overviewSummary.budget,
  current: overviewSummary.currentMTD,
  forecast: overviewSummary.forecast,
  percentUsed: overviewSummary.percentUsed,
  percentForecast: overviewSummary.percentForecast,
  daysRemaining: 9,
  status: overviewSummary.status,
  lastUpdated: overviewSummary.lastUpdated,
};

/** Team budgets aligned with Overview Spend by Team (total MTD $18,420, budget $50,000) */
export const teamBudgets = [
  {
    id: 'budget-eng-devops',
    team: 'Engineering / DevOps',
    budget: 23500,
    current: 8640,
    forecast: 12200,
    percentUsed: 36.8,
    percentForecast: 51.9,
    daysRemaining: 9,
    status: 'on-track',
    topCosts: [
      { service: 'EC2', amount: 4100, percent: 47 },
      { service: 'RDS', amount: 2580, percent: 30 },
      { service: 'S3', amount: 1290, percent: 15 }
    ]
  },
  {
    id: 'budget-ml',
    team: 'ML Platform',
    budget: 11000,
    current: 4120,
    forecast: 5800,
    percentUsed: 37.5,
    percentForecast: 52.7,
    daysRemaining: 9,
    status: 'on-track',
    topCosts: [
      { service: 'GPU (p3.8xlarge)', amount: 2550, percent: 62 },
      { service: 'S3', amount: 900, percent: 22 },
      { service: 'EC2', amount: 490, percent: 12 }
    ],
    recommendations: [
      { action: 'Stop 2 idle GPU instances', savings: 192 },
      { action: 'Enable auto-shutdown for dev GPUs', savings: 240 }
    ],
    forecastWithRecommendations: 5368
  },
  {
    id: 'budget-data',
    team: 'Data & Analytics',
    budget: 6500,
    current: 2460,
    forecast: 3500,
    percentUsed: 37.8,
    percentForecast: 53.8,
    daysRemaining: 9,
    status: 'on-track',
    topCosts: [
      { service: 'RDS', amount: 1230, percent: 50 },
      { service: 'Redshift', amount: 738, percent: 30 },
      { service: 'S3', amount: 492, percent: 20 }
    ]
  },
  {
    id: 'budget-marketing',
    team: 'Marketing',
    budget: 4000,
    current: 1380,
    forecast: 2200,
    percentUsed: 34.5,
    percentForecast: 55,
    daysRemaining: 9,
    status: 'on-track',
    topCosts: [
      { service: 'S3', amount: 690, percent: 50 },
      { service: 'CloudFront', amount: 414, percent: 30 },
      { service: 'Lambda', amount: 276, percent: 20 }
    ]
  },
  {
    id: 'budget-sales',
    team: 'Sales',
    budget: 3000,
    current: 1020,
    forecast: 1550,
    percentUsed: 34,
    percentForecast: 51.7,
    daysRemaining: 9,
    status: 'on-track'
  },
  {
    id: 'budget-corporate',
    team: 'Corporate / Other',
    budget: 2000,
    current: 800,
    forecast: 2200,
    percentUsed: 40,
    percentForecast: 110,
    daysRemaining: 9,
    status: 'warning',
    overAmount: 200,
    overPercent: 10,
    alertSent: '2026-02-10',
    alertRecipient: '@finops-lead',
    approvalRequired: false
  }
];

export const budgetAlerts = [
  {
    id: 'alert-001',
    time: '2026-02-10T09:00:00Z',
    severity: 'warning',
    team: 'Corporate / Other',
    teamId: 'budget-corporate',
    message: 'Trending over budget (+$200)',
    forecast: 2200,
    budget: 2000,
    percentForecast: 110,
    recipients: ['@finops-lead'],
    channels: ['Email', 'Slack #cloud-costs']
  },
  {
    id: 'alert-002',
    time: '2026-02-09T14:00:00Z',
    severity: 'warning',
    team: 'ML Platform',
    teamId: 'budget-ml',
    message: 'Trending over budget (+$320)',
    forecast: 11320,
    budget: 11000,
    percentForecast: 102.9,
    recipients: ['alice@ml-team', 'bob@finance'],
    channels: ['Email', 'Slack']
  }
];

/** Expanded detail for Budget Alerts page (cost drivers, actions, forecast) */
export const budgetAlertDetails = {
  'alert-001': {
    costDrivers: [
      { title: 'Contractor tools (SaaS)', meta: '+$120/mo • New licenses added Feb 1' },
      { title: 'Shared dev environment', meta: '+$60/mo • Usage up 25%' },
      { title: 'Misc overhead', meta: '+$20/mo • One-time migration' }
    ],
    recommendedActions: [
      { tier: 'TIER 2', title: 'Review contractor tool usage', meta: 'Save $60/mo • Effort: 30 min • Risk: Low' },
      { tier: 'TIER 2', title: 'Right-size shared dev instance', meta: 'Save $30/mo • Effort: 15 min • Risk: Low' },
      { tier: 'TIER 3', title: 'Apply reserved capacity', meta: 'Save $40/mo • Effort: Automated • Risk: Low' }
    ],
    forecastWithout: 2200,
    forecastWith: 2070,
    recipientsDisplay: '@finops-lead (Email, Slack #cloud-costs)'
  },
  'alert-002': {
    costDrivers: [
      { title: 'GPU cluster ml-train-01', meta: '+$180/mo • New workload added Jan 15' },
      { title: 'RDS instance ml-db-prod', meta: '+$85/mo • Storage growth 150GB → 320GB' },
      { title: 'S3 bucket ml-datasets', meta: '+$55/mo • Snapshot retention not applied' }
    ],
    recommendedActions: [
      { tier: 'TIER 2', title: 'Right-size ml-train-01 GPUs', meta: 'Save $90/mo • Effort: 1 hour • Risk: Low' },
      { tier: 'TIER 2', title: 'Enable ml-db-prod auto-pause', meta: 'Save $40/mo • Effort: 15 min • Risk: Low' },
      { tier: 'TIER 3', title: 'Delete old snapshots >90 days', meta: 'Save $55/mo • Effort: Automated • Risk: Low' }
    ],
    forecastWithout: 11320,
    forecastWith: 10935,
    recipientsDisplay: 'alice@ml-team, bob@finance'
  }
};

export const forecastMethodology = {
  description: 'How we calculate forecasts',
  methods: [
    {
      name: 'Trend Analysis',
      details: [
        'Linear regression on last 30 days of spending',
        'Weighted toward recent days (last 7 days = 60%)'
      ]
    },
    {
      name: 'Seasonal Patterns',
      details: [
        'Day-of-week patterns (Mondays typically +15%)',
        'Month-end patterns (last week typically +20%)'
      ]
    },
    {
      name: 'Known Changes',
      details: [
        'Scheduled deployments',
        'Approved infrastructure changes',
        'Commitment plan expirations'
      ]
    }
  ],
  accuracy: '92% (+-8%) for last 100 forecasts'
};

export const getBudgetById = (id) => teamBudgets.find(b => b.id === id);

export const getBudgetsByStatus = (status) => teamBudgets.filter(b => b.status === status);
