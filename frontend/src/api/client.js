/**
 * Shared API client for the whole frontend.
 *
 * Every module under src/api/ imports `request` from here instead of defining
 * its own fetch helper. The mock/real decision lives in exactly one place: the
 * `VITE_API_MODE` branch inside `request()`.
 *
 * - real mode (VITE_API_MODE !== "mock"): perform the network fetch.
 * - mock mode (VITE_API_MODE === "mock"): resolve from the in-process mock
 *   handler registry, with no network reachable.
 *
 * `VITE_API_MODE` is a build-time literal (see frontend/vite.config.js `define`),
 * so in a real build the `=== "mock"` condition is statically `false` and the
 * `import("./mock/registry.js")` subtree is eliminated as dead code.
 */

const BASE = import.meta.env.VITE_API_URL || "";

/**
 * The single error type for the API layer, replacing the three error styles
 * the per-module helpers had drifted into. Carries the fields call sites read.
 */
export class ApiError extends Error {
  constructor(message, { status, detail, errorCode, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.errorCode = errorCode;
    this.body = body;
  }
}

/** Perform the real network request. */
async function realRequest(path, { headers, ...rest } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message || body?.detail || res.statusText;
    throw new ApiError(message, {
      status: res.status,
      detail: body?.detail,
      errorCode: body?.error_code,
      body,
    });
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * The one and only request seam.
 *
 * @param {string} path             API path, e.g. "/api/v1/inbox/badge".
 * @param {object} [options]
 * @param {string} [options.method] HTTP method; defaults to GET.
 * @param {object} [options.headers] Merged over the default Content-Type header.
 * @param {string} [options.body]   Request body (caller stringifies, as today).
 * @param {boolean} [options.graceful] Resolve to null on error instead of throwing.
 * @param {AbortSignal} [options.signal] Passed through to fetch (real mode).
 */
export async function request(path, options = {}) {
  const { graceful = false, ...rest } = options;
  try {
    if (import.meta.env.VITE_API_MODE === "mock") {
      const { dispatchMock } = await import("./mock/registry.js");
      return await dispatchMock(path, rest);
    }
    return await realRequest(path, rest);
  } catch (err) {
    if (graceful) return null;
    throw err;
  }
}

/** Thin wrapper: resolve to null on error instead of throwing. */
export function gracefulRequest(path, options = {}) {
  return request(path, { ...options, graceful: true });
}
