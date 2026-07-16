/**
 * Mock Chat Data
 *
 * Chat conversation data for the "Ask Numio" interface.
 * Used in: Chat Widget, Expanded Chat View
 */

export const chatExamples = [
  'Why did costs spike?',
  'Show idle GPUs',
  "What's my biggest cost driver?",
  'Compare AWS vs GCP costs',
  'Show me all idle GPU instances',
  'How much am I spending on storage?'
];

export const chatSuggestedResponses = {
  costSpike: [
    'For load testing',
    'Not sure, investigate',
    'Show me the deployment'
  ],
  instancesNeeded: [
    'No, we finished testing',
    'Yes, keep them running',
    'Stop them temporarily'
  ],
  createPolicy: [
    'Yes, Create Policy',
    'Not Now',
    'Tell Me More'
  ]
};

export const sampleConversation = [
  {
    id: 'msg-001',
    role: 'user',
    content: 'Why did my costs spike last week?',
    timestamp: '2026-01-19T10:30:00Z'
  },
  {
    id: 'msg-002',
    role: 'assistant',
    content: 'I see costs increased $234 on Jan 15. Here’s the breakdown by source:',
    timestamp: '2026-01-19T10:30:05Z',
    data: {
      type: 'stacked-waterfall',
      title: 'Cost increase by source (Jan 15)',
      startLabel: 'Jan 8',
      startValue: 0,
      segments: [
        { label: 'EC2', value: 115.2 },
        { label: 'RDS', value: 5.3 },
        { label: 'S3 egress', value: 2.1 }
      ],
      endLabel: 'Total',
      endValue: 122.6
    }
  },
  {
    id: 'msg-003',
    role: 'assistant',
    content: 'The spike came from your Prod account. Specifically, 5 new EC2 instances were launched at 3:24 PM.',
    timestamp: '2026-01-19T10:30:10Z',
    sources: ['AWS Cost Explorer', 'EC2 Instance Logs'],
    data: {
      type: 'table',
      headers: ['Instance Type', 'Count', 'Cost/day', 'Launched by'],
      rows: [
        ['m5.xlarge', '5', '$115.20', 'deploy-bot (GitHub)']
      ]
    },
    followUp: 'Do you know why these instances were created?',
    suggestedResponses: ['For load testing', 'Not sure, investigate', 'Show me the deployment']
  },
  {
    id: 'msg-004',
    role: 'user',
    content: 'Probably for the load test',
    timestamp: '2026-01-19T10:31:00Z'
  },
  {
    id: 'msg-005',
    role: 'assistant',
    content: 'That makes sense. I found the GitHub workflow that launched them:',
    timestamp: '2026-01-19T10:31:05Z',
    sources: ['GitHub Actions', 'Change Log'],
    data: {
      type: 'details',
      items: [
        { label: 'Workflow', value: '.github/workflows/deploy-pipeline.yml' },
        { label: 'Commit', value: 'abc123 "Scale up for load test"' },
        { label: 'Author', value: '@dan' },
        { label: 'Time', value: 'Jan 15, 3:23 PM' }
      ]
    },
    followUp: 'These instances are still running and costing $5/hour. Do you still need them?',
    suggestedResponses: ['No, we finished testing', 'Yes, keep them running', 'Stop them temporarily']
  },
  {
    id: 'msg-006',
    role: 'user',
    content: 'No, we finished testing',
    timestamp: '2026-01-19T10:32:00Z'
  },
  {
    id: 'msg-007',
    role: 'assistant',
    content: "Got it. Should I stop them now to prevent further costs? I'll create snapshots first for rollback capability.",
    timestamp: '2026-01-19T10:32:05Z',
    sources: ['EC2 Inventory', 'Snapshot Policy'],
    data: {
      type: 'action-plan',
      title: 'Action Plan',
      steps: [
        'Create snapshots of all 5 instances',
        'Stop instances',
        'Cost savings: $115/day ($3,465/mo)'
      ]
    },
    actions: [
      { label: 'Stop Instances', type: 'primary' },
      { label: 'Keep Running', type: 'secondary' },
      { label: 'Stop Later', type: 'ghost' }
    ]
  },
  {
    id: 'msg-008',
    role: 'user',
    content: '[Clicked "Stop Instances"]',
    timestamp: '2026-01-19T10:33:00Z',
    isAction: true
  },
  {
    id: 'msg-009',
    role: 'assistant',
    content: 'Working on it...',
    timestamp: '2026-01-19T10:33:05Z',
    status: 'executing',
    progressSteps: [
      { text: 'Created snapshot snap-123 (i-0x123)', done: true },
      { text: 'Created snapshot snap-456 (i-0x456)', done: true },
      { text: 'Created snapshot snap-789 (i-0x789)', done: true },
      { text: 'Created snapshot snap-abc (i-0xabc)', done: true },
      { text: 'Created snapshot snap-def (i-0xdef)', done: true },
      { text: 'Stopped instance i-0x123', done: true },
      { text: 'Stopped instance i-0x456', done: true },
      { text: 'Stopped instance i-0x789', done: true },
      { text: 'Stopped instance i-0xabc', done: true },
      { text: 'Stopped instance i-0xdef', done: true }
    ]
  },
  {
    id: 'msg-010',
    role: 'assistant',
    content: 'Done! All instances stopped successfully.',
    timestamp: '2026-01-19T10:35:00Z',
    data: {
      type: 'result',
      items: [
        { label: 'Cost rate dropped', value: 'from $5/hr to $0.20/hr (storage only)' },
        { label: 'Savings', value: '$115/day going forward' }
      ]
    },
    followUp: 'Want me to create a policy to auto-stop test instances after 24 hours to prevent this in the future?',
    actions: [
      { label: 'Yes, Create Policy', type: 'primary' },
      { label: 'Not Now', type: 'secondary' },
      { label: 'Tell Me More', type: 'ghost' }
    ]
  }
];

export const chatThreads = [
  { id: "thread-001", title: "Prod costs spike", updated: "2h ago" },
  { id: "thread-002", title: "Idle GPU cleanup", updated: "Yesterday" },
  { id: "thread-003", title: "Budget overrun forecast", updated: "Jan 18" },
];

export const chatWidgetConfig = {
  placeholder: 'Ask Numio anything...',
  keyboardShortcut: '/',
  position: 'bottom-right',
  collapsedHeight: 60,
  expandedHeight: 600,
  expandedWidth: 450
};
