/**
 * Mock handler registry and dispatcher (spec §3.3).
 *
 * `request()` in ../client.js dynamically imports this module only in mock mode,
 * so it (and everything it pulls in: handlers, store, synthetic data) is dead
 * code in a real build and is tree-shaken out.
 *
 * One handler file per API domain mirrors the API-module structure (AC6).
 */
import { ApiError } from "../client.js";
import { matchRoute } from "./matcher.js";
import { withLatency } from "./latency.js";
import { authHandlers } from "./auth.js";
import { inboxHandlers } from "./inbox.js";
import { dashboardHandlers } from "./dashboard.js";
import { dataExplorerHandlers } from "./dataExplorer.js";
import { jobsHandlers } from "./jobs.js";
import { onboardingHandlers } from "./onboarding.js";
import { chatHandlers } from "./chat.js";
import { tagGovernanceHandlers } from "./tagGovernance.js";
import { workspaceHandlers } from "./workspace.js";

const ALL_HANDLERS = [
  ...authHandlers,
  ...inboxHandlers,
  ...dashboardHandlers,
  ...dataExplorerHandlers,
  ...jobsHandlers,
  ...onboardingHandlers,
  ...chatHandlers,
  ...tagGovernanceHandlers,
  ...workspaceHandlers,
];

// Coverage instrumentation: records every METHOD + path that fails to match a
// handler. The endpoint_coverage route walk asserts this stays empty.
const unmatched = [];
export function getUnmatched() {
  return [...unmatched];
}
export function resetUnmatched() {
  unmatched.length = 0;
}

/** True when a handler is registered for METHOD + path (endpoint-parity check). */
export function hasHandler(method, path) {
  return !!matchRoute(ALL_HANDLERS, method.toUpperCase(), path.split("?")[0]);
}

/**
 * Resolve an API call from the mock registry instead of the network.
 *
 * @throws {ApiError} 404 when no handler matches — mirrors a missing real
 *   endpoint, so gracefulRequest resolves to null and coverage gaps surface.
 */
export async function dispatchMock(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const [rawPath, queryString = ""] = path.split("?");
  const match = matchRoute(ALL_HANDLERS, method, rawPath);
  if (!match) {
    unmatched.push(`${method} ${rawPath}`);
    throw new ApiError(`No mock handler for ${method} ${rawPath}`, { status: 404 });
  }
  const query = Object.fromEntries(new URLSearchParams(queryString));
  const body = options.body ? JSON.parse(options.body) : undefined;
  const data = await match.handler({ path: rawPath, params: match.params, query, body });
  return withLatency(data);
}
