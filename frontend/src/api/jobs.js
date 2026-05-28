/**
 * API client for background-job + ingestion endpoints.
 *
 * Mirrors the request/response shapes defined in backend/src/numio/api/jobs.py
 * and backend/src/numio/schemas/jobs.py.
 */
import { request } from "./client";

/** List all registered job types and their schedules. */
export async function listJobTypes() {
  return request("/api/v1/jobs/types");
}

/** Get recent job-run history. */
export async function getJobHistory(limit = 20) {
  return request("/api/v1/jobs/history", { params: { limit } });
}

/** Trigger a job on demand (admin only). */
export async function triggerJob(jobType) {
  return request(`/api/v1/jobs/${encodeURIComponent(jobType)}/trigger`, {
    method: "POST",
  });
}

/** Per-account × per-data-source ingestion status. */
export async function getIngestionStatus() {
  return request("/api/v1/jobs/ingestion-status");
}
