/**
 * Mock Resources Data
 *
 * Resource inventory with utilization metrics and efficiency data.
 * Spend and comparison metrics from Overview (single source of truth).
 * Used in: Resources section, Services page
 */

import { overviewSummary } from './mockOverview';

export const resourcesSummary = {
  totalResources: 156,
  aiResources: 23,
  totalCost: overviewSummary.currentMTD,
  avgUtilization: 58,
  idleResources: 12,
  underutilized: 23,
  lastUpdated: overviewSummary.lastUpdated,
  vsJan: overviewSummary.vsJan,
  threeMoAvg: overviewSummary.threeMoAvg,
};

/** Services by type — costs sum to Overview MTD $18,420; teams align with Spend by Team */
export const services = [
  {
    id: 'svc-ec2',
    name: 'EC2 Compute',
    team: 'Engineering / DevOps',
    environment: 'prod',
    resourceCount: 42,
    cost: 5080, // Eng ~4100 + ML ~490 + Marketing/Sales share
    utilization: {
      avg: 68,
      type: 'CPU/Memory'
    },
    issues: {
      idle: 3,
      underutilized: 8,
      message: '3 instances idle >72hrs (wasting $4.50/day)'
    },
    trend: 'up', // up, down, stable
    trendPercent: 15
  },
  {
    id: 'svc-rds',
    name: 'RDS Database',
    team: 'Engineering / DevOps',
    environment: 'prod',
    resourceCount: 8,
    cost: 3810, // Eng 2580 + Data 1230
    utilization: {
      avg: 45,
      type: 'CPU/Connections'
    },
    issues: {
      idle: 0,
      underutilized: 2,
      message: '2 instances at <30% utilization'
    },
    trend: 'stable',
    trendPercent: 2
  },
  {
    id: 'svc-s3',
    name: 'S3 Storage',
    team: 'Data & Analytics',
    environment: 'staging',
    resourceCount: 24,
    cost: 2682, // Eng 1290 + ML 900 + Data 492
    utilization: {
      avg: null,
      type: 'Access patterns'
    },
    issues: {
      idle: 5,
      underutilized: 0,
      message: '5 buckets with no access in 90+ days'
    },
    trend: 'up',
    trendPercent: 8
  },
  {
    id: 'svc-lambda',
    name: 'Lambda Functions',
    team: 'Engineering / DevOps',
    environment: 'dev',
    resourceCount: 35,
    cost: 420,
    utilization: {
      avg: 72,
      type: 'Invocations'
    },
    issues: {
      idle: 4,
      underutilized: 0,
      message: '4 functions with 0 invocations this month'
    },
    trend: 'down',
    trendPercent: -5
  },
  {
    id: 'svc-cloudwatch',
    name: 'CloudWatch',
    team: 'Corporate / Other',
    environment: 'prod',
    resourceCount: 18,
    cost: 800, // Corporate / Other total from Overview
    utilization: {
      avg: null,
      type: 'Logs/Metrics'
    },
    issues: {
      idle: 0,
      underutilized: 0
    },
    trend: 'stable',
    trendPercent: 1
  },
  {
    id: 'svc-gpu',
    name: 'GPU Instances',
    team: 'ML Platform',
    environment: 'dev',
    resourceCount: 6,
    cost: 5628, // ML Platform primary + Eng/Sales share (ML $4120 + AI apps ~$1508)
    utilization: {
      avg: 35,
      type: 'GPU/Memory'
    },
    issues: {
      idle: 2,
      underutilized: 3,
      message: '2 GPUs idle, 3 at <40% utilization'
    },
    trend: 'up',
    trendPercent: 25
  }
];

export const idleResources = [
  {
    id: 'i-0x123',
    type: 'EC2',
    name: 'dev-worker-01',
    environment: 'dev',
    region: 'us-east-1a',
    state: 'stopped',
    costPerDay: 1.20,
    idleDuration: '5 days',
    lastActivity: '2026-01-14',
    owner: 'backend-team',
    recommendation: 'Terminate or start'
  },
  {
    id: 'i-0x456',
    type: 'EC2',
    name: 'staging-api-03',
    environment: 'staging',
    region: 'us-west-2b',
    state: 'running',
    costPerDay: 1.80,
    idleDuration: '3 days',
    cpuUtilization: 2,
    lastActivity: '2026-01-16',
    owner: 'platform-team',
    recommendation: 'Stop or right-size'
  },
  {
    id: 'i-0x789',
    type: 'EC2',
    name: 'test-runner-02',
    environment: 'dev',
    region: 'us-east-1c',
    state: 'running',
    costPerDay: 1.50,
    idleDuration: '4 days',
    cpuUtilization: 3,
    lastActivity: '2026-01-15',
    owner: 'qa-team',
    recommendation: 'Stop'
  },
  {
    id: 'gpu-dev-001',
    type: 'EC2 (GPU)',
    name: 'ml-training-dev',
    environment: 'dev',
    instanceType: 'p3.2xlarge',
    region: 'us-east-1a',
    state: 'running',
    costPerDay: 24.00,
    idleDuration: '72 hours',
    gpuUtilization: 0,
    lastActivity: '2026-01-16',
    owner: 'ml-team',
    recommendation: 'Stop or suspend outside hours'
  },
  {
    id: 'gpu-dev-002',
    type: 'EC2 (GPU)',
    name: 'ml-inference-test',
    environment: 'dev',
    instanceType: 'p3.2xlarge',
    region: 'us-west-2',
    state: 'running',
    costPerDay: 24.00,
    idleDuration: '48 hours',
    gpuUtilization: 5,
    lastActivity: '2026-01-17',
    owner: 'ml-team',
    recommendation: 'Schedule auto-stop'
  }
];

export const underutilizedResources = [
  {
    id: 'i-0xaaa',
    type: 'EC2',
    name: 'api-server-prod-01',
    instanceType: 'm5.xlarge',
    region: 'us-east-1',
    costPerMonth: 123,
    utilization: {
      cpu: 18,
      memory: 25
    },
    recommendation: {
      action: 'Right-size to m5.large',
      savings: 61,
      risk: 'low'
    }
  },
  {
    id: 'rds-analytics-01',
    type: 'RDS',
    name: 'analytics-db',
    instanceType: 'db.r5.xlarge',
    region: 'us-east-1',
    costPerMonth: 280,
    utilization: {
      cpu: 22,
      connections: 15
    },
    recommendation: {
      action: 'Right-size to db.r5.large',
      savings: 140,
      risk: 'medium'
    }
  }
];

export const getServiceById = (id) => services.find(s => s.id === id);

export const getIdleResourcesByType = (type) => idleResources.filter(r => r.type === type);

/** AI/ML resource inefficiencies — shown in Services as "AI RESOURCE INEFFICIENCIES" */
export const aiIdleResources = [
  { id: 'gpu-cluster-01', type: 'GPU/A100', name: 'gpu-cluster-01', environment: 'prod', costPerDay: 320, recommendation: 'Downscale to A10G' },
  { id: 'ml-training-02', type: 'EC2 p3.8xl', name: 'ml-training-02', environment: 'staging', costPerDay: 145, recommendation: 'Stop when idle' },
  { id: 'embedding-svc', type: 'Lambda', name: 'embedding-svc', environment: 'prod', costPerDay: 60, recommendation: 'Batch vs real-time' },
];
