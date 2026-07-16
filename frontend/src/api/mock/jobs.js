/**
 * Mock handlers for the jobs API domain — mirrors src/api/jobs.js.
 */
import * as platform from "../../mocks/synthetic/platform";

export const jobsHandlers = [
  { method: "GET", path: "/api/v1/jobs/types", handler: () => platform.jobTypes() },
  { method: "GET", path: "/api/v1/jobs/history", handler: ({ query }) => platform.jobHistory(query.limit ? Number(query.limit) : 20) },
  { method: "GET", path: "/api/v1/jobs/ingestion-status", handler: () => platform.ingestionStatus() },
  {
    method: "POST",
    path: "/api/v1/jobs/:jobType/trigger",
    handler: ({ params }) => ({ job_run_id: `run-${params.jobType}-now`, job_type: params.jobType, status: "queued" }),
  },
];
