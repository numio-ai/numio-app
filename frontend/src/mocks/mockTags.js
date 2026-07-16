/**
 * Mock Tags Data
 * Shared between Overview (top tags by spend) and Settings/Tags page.
 */

/** Tag policy and naming convention for Settings > Tags (company standard) */
export const tagPolicy = {
  requiredKeys: [
    { key: "cost-center", description: "Cost center or budget owner" },
    { key: "owner", description: "Team or person responsible" },
    { key: "env", description: "Environment (e.g. production, staging, dev)" },
    { key: "ai-model", description: "AI model identifier (e.g. gpt-4, claude-3, gemini-pro)" },
  ],
  optionalKeys: [
    { key: "project", description: "Project or initiative" },
    { key: "service", description: "Service or application name" },
  ],
  namingRules: [
    "Use lowercase for keys and values.",
    "Format: key:value (e.g. env:production, team:platform).",
    "Use hyphens or underscores for multi-word keys; no spaces.",
    "Reserved prefixes (do not use for custom tags): aws:, numio:.",
  ],
  examples: ["env:production", "team:platform", "cost-center:engineering", "owner:finops"],
};

export const tagsData = [
  { tag: "env:production", spend: 11050, pct: 60 },
  { tag: "env:staging", spend: 2950, pct: 16 },
  { tag: "project:ml-training", spend: 2030, pct: 11 },
  { tag: "team:platform", spend: 1290, pct: 7 },
  { tag: "env:dev", spend: 920, pct: 5 },
  { tag: "untagged", spend: 180, pct: 1, isUntagged: true },
];
