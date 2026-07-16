/**
 * Mock handlers for the tag-governance API domain — mirrors src/api/tagGovernance.js.
 * (compliance/summary and compliance/non-compliant are registered by the
 * dashboard domain; both modules call the same paths and parity is by path.)
 */
import { store } from "./store.js";
import { notFound } from "./errors.js";
import * as gov from "../../mocks/synthetic/governance";

const WS = "00000000-0000-0000-0000-000000000000";

function campaignResource(r, i) {
  return {
    id: `cr-${i}`,
    resource_id: r.id, // uuid
    remediation_status: i === 0 ? "fixed" : "pending",
    inferred_owner: "demo@numio.ai",
    violated_rules: { ManagedBy: "missing" },
    tag_commands: [`aws ec2 create-tags --resources ${r.resource_id} --tags Key=ManagedBy,Value=terraform`],
    resource_cost: r.cost.toFixed(2),
    status_updated_at: "2026-05-26T00:00:00Z",
    created_at: "2026-05-20T00:00:00Z",
    resource_name: r.name,
    resource_arn: r.arn,
    resource_type: `${r.service}/${r.resource_type}`,
    account_id: r.account_id,
    service: r.service,
  };
}

function campaignDetail(id) {
  const c = gov.campaignsList().campaigns[0];
  const resources = gov.__gov.NON_COMPLIANT.map(campaignResource);
  return { ...c, id, resources };
}

export const tagGovernanceHandlers = [
  // tag policies (mutable via store)
  { method: "GET", path: "/api/v1/tag-policies", handler: () => ({ policies: store.tagPolicies(), count: store.tagPolicies().length }) },
  { method: "GET", path: "/api/v1/tag-policies/:id", handler: ({ params }) => store.tagPolicy(params.id) || notFound("Policy") },
  { method: "POST", path: "/api/v1/tag-policies", handler: ({ body }) => store.createTagPolicy(body || {}) },
  { method: "PUT", path: "/api/v1/tag-policies/:id", handler: ({ params, body }) => store.updateTagPolicy(params.id, body || {}) || notFound("Policy") },
  { method: "DELETE", path: "/api/v1/tag-policies/:id", handler: ({ params }) => { store.deleteTagPolicy(params.id); return null; } },
  // previewPolicy: backend route does not exist; no consumer. Registered for parity.
  { method: "POST", path: "/api/v1/tag-policies/preview", handler: () => ({ affected_resources: [], rule_count: 0 }) },

  // compliance (tag-governance side)
  { method: "POST", path: "/api/v1/compliance/audit", handler: () => ({ job_run_id: "audit-run-now", status: "queued", message: "Audit triggered" }) },
  { method: "GET", path: "/api/v1/compliance/by-dimension", handler: ({ query }) => gov.complianceByDimension(query.dimension || "account") },
  { method: "GET", path: "/api/v1/compliance/trend", handler: () => gov.complianceTrend() },

  // campaigns
  { method: "GET", path: "/api/v1/campaigns", handler: () => gov.campaignsList() },
  { method: "POST", path: "/api/v1/campaigns", handler: ({ body }) => ({ ...gov.campaignsList().campaigns[0], ...(body || {}), id: "new-campaign", resources: [] }) },
  { method: "GET", path: "/api/v1/campaigns/:id", handler: ({ params }) => campaignDetail(params.id) },
  { method: "PATCH", path: "/api/v1/campaigns/:id", handler: ({ params, body }) => ({ ...gov.campaignsList().campaigns[0], ...body, id: params.id }) },
  {
    method: "GET",
    path: "/api/v1/campaigns/:id/progress",
    handler: ({ params }) => ({
      campaign_id: params.id,
      total_resources: gov.__gov.NON_COMPLIANT.length,
      status_breakdown: [
        { status: "fixed", count: 1, percentage: "33.33" },
        { status: "pending", count: Math.max(gov.__gov.NON_COMPLIANT.length - 1, 0), percentage: "66.67" },
      ],
      before_compliance_score: "72.00",
      current_compliance_score: "80.00",
    }),
  },
  {
    method: "PATCH",
    path: "/api/v1/campaigns/:cId/resources/:rId/status",
    handler: ({ params, body }) => {
      const r = gov.__gov.NON_COMPLIANT.find((x) => x.id === params.rId) || gov.__gov.NON_COMPLIANT[0];
      return { ...campaignResource(r, 0), remediation_status: body?.status || "fixed" };
    },
  },
  {
    method: "GET",
    path: "/api/v1/campaigns/:cId/resources/:rId/commands",
    handler: ({ params }) => {
      const r = gov.__gov.NON_COMPLIANT.find((x) => x.id === params.rId) || gov.__gov.NON_COMPLIANT[0];
      return { resource_id: r.id, resource_arn: r.arn, resource_type: `${r.service}/${r.resource_type}`, commands: [`aws ec2 create-tags --resources ${r.resource_id} --tags Key=ManagedBy,Value=terraform`] };
    },
  },

  // tag apply
  { method: "POST", path: "/api/v1/tags/apply/preview", handler: () => gov.tagApplyPreview() },
  { method: "POST", path: "/api/v1/tags/apply", handler: () => ({ event_id: "apply-event-now", status: "success", summary: { item_count: 3, success_count: 3, failure_count: 0 } }) },

  // AWS Org tag policy + schema conflicts
  { method: "GET", path: "/api/v1/aws-org-tag-policy", handler: () => gov.awsOrgTagPolicyList() },
  { method: "POST", path: "/api/v1/aws-org-tag-policy/sync", handler: () => ({ rows_upserted: gov.awsOrgTagPolicyList().count, message: "Synced" }) },
  { method: "GET", path: "/api/v1/tags/schema/conflicts", handler: () => gov.schemaConflictsList() },
];
