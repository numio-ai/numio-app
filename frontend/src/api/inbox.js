/**
 * API client for IA v2 Inbox endpoints (badge counts, finding acks).
 */
import { request } from "./client";

/**
 * Fetch the inbox badge counts.
 * Returns { unread_count, triage_count, critical_count, fetched_at }.
 */
export async function fetchInboxBadge() {
  return request("/api/v1/inbox/badge");
}

/**
 * Acknowledge a finding. Idempotent — re-acking returns the same unread count.
 * Returns { finding_id, acknowledged, new_unread_count }.
 */
export async function ackFinding(findingId) {
  return request(`/api/v1/inbox/findings/${findingId}/ack`, { method: "POST" });
}
