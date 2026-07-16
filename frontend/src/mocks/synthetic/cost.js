/**
 * Synthetic cost & budget dataset (spec §5.2, task synthetic_data_cost).
 *
 * Shape authority: backend response schemas behind frontend/src/api/dashboard.js
 * (cost-views, cost-explorer, budgets). All monetary fields serialize as
 * Decimal-as-strings, matching the backend; the frontend wraps each in Number().
 *
 * Reconciliation strategy: a single seeded fact table (one amount per
 * account × service × month, rounded to cents once) is built at module load.
 * Every view — total, time-series, by-service, by-account, by-region,
 * by-dimension, trends, budgets — is an aggregation of that one table, so all
 * breakdowns sum to the period total exactly (epsilon 0) and the whole set is
 * deterministic. Built on the canonical entities; defines no parallel set.
 */
import { ACCOUNTS, SERVICES, REGIONS, DEMO_WINDOW } from "./entities";
import { CORE_SEED, makeRng, rngFloat, round2, allocate } from "./seed";

const CURRENCY = "USD";

// Decimal-as-string, always 2dp, to match backend Decimal serialization.
const money = (n) => round2(n).toFixed(2);

// Relative monthly magnitude per service — keeps EC2/RDS dominant, Lambda tiny.
const SERVICE_WEIGHT = {
  ec2: 30, rds: 15, eks: 12, s3: 8, ebs: 7, dynamodb: 6, cloudfront: 5, vpc: 4, lambda: 3, cloudwatch: 2,
};
// Spend scales with environment maturity.
const ENV_SCALE = { production: 1, staging: 0.4, development: 0.2 };
// Coherent upward trend across the five demo months.
const MONTH_TREND = [0.9, 0.95, 1.0, 1.05, 1.12];

const daysInMonth = { "2026-01": 31, "2026-02": 28, "2026-03": 31, "2026-04": 30, "2026-05": 31 };

/**
 * The canonical fact table: amount per (accountId, serviceKey, month), each
 * rounded to cents. Includes one negative credit line so the dataset carries a
 * credit (a CUR reality), attached to a canonical service so no service string
 * is invented locally.
 */
function buildFacts() {
  const rng = makeRng(CORE_SEED + 1); // cost domain's own stream, still seeded
  const facts = [];
  ACCOUNTS.forEach((account) => {
    const envScale = ENV_SCALE[account.environment] ?? 0.3;
    SERVICES.forEach((service) => {
      DEMO_WINDOW.months.forEach((month, mi) => {
        const base =
          SERVICE_WEIGHT[service.key] * envScale * MONTH_TREND[mi] * 100 * rngFloat(rng, 0.85, 1.15);
        facts.push({
          accountId: account.id,
          region: account.primaryRegion,
          serviceKey: service.key,
          service: service.name,
          month,
          amount: round2(base),
        });
      });
    });
  });
  // One Savings Plan credit (negative) on the production account's EC2, modest
  // enough not to flip the service net negative.
  facts.push({
    accountId: ACCOUNTS[0].id,
    region: ACCOUNTS[0].primaryRegion,
    serviceKey: "ec2",
    service: SERVICES.find((s) => s.key === "ec2").name,
    month: DEMO_WINDOW.months[DEMO_WINDOW.months.length - 1],
    amount: round2(-rngFloat(rng, 400, 900)),
    credit: true,
  });
  return facts;
}

const FACTS = buildFacts();

const sumAmt = (rows) => round2(rows.reduce((a, r) => a + r.amount, 0));
const TOTAL = sumAmt(FACTS);

function groupSum(keyFn) {
  const map = new Map();
  for (const f of FACTS) map.set(keyFn(f), round2((map.get(keyFn(f)) || 0) + f.amount));
  return map;
}

// --- cost-views: metadata envelope -----------------------------------------

function metadata({ start = DEMO_WINDOW.start, end = DEMO_WINDOW.end, account = null, dimension = null } = {}) {
  return { start_date: start, end_date: end, account, dimension, filters: null };
}

/** GET /api/v1/cost-views/total → TotalCostResponse */
export function costTotal(opts = {}) {
  return {
    metadata: metadata(opts),
    total: money(TOTAL),
    currency: CURRENCY,
    data: monthlyBuckets(),
  };
}

function monthEnd(month) {
  return `${month}-${String(daysInMonth[month]).padStart(2, "0")}`;
}

function monthlyBuckets() {
  const byMonth = groupSum((f) => f.month);
  return DEMO_WINDOW.months.map((m) => ({
    start: `${m}-01`,
    end: monthEnd(m),
    amount: money(byMonth.get(m) || 0),
    currency: CURRENCY,
  }));
}

function dailyBuckets() {
  const byMonth = groupSum((f) => f.month);
  const buckets = [];
  for (const m of DEMO_WINDOW.months) {
    const days = daysInMonth[m];
    const amounts = allocate(byMonth.get(m) || 0, Array.from({ length: days }, (_, i) => 1 + ((i * 7) % 13)));
    for (let d = 0; d < days; d++) {
      const day = String(d + 1).padStart(2, "0");
      const next = String(d + 2).padStart(2, "0");
      buckets.push({
        start: `${m}-${day}`,
        end: d + 1 < days ? `${m}-${next}` : monthEnd(m),
        amount: money(amounts[d]),
        currency: CURRENCY,
      });
    }
  }
  return buckets;
}

/** GET /api/v1/cost-views/time-series → CostTimeSeriesResponse */
export function costTimeSeries({ granularity = "daily", dimension = null, ...opts } = {}) {
  const data = granularity === "monthly" ? monthlyBuckets() : dailyBuckets();
  let by_dimension = null;
  if (dimension) {
    const groups = dimensionGroups(dimension);
    by_dimension = groups.map((g) => ({
      dimension_value: g.value,
      data: DEMO_WINDOW.months.map((m) => ({
        start: `${m}-01`,
        end: monthEnd(m),
        amount: money((g.byMonth && g.byMonth.get(m)) || 0),
        currency: CURRENCY,
      })),
    }));
  }
  return {
    metadata: metadata({ ...opts, dimension }),
    granularity,
    total: money(TOTAL),
    currency: CURRENCY,
    data,
    by_dimension,
  };
}

/**
 * Resolve a dimension name to a set of groups derived from the fact table, so
 * every grouping reconciles to TOTAL. Supported canonical dimensions:
 * service, account, region, environment. Anything else falls back to account.
 */
function dimensionGroups(dimension) {
  const keyFor = {
    service: (f) => f.service,
    account: (f) => f.accountId,
    region: (f) => f.region,
    environment: (f) => ACCOUNTS.find((a) => a.id === f.accountId).environment,
  };
  const keyFn = keyFor[dimension] || keyFor.account;
  const byValue = new Map();
  const byValueMonth = new Map();
  for (const f of FACTS) {
    const v = keyFn(f);
    byValue.set(v, round2((byValue.get(v) || 0) + f.amount));
    if (!byValueMonth.has(v)) byValueMonth.set(v, new Map());
    const mm = byValueMonth.get(v);
    mm.set(f.month, round2((mm.get(f.month) || 0) + f.amount));
  }
  return [...byValue.entries()].map(([value, amount]) => ({
    value,
    amount,
    byMonth: byValueMonth.get(value),
  }));
}

/** GET /api/v1/cost-views/by-dimension → CostByDimensionResponse */
export function costByDimension(dimension = "service", opts = {}) {
  const groups = dimensionGroups(dimension);
  return {
    metadata: metadata({ ...opts, dimension }),
    total: money(TOTAL),
    currency: CURRENCY,
    data: groups.map((g) => ({
      dimension_value: g.value,
      amount: money(g.amount),
      currency: CURRENCY,
      percentage: (round2((g.amount / TOTAL) * 100)).toFixed(2),
    })),
  };
}

/** GET /api/v1/cost-views/trends → TrendResponse (current vs previous period) */
export function costTrends(dimension = "service", period = "month") {
  const months = DEMO_WINDOW.months;
  const cur = months[months.length - 1];
  const prev = months[months.length - 2];
  const groups = dimensionGroups(dimension).map((g) => {
    const current = g.byMonth.get(cur) || 0;
    const previous = g.byMonth.get(prev) || 0;
    const change = round2(current - previous);
    return {
      dimension_value: g.value,
      current_amount: money(current),
      previous_amount: money(previous),
      absolute_change: money(change),
      percentage_change: previous === 0 ? null : (round2((change / previous) * 100)).toFixed(2),
      currency: CURRENCY,
    };
  });
  return {
    metadata: metadata({ dimension }),
    period,
    current_period_start: `${cur}-01`,
    current_period_end: monthEnd(cur),
    previous_period_start: `${prev}-01`,
    previous_period_end: monthEnd(prev),
    data: groups,
  };
}

/** GET /api/v1/cost-explorer/cost-by-service → CostByServiceResponse (flat envelope) */
export function costByService(accountId = null, granularity = "MONTHLY") {
  const rows = accountId ? FACTS.filter((f) => f.accountId === accountId) : FACTS;
  const byServiceMonth = new Map();
  for (const f of rows) {
    const key = `${f.service}__${f.month}`;
    byServiceMonth.set(key, round2((byServiceMonth.get(key) || 0) + f.amount));
  }
  const data = [];
  for (const m of DEMO_WINDOW.months) {
    for (const s of SERVICES) {
      const amt = byServiceMonth.get(`${s.name}__${m}`);
      if (amt === undefined) continue;
      data.push({ start: `${m}-01`, end: monthEnd(m), amount: money(amt), currency: CURRENCY, service: s.name });
    }
  }
  return {
    account_id: accountId || ACCOUNTS[0].id,
    start_date: DEMO_WINDOW.start,
    end_date: DEMO_WINDOW.end,
    granularity,
    data,
  };
}

// --- budgets ----------------------------------------------------------------

const STATUS_FOR = (pct) => (pct >= 100 ? "exceeded" : pct >= 80 ? "at_risk" : "on_track");

// Budgets are defined against canonical dimension values; current_spend is the
// current-month actual from the fact table, so budget figures match the charts.
const BUDGET_DEFS = [
  { id: "b1000000-0000-4000-8000-000000000001", name: "Production monthly", dimension: "environment", dimension_value: "production", amount: 40000 },
  { id: "b1000000-0000-4000-8000-000000000002", name: "EC2 monthly", dimension: "service", dimension_value: "Amazon Elastic Compute Cloud - Compute", amount: 9000 },
  { id: "b1000000-0000-4000-8000-000000000003", name: "Data platform monthly", dimension: "account", dimension_value: "330815562947", amount: 12000 },
];

function currentMonthSpend(dimension, value) {
  const cur = DEMO_WINDOW.months[DEMO_WINDOW.months.length - 1];
  const keyFor = {
    environment: (f) => ACCOUNTS.find((a) => a.id === f.accountId).environment,
    service: (f) => f.service,
    account: (f) => f.accountId,
  };
  const keyFn = keyFor[dimension] || keyFor.account;
  return round2(FACTS.filter((f) => f.month === cur && keyFn(f) === value).reduce((a, f) => a + f.amount, 0));
}

function topDrivers(dimension, value, spend) {
  const cur = DEMO_WINDOW.months[DEMO_WINDOW.months.length - 1];
  const keyFor = {
    environment: (f) => ACCOUNTS.find((a) => a.id === f.accountId).environment,
    service: (f) => f.service,
    account: (f) => f.accountId,
  };
  const keyFn = keyFor[dimension] || keyFor.account;
  const rows = FACTS.filter((f) => f.month === cur && keyFn(f) === value);
  const byService = new Map();
  for (const f of rows) byService.set(f.service, round2((byService.get(f.service) || 0) + f.amount));
  return [...byService.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dv, amt]) => ({ dimension_value: dv, amount: money(amt), percentage: (round2((amt / (spend || 1)) * 100)).toFixed(2) }));
}

function budgetDetail(def) {
  const spend = currentMonthSpend(def.dimension, def.dimension_value);
  const pct = round2((spend / def.amount) * 100);
  const projected = round2(spend * 1.18);
  return {
    id: def.id,
    workspace_id: "00000000-0000-0000-0000-000000000000",
    name: def.name,
    amount: money(def.amount),
    currency: CURRENCY,
    period: "monthly",
    dimension: def.dimension,
    dimension_value: def.dimension_value,
    alert_thresholds: [50, 80, 100],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    current_spend: money(spend),
    percentage_consumed: pct.toFixed(2),
    projected_spend: money(projected),
    remaining: money(def.amount - spend),
    status: STATUS_FOR(pct),
    days_elapsed: 27,
    days_in_period: 31,
    top_cost_drivers: topDrivers(def.dimension, def.dimension_value, spend),
  };
}

/** GET /api/v1/budgets → BudgetListResponse */
export function budgetsList() {
  const budgets = BUDGET_DEFS.map(budgetDetail);
  return { budgets, count: budgets.length };
}

/** GET /api/v1/budgets/:id → BudgetDetailResponse (or null when unknown) */
export function budgetById(id) {
  const def = BUDGET_DEFS.find((b) => b.id === id);
  return def ? budgetDetail(def) : null;
}

/** GET /api/v1/budgets/:id/alerts → FindingListResponse */
export function budgetAlerts(id) {
  const detail = budgetById(id);
  if (!detail) return { findings: [], count: 0 };
  const findings = [];
  const pct = Number(detail.percentage_consumed);
  if (pct >= 80) {
    findings.push({
      id: `${id}-threshold`,
      workspace_id: detail.workspace_id,
      type: "anomaly",
      severity: pct >= 100 ? "critical" : "high",
      status: "open",
      title: `${detail.name} at ${detail.percentage_consumed}% of budget`,
      description: `Spend ${detail.current_spend} of ${detail.amount} ${CURRENCY}.`,
      resource_id: `budget:${id}:threshold`,
      detection_source: "budget_evaluation",
      suggested_action: "Review top cost drivers and adjust the budget or usage.",
      estimated_cost_impact: detail.remaining,
      suppression_reason: null,
      detected_at: "2026-05-27T08:00:00Z",
      last_seen_at: "2026-05-27T08:00:00Z",
      acknowledged_at: null,
      resolved_at: null,
      created_at: "2026-05-27T08:00:00Z",
      updated_at: "2026-05-27T08:00:00Z",
    });
  }
  return { findings, count: findings.length };
}

// Internal handles for tests / cross-domain reconciliation.
export const __cost = { FACTS, TOTAL };
