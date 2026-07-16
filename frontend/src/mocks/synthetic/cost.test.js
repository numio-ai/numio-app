import { describe, it, expect } from "vitest";
import { SERVICES, REGIONS, ACCOUNTS, DEMO_WINDOW } from "./entities";
import { reconciles, reconcilesField, isDeterministic, sum } from "./consistency";
import {
  costTotal,
  costTimeSeries,
  costByDimension,
  costTrends,
  costByService,
  budgetsList,
  budgetById,
  budgetAlerts,
  __cost,
} from "./cost";

const num = (s) => Number(s);
const TOTAL = num(costTotal().total);

describe("synthetic cost — shapes", () => {
  it("costTotal returns the cost-views metadata envelope", () => {
    const r = costTotal();
    expect(r).toHaveProperty("metadata.start_date", DEMO_WINDOW.start);
    expect(typeof r.total).toBe("string");
    expect(r.currency).toBe("USD");
    expect(Array.isArray(r.data)).toBe(true);
  });

  it("budgets use the {budgets,count} wrapper with snake_case status", () => {
    const r = budgetsList();
    expect(r.count).toBe(r.budgets.length);
    for (const b of r.budgets) expect(["on_track", "at_risk", "exceeded"]).toContain(b.status);
  });

  it("costByService uses the flat cost-explorer envelope with uppercase granularity", () => {
    const r = costByService(ACCOUNTS[0].id);
    expect(r.account_id).toBe(ACCOUNTS[0].id);
    expect(r.granularity).toBe("MONTHLY");
    expect(r).not.toHaveProperty("metadata");
  });
});

describe("synthetic cost — reconciliation (AC4)", () => {
  it("monthly time-series buckets sum to the period total", () => {
    expect(reconcilesField(TOTAL, costTotal().data.map((d) => ({ a: num(d.amount) })), "a")).toBe(true);
  });

  it("daily time-series buckets sum to the period total", () => {
    const daily = costTimeSeries({ granularity: "daily" }).data;
    expect(reconciles(TOTAL, daily.map((d) => num(d.amount)))).toBe(true);
  });

  it("by-service / by-account / by-region / by-environment each sum to the total", () => {
    for (const dim of ["service", "account", "region", "environment"]) {
      const data = costByDimension(dim).data;
      expect(reconciles(TOTAL, data.map((d) => num(d.amount)))).toBe(true);
    }
  });

  it("by_dimension nested time-series totals reconcile to the total", () => {
    const r = costTimeSeries({ granularity: "monthly", dimension: "service" });
    const all = r.by_dimension.flatMap((g) => g.data.map((d) => num(d.amount)));
    expect(reconciles(TOTAL, all)).toBe(true);
  });

  it("trends current/previous amounts are internally consistent with per-period totals", () => {
    const r = costTrends("service", "month");
    const curTotal = sum(r.data.map((d) => num(d.current_amount)));
    const months = DEMO_WINDOW.months;
    const factCurTotal = sum(
      __cost.FACTS.filter((f) => f.month === months[months.length - 1]).map((f) => f.amount),
    );
    expect(reconciles(factCurTotal, [curTotal])).toBe(true);
  });
});

describe("synthetic cost — plausibility (AC5)", () => {
  it("service names come only from the canonical set", () => {
    const canonical = new Set(SERVICES.map((s) => s.name));
    for (const row of costByService().data) expect(canonical.has(row.service)).toBe(true);
  });

  it("carries positive usage and at least one negative credit line", () => {
    expect(__cost.FACTS.some((f) => f.amount > 0)).toBe(true);
    expect(__cost.FACTS.some((f) => f.amount < 0)).toBe(true);
  });

  it("the covered window matches the core demo window", () => {
    const r = costTotal();
    expect(r.metadata.start_date).toBe(DEMO_WINDOW.start);
    expect(r.metadata.end_date).toBe(DEMO_WINDOW.end);
  });

  it("region grouping references only canonical regions", () => {
    const canonical = new Set(REGIONS.map((r) => r.code));
    for (const row of costByDimension("region").data) expect(canonical.has(row.dimension_value)).toBe(true);
  });
});

describe("synthetic cost — determinism (AC7) + budget detail", () => {
  it("two generations produce byte-identical output", () => {
    expect(isDeterministic(() => ({ costTotal: costTotal(), byService: costByService(), budgets: budgetsList() }))).toBe(true);
  });

  it("budgetById current_spend matches the current-month actual; alerts gate on threshold", () => {
    const b = budgetsList().budgets[0];
    expect(budgetById(b.id).current_spend).toBe(b.current_spend);
    const alerts = budgetAlerts(b.id);
    if (Number(b.percentage_consumed) >= 80) expect(alerts.count).toBeGreaterThan(0);
    else expect(alerts.count).toBe(0);
  });
});
