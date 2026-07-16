/**
 * Mock handlers for the onboarding API domain — mirrors src/api/onboarding.js.
 * (getCfnTemplateDownloadUrl bypasses request() and is a known mock-mode
 * limitation per spec §4.5 — not handled here.)
 */
import { store } from "./store.js";
import * as platform from "../../mocks/synthetic/platform";

const EXTERNAL_ID = "c0ffee00-0000-4000-8000-000000000001";

export const onboardingHandlers = [
  { method: "GET", path: "/api/v1/onboarding/features", handler: () => platform.onboardingFeatures() },
  {
    method: "GET",
    path: "/api/v1/onboarding/cfn-template",
    handler: ({ query }) => ({
      stack_name: "numio-onboarding",
      region: query.region || "us-east-1",
      external_id: EXTERNAL_ID,
      label: query.label || "",
      template_format: "yaml",
      template_body: "AWSTemplateFormatVersion: '2010-09-09'\nResources: {}\n",
      launch_url: "",
      launch_mode: "upload",
      download_url: "/api/v1/onboarding/cfn-template/download",
    }),
  },
  { method: "GET", path: "/api/v1/onboarding/in-progress", handler: () => store.onboardingInProgress() },
  { method: "PUT", path: "/api/v1/onboarding/in-progress", handler: ({ body }) => store.putOnboardingInProgress(body || {}) },
  { method: "DELETE", path: "/api/v1/onboarding/in-progress", handler: () => { store.deleteOnboardingInProgress(); return null; } },
];
