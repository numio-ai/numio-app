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

/**
 * Serialize a plain object into a query string (leading "?" included), or "" when
 * the object yields no params. Serialization rule:
 *   - drop entries whose value is null or undefined
 *   - keep empty strings ("") and false (sent as "false")
 *   - coerce everything else with String() (numbers/booleans → their text form)
 * Built on URLSearchParams so encoding (percent-escaping, "+" for spaces) and
 * key order (object insertion order) match the hand-built URLSearchParams call
 * sites byte-for-byte. No repeated-key/multi-value params exist in the API
 * surface, so a plain object suffices.
 */
function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === null || value === undefined) continue;
    usp.append(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
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
 * @param {object} [options.params] Serialized to a query string and appended to
 *   `path` (see buildQuery for the exact rule). Mutually convenient with `json`.
 * @param {object} [options.json]   Serialized with JSON.stringify into the body
 *   with Content-Type: application/json.
 * @param {string} [options.body]   Pre-stringified request body. Use `json` for
 *   the common case; `body` remains for callers that stringify themselves.
 * @param {boolean} [options.graceful] Resolve to null on error instead of throwing.
 * @param {AbortSignal} [options.signal] Passed through to fetch (real mode).
 */
export async function request(path, options = {}) {
  const { graceful = false, params, json, ...rest } = options;
  const finalPath = params === undefined ? path : path + buildQuery(params);
  if (json !== undefined) {
    rest.body = JSON.stringify(json);
    rest.headers = { "Content-Type": "application/json", ...rest.headers };
  }
  try {
    if (import.meta.env.VITE_API_MODE === "mock") {
      const { dispatchMock } = await import("./mock/registry.js");
      return await dispatchMock(finalPath, rest);
    }
    return await realRequest(finalPath, rest);
  } catch (err) {
    if (graceful) return null;
    throw err;
  }
}

/** Thin wrapper: resolve to null on error instead of throwing. */
export function gracefulRequest(path, options = {}) {
  return request(path, { ...options, graceful: true });
}
