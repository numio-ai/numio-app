/**
 * API client for tag governance endpoints (policies, compliance, campaigns).
 */
import { request } from "./client";

// ---------------------------------------------------------------------------
// Tag Policies
// ---------------------------------------------------------------------------

export async function listPolicies() {
  return request("/api/v1/tag-policies");
}

export async function getPolicy(id) {
  return request(`/api/v1/tag-policies/${id}`);
}

export async function createPolicy(data) {
  return request("/api/v1/tag-policies", {
    method: "POST",
    json: data,
  });
}

export async function updatePolicy(id, data) {
  return request(`/api/v1/tag-policies/${id}`, {
    method: "PUT",
    json: data,
  });
}

export async function deletePolicy(id) {
  return request(`/api/v1/tag-policies/${id}`, { method: "DELETE" });
}

export async function previewPolicy(data) {
  return request("/api/v1/tag-policies/preview", {
    method: "POST",
    json: data,
  });
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

export async function triggerAudit() {
  return request("/api/v1/compliance/audit", { method: "POST" });
}

export async function getComplianceSummary() {
  return request("/api/v1/compliance/summary");
}

export async function getComplianceByDimension(dimension) {
  return request(`/api/v1/compliance/by-dimension?dimension=${dimension}`);
}

export async function listNonCompliant({ limit = 100, offset = 0, sortByCost = true } = {}) {
  return request("/api/v1/compliance/non-compliant", {
    params: { limit, offset, sort_by_cost: sortByCost },
  });
}

export async function getComplianceTrend({ dimension = "overall", dimensionValue, limit = 90 } = {}) {
  return request("/api/v1/compliance/trend", {
    params: { dimension, limit, dimension_value: dimensionValue || undefined },
  });
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function listCampaigns({ limit = 50, offset = 0 } = {}) {
  return request("/api/v1/campaigns", { params: { limit, offset } });
}

export async function getCampaign(id) {
  return request(`/api/v1/campaigns/${id}`);
}

export async function createCampaign(data) {
  return request("/api/v1/campaigns", {
    method: "POST",
    json: data,
  });
}

export async function updateCampaign(id, data) {
  return request(`/api/v1/campaigns/${id}`, {
    method: "PATCH",
    json: data,
  });
}

export async function updateResourceStatus(campaignId, resourceId, status) {
  return request(`/api/v1/campaigns/${campaignId}/resources/${resourceId}/status`, {
    method: "PATCH",
    json: { status },
  });
}

export async function getCampaignProgress(id) {
  return request(`/api/v1/campaigns/${id}/progress`);
}

export async function getResourceCommands(campaignId, resourceId) {
  return request(`/api/v1/campaigns/${campaignId}/resources/${resourceId}/commands`);
}

// ---------------------------------------------------------------------------
// Tag apply / preview
// ---------------------------------------------------------------------------

/**
 * Preview a tag apply. `changes` is a list of { resource_id, tag_key, value }
 * where value=null means "remove the tag". Returns
 * { risky, reasons, affected_resources }; performs no write.
 */
export async function previewTagApply(changes) {
  return request("/api/v1/tags/apply/preview", {
    method: "POST",
    json: { changes },
  });
}

/**
 * Apply tag changes. Returns the action-event result
 * { event_id, status, summary }. `status` is one of
 * success | partial_failure | failure. Set confirmRisky=true to proceed past
 * a risky-write gate (env=production or aggregate cost > $1000).
 */
export async function applyTags({ changes, rationale = null, confirmRisky = false }) {
  return request("/api/v1/tags/apply", {
    method: "POST",
    json: { changes, rationale, confirm_risky: confirmRisky },
  });
}

// ---------------------------------------------------------------------------
// AWS Organizations tag policy
// ---------------------------------------------------------------------------

/** List synced AWS Org tag policy rules → { policies, count }. */
export async function listAwsOrgTagPolicy() {
  return request("/api/v1/aws-org-tag-policy");
}

/** Trigger an on-demand AWS Org tag policy sync (admin) → { rows_upserted, message }. */
export async function syncAwsOrgTagPolicy() {
  return request("/api/v1/aws-org-tag-policy/sync", { method: "POST" });
}

/**
 * List schema conflicts between Numio tag policies and the AWS Org tag policy →
 * { conflicts, count }. Each conflict carries { tag_key, conflict_type, detail }.
 */
export async function listSchemaConflicts() {
  return request("/api/v1/tags/schema/conflicts");
}
