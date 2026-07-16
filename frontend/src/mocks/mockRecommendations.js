/**
 * Mock Recommendations Data
 *
 * Cost optimization recommendations with rationale, risk assessment, and actions.
 * Used in: Overview (Top Recommendations), Optimize > Recommendations page
 */

export const recommendations = [
  {
    id: 'rec-ai-001',
    type: 'ai',
    priority: 98,
    title: 'Switch Chatbot Prod from GPT-4 to GPT-4o-mini for non-critical queries',
    impact: { monthly: 890, annual: 10680, percentage: 35 },
    risk: 'none',
    effort: '2 hours',
    confidence: 'high',
    account: 'prod',
    provider: 'OpenAI',
    environment: 'prod',
    owner: 'ML Platform team',
    status: 'pending',
    confidenceReason: 'GPT-4o-mini matches quality for non-critical flows at ~35% cost; A/B results on similar workloads.',
  },
  {
    id: 'rec-ai-002',
    type: 'ai',
    priority: 92,
    title: 'Enable prompt caching for Code Assistant — estimated 40% token reduction',
    impact: { monthly: 350, annual: 4200, percentage: 40 },
    risk: 'low',
    effort: '1 hour',
    confidence: 'high',
    account: 'all',
    provider: 'Anthropic',
    environment: 'all',
    owner: 'Engineering team',
    status: 'pending',
    confidenceReason: 'Prompt caching reduces repeated context cost; 40% token reduction from cache hits in pilot.',
  },
  {
    id: 'rec-001',
    priority: 100,
    title: 'Right-size 8 over-provisioned EC2 instances',
    type: 'rightsizing',
    impact: {
      monthly: 892,
      annual: 10704,
      percentage: 50
    },
    risk: 'low', // low, medium, high
    effort: '1 day',
    confidence: 'high', // low, medium, high
    account: 'engineering-prod',
    provider: 'AWS',
    confidenceReason: '12/12 similar actions succeeded with no regressions',
    similarRecommendations: ['Right-size 4 staging instances', 'Resize EC2 in data-pipeline'],
    environment: 'prod',
    owner: 'data-pipeline team',
    status: 'pending', // pending, applied, scheduled, dismissed
    rationale: {
      resourceAnalysis: {
        avgCpu: 23,
        avgMemory: 31,
        peakCpu: 41,
        targetRange: '60-80%'
      },
      costBenefit: {
        current: { count: 8, type: 'm5.xlarge', costEach: 111.50, total: 892 },
        proposed: { count: 8, type: 'm5.large', costEach: 55.75, total: 446 },
        savings: 446,
        payback: 'Immediate'
      },
      riskAssessment: {
        performanceImpact: 'Minimal (well within capacity)',
        rollbackTime: '2 minutes',
        successRate: '12/12 similar actions (100%)'
      }
    },
    affectedResources: [
      { id: 'i-0x123', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0x456', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0x789', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0xabc', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0xdef', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0x111', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0x222', type: 'm5.xlarge', proposed: 'm5.large' },
      { id: 'i-0x333', type: 'm5.xlarge', proposed: 'm5.large' }
    ],
    actions: ['apply', 'schedule', 'dismiss', 'ask']
  },
  {
    id: 'rec-002',
    priority: 95,
    title: 'Migrate 3 on-demand RDS instances to Reserved Instances',
    type: 'commitment',
    impact: {
      monthly: 1721,
      annual: 20652,
      percentage: 29
    },
    risk: 'none',
    effort: '1 hour',
    confidence: 'high',
    account: 'engineering-prod',
    provider: 'AWS',
    confidenceReason: 'RI coverage analysis shows stable 12-month usage',
    similarRecommendations: ['Purchase 1yr RIs for analytics DBs'],
    environment: 'prod',
    owner: 'data-pipeline team',
    status: 'pending',
    rationale: {
      usagePattern: {
        uptime: '99.9%',
        duration: '12+ months running 24/7',
        pattern: 'Production databases, consistent usage'
      },
      costComparison: {
        onDemand: { annual: 5652 },
        oneYearRI: { annual: 3991, savings: 1661, discount: 29 },
        threeYearRI: { annual: 3156, savings: 2496, discount: 44 }
      }
    },
    affectedResources: [
      { id: 'rds-prod-main', type: 'db.r5.large', region: 'us-east-1' },
      { id: 'rds-prod-replica', type: 'db.r5.large', region: 'us-east-1' },
      { id: 'rds-analytics', type: 'db.r5.large', region: 'us-west-2' }
    ],
    actions: ['apply-1yr', 'apply-3yr', 'dismiss', 'ask']
  },
  {
    id: 'rec-003',
    priority: 85,
    title: 'Enable Autopilot on 12 Compute instances',
    type: 'automation',
    impact: {
      monthly: 234,
      annual: 2808,
      percentage: 15
    },
    risk: 'very-low',
    effort: '5 min',
    confidence: 'high',
    account: 'all',
    provider: 'AWS',
    confidenceReason: 'Autopilot has executed 10k+ actions without incidents',
    similarRecommendations: ['Enable automation on storage cleanup'],
    environment: 'dev',
    owner: 'finops',
    status: 'pending',
    rationale: {
      whatItWillDo: [
        'Auto-stop non-prod instances idle >72 hours',
        'Suspend dev GPUs outside 9am-6pm PST',
        'Delete old snapshots >90 days'
      ],
      whatItWontDo: [
        'Touch production resources',
        'Delete databases',
        'Make changes >$500 impact'
      ],
      historicalPerformance: {
        avgSavings: 234,
        incidents: 0,
        actionsExecuted: 10000
      }
    },
    affectedResources: [
      { id: 'i-dev-001', type: 'EC2', environment: 'dev' },
      { id: 'i-dev-002', type: 'EC2', environment: 'dev' },
      { id: 'i-staging-001', type: 'EC2', environment: 'staging' }
      // ... more
    ],
    actions: ['enable', 'configure', 'learn-more', 'dismiss']
  },
  {
    id: 'rec-004',
    priority: 80,
    title: 'Enable auto-scaling for DataPipeline cluster',
    type: 'scaling',
    impact: {
      monthly: 184,
      annual: 2208,
      percentage: 20
    },
    risk: 'medium',
    effort: '4 hours',
    confidence: 'medium',
    account: 'engineering-prod',
    provider: 'GCP',
    confidenceReason: 'Load variability supports scaling with safety buffers',
    similarRecommendations: ['Enable autoscaling on inference pool'],
    environment: 'prod',
    owner: 'ml-platform',
    status: 'pending',
    rationale: {
      currentState: '5 instances running 24/7',
      proposedState: 'Scale 2-10 based on load',
      avgUtilization: 35,
      peakUtilization: 78
    },
    actions: ['view-details', 'create-plan', 'dismiss', 'ask']
  },
  {
    id: 'rec-005',
    priority: 75,
    title: 'Delete 15 unused EBS volumes',
    type: 'cleanup',
    impact: {
      monthly: 45,
      annual: 540,
      percentage: 100
    },
    risk: 'low',
    effort: '10 min',
    confidence: 'high',
    account: 'engineering-dev',
    provider: 'Azure',
    confidenceReason: 'Volumes are unattached with snapshots available',
    similarRecommendations: ['Clean unused snapshots >120 days'],
    environment: 'dev',
    owner: 'platform-team',
    status: 'pending',
    rationale: {
      description: 'Unattached EBS volumes with no recent access',
      lastAccess: 'Over 90 days ago',
      snapshotExists: true
    },
    actions: ['apply', 'schedule', 'dismiss']
  }
];

export const recommendationsSummary = {
  totalSavings: {
    monthly: 2847,
    annual: 34164
  },
  aiSavingsMonthly: 1240,
  counts: {
    total: 23,
    highImpact: 8,    // >$500/mo
    mediumImpact: 12, // $100-$500/mo
    lowImpact: 3      // <$100/mo
  },
  lastUpdated: '15 min ago'
};

export const getRecommendationById = (id) => recommendations.find(r => r.id === id);

export const getRecommendationsByType = (type) => recommendations.filter(r => r.type === type);

export const getRecommendationsByRisk = (risk) => recommendations.filter(r => r.risk === risk);
