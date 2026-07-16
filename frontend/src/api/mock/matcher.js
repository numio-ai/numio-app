/**
 * Tiny path matcher for the mock handler registry.
 *
 * Routes are matched by exact segment count with `:name` segments captured as
 * params. No wildcards or optional segments — the API surface does not need
 * them. Keeps the registry dependency-free (spec §3.3).
 */

/**
 * Match one path against one pattern.
 * @returns {object|null} captured params, or null if the pattern does not match.
 */
export function matchPath(pattern, path) {
  const pSeg = pattern.split("/");
  const aSeg = path.split("/");
  if (pSeg.length !== aSeg.length) return null;
  const params = {};
  for (let i = 0; i < pSeg.length; i++) {
    if (pSeg[i].startsWith(":")) {
      params[pSeg[i].slice(1)] = decodeURIComponent(aSeg[i]);
    } else if (pSeg[i] !== aSeg[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Find the first route whose method and path match.
 * @returns {object|null} the matched route with a `params` field, or null.
 */
export function matchRoute(routes, method, path) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, path);
    if (params) return { ...route, params };
  }
  return null;
}
