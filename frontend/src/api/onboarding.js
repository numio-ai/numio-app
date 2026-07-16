/**
 * API client for the AWS onboarding hub — CFN template generator and
 * server-side feature flags.
 */

import { request } from "./client";

// Retained: getCfnTemplateDownloadUrl builds a browser-download URL directly.
const BASE = import.meta.env.VITE_API_URL || "";

/**
 * Return onboarding feature flags (currently: chat_enabled).
 */
export async function getOnboardingFeatures() {
  return request("/api/v1/onboarding/features");
}

/**
 * Generate a per-tenant CloudFormation template.
 *
 * @param {object} params
 * @param {string}  params.label          mandatory per-instance label
 * @param {string} [params.region]
 * @param {string} [params.curMode]       "existing" (default) or "create_new"
 * @param {string} [params.curBucketName]
 * @param {string} [params.curReportName]
 * @param {string} [params.curPathPrefix]
 */
export async function getCfnTemplate({
  label,
  region = "us-east-1",
  curMode = "existing",
  curBucketName = "",
  curReportName = "",
  curPathPrefix = "cur",
  enableTagWrites = false,
} = {}) {
  const qs = new URLSearchParams({
    label: label ?? "",
    region,
    cur_mode: curMode,
    cur_bucket_name: curBucketName,
    cur_report_name: curReportName,
    cur_path_prefix: curPathPrefix,
    enable_tag_writes: enableTagWrites ? "true" : "false",
  });
  return request(`/api/v1/onboarding/cfn-template?${qs.toString()}`);
}

/**
 * Return the absolute URL a browser should hit to download the CFN template
 * as a `.yaml` file. Used by the Guided wizard's "Download template" link.
 */
export function getCfnTemplateDownloadUrl({
  label,
  region = "us-east-1",
  curMode = "existing",
  curBucketName = "",
  curReportName = "",
  curPathPrefix = "cur",
  enableTagWrites = false,
} = {}) {
  const qs = new URLSearchParams({
    label: label ?? "",
    region,
    cur_mode: curMode,
    cur_bucket_name: curBucketName,
    cur_report_name: curReportName,
    cur_path_prefix: curPathPrefix,
    enable_tag_writes: enableTagWrites ? "true" : "false",
  });
  return `${BASE}/api/v1/onboarding/cfn-template/download?${qs.toString()}`;
}

/**
 * Fetch the workspace's in-progress Guided onboarding state, or `null` when
 * none exists (HTTP 204).
 */
export async function getOnboardingInProgress() {
  return request("/api/v1/onboarding/in-progress");
}

/**
 * Idempotent upsert for the workspace's in-progress Guided onboarding state.
 *
 * @param {object} body
 * @param {string} body.label  per-instance label captured at Customize
 * @param {string} body.step   one of: customize | apply | waiting | verify
 */
export async function putOnboardingInProgress({ label, step }) {
  return request("/api/v1/onboarding/in-progress", {
    method: "PUT",
    body: JSON.stringify({ label, step }),
  });
}

/**
 * Delete the workspace's in-progress Guided onboarding state. Idempotent —
 * 204 whether or not a record existed.
 *
 * Bounded by a client-side timeout so the cancel-onboarding modal cannot
 * hang on a slow or unreachable backend. On timeout the underlying fetch is
 * aborted and the call rejects with an AbortError — the caller surfaces it
 * to the user and offers a retry.
 */
export async function deleteOnboardingInProgress({ timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request("/api/v1/onboarding/in-progress", {
      method: "DELETE",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
