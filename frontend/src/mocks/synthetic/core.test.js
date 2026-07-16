import { describe, it, expect } from "vitest";
import {
  ACCOUNTS,
  SERVICES,
  REGIONS,
  DEMO_WINDOW,
  accountById,
  serviceByName,
  CORE_SEED,
  makeRng,
  rngInt,
  rngPick,
  allocate,
  round2,
  sum,
  reconciles,
  reconcilesField,
  resolvesIdentically,
  isDeterministic,
} from "./index";

// A representative sample dataset built the way the domain datasets will:
// a seeded period total split into by-service and by-account breakdowns plus
// daily time-series buckets, all sourced from canonical entities. Exercises
// the harness end to end (spec §5).
function buildSample() {
  const rng = makeRng(CORE_SEED);
  const total = round2(rngInt(rng, 80000, 120000) + rng());

  const byService = SERVICES.map((s) => ({ service: s.name, weight: rngInt(rng, 1, 20) }));
  const serviceAmounts = allocate(total, byService.map((x) => x.weight));
  byService.forEach((x, i) => {
    x.cost = serviceAmounts[i];
    delete x.weight;
  });

  const byAccount = ACCOUNTS.map((a) => ({ accountId: a.id, weight: rngInt(rng, 1, 10) }));
  const accountAmounts = allocate(total, byAccount.map((x) => x.weight));
  byAccount.forEach((x, i) => {
    x.cost = accountAmounts[i];
    delete x.weight;
  });

  const dayWeights = DEMO_WINDOW.months.map(() => rngInt(rng, 1, 30));
  const tsAmounts = allocate(total, dayWeights);
  const timeSeries = DEMO_WINDOW.months.map((m, i) => ({ period: m, cost: tsAmounts[i] }));

  return { total, byService, byAccount, timeSeries };
}

describe("synthetic core — canonical entities", () => {
  it("account IDs are 12-digit numerics", () => {
    expect(ACCOUNTS.length).toBeGreaterThan(0);
    for (const a of ACCOUNTS) expect(a.id).toMatch(/^\d{12}$/);
  });

  it("service names are real AWS service names", () => {
    expect(serviceByName("Amazon Elastic Compute Cloud - Compute")).toBeTruthy();
    for (const s of SERVICES) expect(s.name.length).toBeGreaterThan(0);
  });

  it("region codes match the AWS region code pattern", () => {
    for (const r of REGIONS) expect(r.code).toMatch(/^[a-z]{2}-[a-z]+-\d$/);
  });

  it("demo window is a fixed absolute range, not derived from today", () => {
    expect(DEMO_WINDOW.start).toBe("2026-01-01");
    expect(DEMO_WINDOW.end).toBe("2026-05-31");
    expect(DEMO_WINDOW.months).toHaveLength(5);
  });
});

describe("synthetic core — harness on sample data", () => {
  it("aggregates reconcile: every breakdown sums to the period total", () => {
    const { total, byService, byAccount, timeSeries } = buildSample();
    expect(reconcilesField(total, byService, "cost")).toBe(true);
    expect(reconcilesField(total, byAccount, "cost")).toBe(true);
    expect(reconcilesField(total, timeSeries, "cost")).toBe(true);
    // allocate() is exact to the cent.
    expect(sum(byService.map((x) => x.cost))).toBeCloseTo(total, 2);
  });

  it("the same canonical entity resolves identically across screens", () => {
    const { byAccount } = buildSample();
    const id = byAccount[0].accountId;
    const fromBreakdown = accountById(id);
    const fromRegistry = ACCOUNTS.find((a) => a.id === id);
    expect(resolvesIdentically([fromBreakdown, fromRegistry])).toBe(true);
  });
});

describe("synthetic core — determinism", () => {
  it("generates byte-identical output across two runs", () => {
    expect(isDeterministic(buildSample)).toBe(true);
  });

  it("two independent RNGs from the same seed yield the same sequence", () => {
    const a = makeRng(CORE_SEED);
    const b = makeRng(CORE_SEED);
    const seqA = Array.from({ length: 8 }, () => rngInt(a, 0, 1000));
    const seqB = Array.from({ length: 8 }, () => rngInt(b, 0, 1000));
    expect(seqA).toEqual(seqB);
    expect(rngPick(makeRng(CORE_SEED), SERVICES)).toEqual(rngPick(makeRng(CORE_SEED), SERVICES));
  });
});
