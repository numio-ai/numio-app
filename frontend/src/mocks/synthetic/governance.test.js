import { describe, it, expect } from "vitest";
import { ACCOUNTS, SERVICES, REGIONS } from "./entities";
import { reconciles, isDeterministic } from "./consistency";
import {
  resourcesList,
  findingsList,
  findingById,
  recommendationsList,
  recommendationById,
  savingsSummary,
  savingsTimeline,
  infraPoliciesList,
  infraPolicyById,
  complianceSummary,
  nonCompliantList,
  complianceByDimension,
  tagApplyPreview,
  __gov,
} from "./governance";

const num = (s) => Number(s);
const inventoryProviderIds = new Set(__gov.INVENTORY.map((r) => r.resource_id));
const inventoryUuids = new Set(__gov.INVENTORY.map((r) => r.id));

describe("synthetic governance — shapes & wrappers", () => {
  it("resources use {resources,count}; cost is a number (float)", () => {
    const r = resourcesList();
    expect(r.count).toBe(r.resources.length);
    expect(typeof r.resources[0].cost).toBe("number");
  });

  it("findings/recommendations/policies use their named wrappers", () => {
    expect(findingsList().count).toBe(findingsList().findings.length);
    expect(recommendationsList().count).toBe(recommendationsList().recommendations.length);
    expect(infraPoliciesList().count).toBe(infraPoliciesList().policies.length);
  });

  it("finding detail carries a transitions array", () => {
    const ack = __gov.FINDINGS.find((f) => f.status !== "open");
    expect(Array.isArray(findingById(ack.id).transitions)).toBe(true);
  });
});

describe("synthetic governance — canonical references (AC2)", () => {
  it("every resource references a canonical account, service, region", () => {
    const accts = new Set(ACCOUNTS.map((a) => a.id));
    const svcs = new Set(SERVICES.map((s) => s.name));
    const regs = new Set(REGIONS.map((r) => r.code));
    for (const r of resourcesList().resources) {
      expect(accts.has(r.account_id)).toBe(true);
      expect(svcs.has(r.service)).toBe(true);
      expect(regs.has(r.region)).toBe(true);
    }
  });
});

describe("synthetic governance — cross-domain integrity (AC3)", () => {
  it("every finding references an inventory resource", () => {
    for (const f of findingsList().findings) expect(inventoryProviderIds.has(f.resource_id)).toBe(true);
  });

  it("every recommendation targets an inventory resource", () => {
    for (const r of recommendationsList().recommendations) expect(inventoryProviderIds.has(r.resource_id)).toBe(true);
  });

  it("policy violations reference inventory resources", () => {
    const p = infraPoliciesList().policies[0];
    for (const v of infraPolicyById(p.id).violations) expect(inventoryProviderIds.has(v.resource_id)).toBe(true);
  });

  it("non-compliant results reference inventory resource UUIDs", () => {
    for (const r of nonCompliantList().results) expect(inventoryUuids.has(r.resource_id)).toBe(true);
  });

  it("recommendation savings sum to the savings-summary totals", () => {
    const summary = savingsSummary();
    const recTotal = recommendationsList().recommendations.reduce((a, r) => a + num(r.estimated_monthly_savings), 0);
    expect(reconciles(num(summary.total_estimated_monthly_savings), [recTotal])).toBe(true);
    for (const cat of summary.by_category) {
      const catTotal = recommendationsList({ category: cat.category }).recommendations.reduce(
        (a, r) => a + num(r.estimated_monthly_savings),
        0,
      );
      expect(reconciles(num(cat.estimated_monthly_savings), [catTotal])).toBe(true);
    }
  });

  it("savings timeline cumulative ends at total actual savings", () => {
    const tl = savingsTimeline().entries;
    if (tl.length) {
      expect(reconciles(num(savingsSummary().total_actual_savings), [num(tl[tl.length - 1].cumulative_savings)])).toBe(true);
    }
  });
});

describe("synthetic governance — plausibility (AC4) & determinism (AC5)", () => {
  it("a recommendation's monthly saving never exceeds its resource's monthly cost", () => {
    const byProvider = new Map(__gov.INVENTORY.map((r) => [r.resource_id, r.cost]));
    for (const r of recommendationsList().recommendations) {
      expect(num(r.estimated_monthly_savings)).toBeLessThanOrEqual(byProvider.get(r.resource_id));
    }
  });

  it("compliance summary resource counts are internally consistent", () => {
    const s = complianceSummary();
    expect(s.total_resources).toBe(s.compliant_resources + s.non_compliant_resources);
  });

  it("by-dimension compliance references only canonical accounts", () => {
    const accts = new Set(ACCOUNTS.map((a) => a.id));
    for (const sc of complianceByDimension("account").scores) expect(accts.has(sc.dimension_value)).toBe(true);
  });

  it("tag-apply preview affected resources reference inventory and expose monthly_cost as a float", () => {
    for (const a of tagApplyPreview().affected_resources) {
      expect(inventoryUuids.has(a.resource_id)).toBe(true);
      expect(typeof a.monthly_cost).toBe("number");
    }
  });

  it("two generations produce byte-identical output", () => {
    expect(
      isDeterministic(() => ({
        resources: resourcesList(),
        findings: findingsList(),
        recs: recommendationsList(),
        summary: savingsSummary(),
        compliance: complianceSummary(),
        nonCompliant: nonCompliantList(),
      })),
    ).toBe(true);
  });
});
