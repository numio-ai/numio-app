---
status: backlog
kind: task
title: API client DRY refactor: params and json options
---

# API client DRY refactor: params and json options

# API client DRY refactor: params and json options

## Problem statement

The `mock_backend_switch` feature consolidates the 9 duplicated `request()` helpers into one shared `frontend/src/api/client.js`. After that lands, ~49 call sites still hand-build requests: 19 build query strings with `new URLSearchParams` (across `dashboard.js` 12, `tagGovernance.js` 3, `onboarding.js` 2, `chat.js` 1, `jobs.js` 1) and 30 stringify JSON bodies with `JSON.stringify` (across `workspace.js` 9, `tagGovernance.js` 8, `dashboard.js` 5, `dataExplorer.js` 3, `auth.js` 2, `chat.js` 2, `onboarding.js` 1).

This task centralizes both patterns into optional `params` and `json` options on the shared `request()`, removing the repetition. It is decoupled from the demo: it touches no components and does not affect the mock/real seam. It is deliberately a separate, audited task because a careless sweep can silently send wrong query parameters.

## Scope

In scope:
- Add a `params` option to `request()`: an object serialized to a query string. Serialization rule (must be exact): drop `null`/`undefined`, keep empty strings and `false`, coerce numbers. No repeated-key/multi-value params exist (verified: zero `.append` usages as of 2026-05-27), so a plain object suffices.
- Add a `json` option to `request()`: an object that is `JSON.stringify`-ed with `Content-Type: application/json` set.
- Convert the 19 query-string sites and 30 JSON-body sites to use the new options.
- Per-site audit of query semantics to preserve each site's current behavior — this is the real work, not the mechanical part.

Out of scope:
- Any change to the actual HTTP requests sent (URLs, query strings, bodies) — behavior must be identical before and after.
- Components and call sites outside `frontend/src/api/`.
- The mock/real seam, switch, mock data, or tests (the `mock_backend_switch` feature).

## Acceptance criteria

1. `request()` supports `params` and `json` options; the `params` serialization rule (drop null/undefined, keep empty-string and false, coerce numbers) is implemented and documented in `client.js`.
2. All 19 query-string sites and 30 JSON-body sites are converted; no `new URLSearchParams` or inline `JSON.stringify` body construction remains in `frontend/src/api/` except where a site genuinely cannot use the generic form (documented per exception).
3. Behavior parity: for the tricky sites, the exact query string / body sent is unchanged versus before. Specifically verified: the boolean presence-flag (`unread_only`, today omitted when false), `onboarding`'s deliberate empty-string params (`label ?? ""` and CUR fields), and `is_active`'s undefined-vs-false distinction.
4. `cd frontend && npm test` passes; `cd frontend && npm run build` succeeds.

## Quality gates

- `cd frontend && npm test` passes.
- `cd frontend && npm run build` succeeds.
- Parity check: capture the request URL/body for a representative set (a cost-views call with an omitted optional, the `unread_only` notifications call with the flag false, an `onboarding` call with empty CUR fields) before and after the change; confirm byte-identical requests.

## Constraints and assumptions

- Depends on `switch_dispatch_seam` (the consolidated `frontend/src/api/client.js` must exist).
- Failures here are silent — a wrong/extra query param does not break the build or throw, it sends a subtly different request. This is why the conversion is per-site audited, not a find/replace.
- No repeated-key params exist in the codebase as of 2026-05-27 (no `.append`), so a plain `{params}` object can represent every current query.
