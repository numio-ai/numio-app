# Mock / real backend switch — design and contract

Status: design contract. Authored 2026-05-27 during `/agn:design feature mock_backend_switch`.
Feature: `tasks/features/20260527_mock_backend_switch.md`.

## 1. Overview and objective

The React frontend reaches the backend through 9 API modules in `frontend/src/api/`
(auth, chat, dashboard, dataExplorer, inbox, jobs, onboarding, tagGovernance,
workspace) exposing 112 exported functions as of 2026-05-27. Each module defines its
own near-duplicate `request()` fetch helper. Components, pages, and hooks import the
API functions directly by relative path; there is no service abstraction, React
Query, or path alias.

This feature adds one build-time switch, the Vite env var `VITE_API_MODE`, with
values `mock` and `real`. In `mock` mode the whole app runs end-to-end from generated
synthetic data with no backend, no database, and no AWS connectivity — the primary
driver is a standalone customer demo. In `real` mode the identical source talks to
the backend. The mechanism is a **single shared API client** (`src/api/client.js`)
that consolidates the 9 duplicate helpers; the mock/real decision lives inside its
one `request()` function. No component or call site changes between modes. The same
mock layer backs deterministic Vitest component tests and a Puppeteer end-to-end
(E2E) harness.

Acronyms used once: CUR = Cost and Usage Report; MSW = Mock Service Worker;
SSE = Server-Sent Events; DCE = dead-code elimination; DRY = don't repeat yourself.

## 2. The switch: `VITE_API_MODE`

| Property | Value |
|---|---|
| Variable | `VITE_API_MODE` |
| Values | `mock`, `real` |
| Default | `real` |
| Binding time | Build time only. No runtime or in-app toggle. |
| Read as | A statically-replaced string literal via `import.meta.env.VITE_API_MODE`. |

The switch is fixed when the bundle is built (or when the dev server starts). It is
never read from a cookie, query string, or runtime state. A demo build and a
production build differ only by this one variable.

### 2.1 The flag MUST be statically defined at build

Vite replaces `import.meta.env.VITE_*` references with string literals at build time,
which is what enables DCE of the unused branch (see §3.6). Vite does **not** replace a
`VITE_*` reference that is undefined at build — it leaves it as a runtime lookup, and
then neither branch tree-shakes. Therefore the flag MUST always resolve to a literal.
This feature guarantees that by defining it in `vite.config.js`:

    define: {
      "import.meta.env.VITE_API_MODE":
        JSON.stringify(process.env.VITE_API_MODE || "real"),
    }

With this `define`, an unset `VITE_API_MODE` compiles to the literal `"real"`, and the
mock branch is eliminated from the default and production builds. This is the chosen
mechanism because `.env.example` is not loaded by Vite — only a committed `.env` is —
so relying on an env file would silently fail when none exists.

### 2.2 How each context sets the flag

| Context | How `VITE_API_MODE` is set | Resulting mode |
|---|---|---|
| Production / default build | unset → `define` default | `real` |
| Demo / mock build | `VITE_API_MODE=mock npm run build` | `mock` |
| Dev server (mock demo) | `VITE_API_MODE=mock npm run dev` (no backend needed) | `mock` |
| Dev server (against backend) | unset (default) | `real` |
| Vitest component tests | set in `vitest.config.js` `define` to `"mock"` | `mock` |
| Puppeteer E2E | drives a mock build / mock dev server | `mock` |

`vitest.config.js` is a separate config from `vite.config.js` and shares no settings
with it. It MUST carry its own `define` block (or the test npm script MUST export
`VITE_API_MODE=mock`) so component tests run in mock mode. The `test_integration`
task wires this; the spec only fixes the requirement.

## 3. Dispatch architecture

### 3.1 A single shared API client (consolidation)

Today every module in `frontend/src/api/` defines its own `request()` helper. They are
near-identical but have drifted into three error conventions and one GET-only variant.
This feature consolidates them into one shared module, `src/api/client.js`, which every
API module imports:

    import { request } from "./client";

The shared `request(path, options)` is the single foundational wrapper. Its option
surface is deliberately minimal:

| Option | Meaning |
|---|---|
| `method` | HTTP method; defaults to `GET`. `POST`/`PUT`/`PATCH`/`DELETE` for writes. |
| `headers` | Merged over the default `Content-Type: application/json` (correctly — see §3.7). |
| `body` | Request body; the caller stringifies, as today. |
| `graceful` | When `true`, resolve to `null` on error instead of throwing. |

Behavior: resolve `BASE` from `import.meta.env.VITE_API_URL` once; send
`credentials: "include"` (cookie auth — no module injects API-key or bearer headers);
return `null` on HTTP 204; otherwise parse and return JSON (every success path in the
codebase returns JSON — no blob, text, or multipart responses exist); throw `ApiError`
on any non-2xx.

`ApiError extends Error` is the single error type, replacing today's three styles
(`message || detail || statusText`; the text form `"API <status>: <body>"`; and the
custom `DataExplorerError`). It carries `status`, `detail`, `errorCode`, and `body`.
`DataExplorerError extends ApiError` is retained and still exported from
`api/dataExplorer.js`, because `DataExplorerPage.jsx` imports it by name and reads
`.errorCode`/`.status` — those continue to work unchanged.

`gracefulRequest(path, options)` is retained as a thin wrapper (`request(path, {
...options, graceful: true })`) for its existing call sites.

### 3.2 The mock/real decision lives inside `request()`

`request()` is the one and only seam:

- **Real mode** (`VITE_API_MODE !== "mock"`): perform the real `fetch` exactly as the
  consolidated helper does today.
- **Mock mode** (`VITE_API_MODE === "mock"`): resolve the call from the mock handler
  registry (§3.3) instead of the network.

Because every API function calls `request()`, the branch exists in exactly one place.
Business-logic API functions (`fetchInboxBadge`, `getTotalCost`, …) are unchanged, and
**no component call site changes**. The one exception within the API layer:
`dashboard.js`'s `request()` is GET-only, so its ~14 write functions currently inline
`fetch` directly and bypass any seam. They are refactored to call the shared
`request(path, { method, body })` — a required change so writes route through the seam.

### 3.3 The mock handler registry and matcher

In mock mode `request()` dispatches to a registry of handlers keyed by `METHOD` + path:

- A small matcher resolves dynamic segments (e.g. `POST /api/v1/findings/:id/acknowledge`).
  Hand-rolled regex (≈20 lines) or a tiny path-matching helper — the task chooses.
- **Handler signature:** `({ path, params, query, body }) => data` (sync or async),
  returning data shaped exactly like the real endpoint's response.
- **No matching handler in mock mode → throw `ApiError(404)`.** This makes
  `gracefulRequest` resolve to `null`, identical to how a missing real endpoint behaves
  today, and makes coverage gaps visible during the E2E walk.
- Handlers are organized **one file per API domain** under `src/api/mock/`
  (`mock/inbox.js`, `mock/dashboard.js`, …), so the mock layer mirrors the API-module
  structure one-to-one (AC6): adding an endpoint to one API module maps to one mock
  file.

### 3.4 In-memory write store

Mock writes resolve against an in-memory, session-scoped store (`src/api/mock/store.js`):

- A write mutates the store; subsequent reads in the same session reflect the change
  (e.g. add an AWS account → it appears in the integration list and account-scoped reads).
- The store seeds from the deterministic synthetic data (§5) on load.
- State resets on page reload — no persistence to disk, `localStorage`, or a backend.
- No forced error states; a write succeeds unless the synthetic shape makes it
  impossible (e.g. deleting a missing id), where the handler mirrors the real failure shape.

### 3.5 Latency

Every mock response resolves through one shared latency wrapper after a small
artificial delay so loading spinners and skeletons render. See §6.

### 3.6 Production bundling and `stripMocksInProd` retirement

The mock registry, mock handler files, in-memory store, and synthetic data are imported
only under the static `VITE_API_MODE === "mock"` condition. In a `real` build that
condition is a literal `false`, so Rollup eliminates the entire mock subtree and its
synthetic data as dead code; in a `mock` build the real-only paths remain but nothing
is stripped. DCE of the dropped subtree requires it to be side-effect-free: this is
guaranteed by attesting `"sideEffects": false` for `src/api/**` and `src/mocks/**` in
`frontend/package.json`, or by gating the registry behind a conditional dynamic import
keyed on the static flag.

`frontend/vite.config.js` currently carries a `stripMocksInProd()` plugin — a fragile
regex source-transform that stubs `src/mocks/mock*.js` exports in production. Its sole
job (keep fake data out of production) is subsumed by build-mode selection: in a `real`
build the mock layer is never imported. **`stripMocksInProd` is removed.**
`vite.config.js` MUST change in this feature: delete the plugin and add the `define`
from §2.1. The dev proxy (`/api` → `BACKEND_PROXY_TARGET`) and per-worktree port
handling are unchanged.

### 3.7 Why this mechanism — alternatives rejected

- **Per-module mock twins + `resolve.alias`:** call sites import the API by *relative*
  specifier (`../api/dashboard`); 29 such imports across 20 files, no `@api` alias. Vite
  `resolve.alias` does not reliably intercept relative specifiers, so a directory swap is
  fragile, and twins duplicate every function signature.
- **MSW (network interception):** adds a runtime dependency, leaves the `stripMocksInProd`
  debt in place, and matches AC6 only approximately. The shared-client seam needs no
  dependency and removes existing duplication as a side effect.
- **A per-module re-export selector:** keeps two parallel implementations per module;
  more files and signature drift than routing one shared `request()`.

The consolidation also fixes real existing tech debt: 9 duplicate `request()` helpers,
3 divergent error conventions, the GET-only `dashboard` variant, and an inconsistent
header merge (§3.1).

## 4. Mock handler contract

Each handler file under `src/api/mock/` mirrors one API domain and provides a handler
for every endpoint that domain's functions call:

1. **Coverage / parity (AC3, AC6).** Every `METHOD` + path that an exported API function
   invokes has a handler. The `endpoint_coverage` task enforces this by walking every
   top-level route in mock mode (no backend running) and confirming no `ApiError(404)`
   from a missing handler and no unhandled rejection. Parity is by endpoint, not by
   function name.
2. **Reads (GET).** Return synthetic data (§5) shaped exactly as the real function
   returns today. Shape authority is the live API module / backend response.
3. **Writes (POST/PUT/PATCH/DELETE).** Mutate the in-memory store (§3.4) and resolve with
   a response shaped like the real one.
4. **Latency.** All responses pass through the shared latency wrapper (§6).
5. **Non-`request` exports — documented limitations.** Two exports do not call
   `request()` and so bypass the seam:
   - `getNotificationStreamUrl()` returns an SSE URL consumed by `EventSource`. In mock
     mode it returns a URL with no live stream; `EventSource` retries silently and the UI
     degrades to no live notifications. Accepted.
   - `getCfnTemplateDownloadUrl()` returns a browser-download URL. In mock mode the
     "Download template" link 404s. **Accepted as a known mock-mode limitation** (the
     demo does not exercise that step). Not worked around.

## 5. Synthetic data model

### 5.1 Shared canonical entities (from `synthetic_data_core`)

One registry, defined once under `frontend/src/mocks/` and importable by every domain
dataset, holds:

- **AWS accounts** — valid 12-digit numeric IDs.
- **AWS service names** — real names (e.g. "Amazon EC2").
- **AWS region codes** — real codes.
- **Demo time window** — a fixed absolute date range, never derived from the current date.

Domain datasets MUST source every account, service, region, and date from this registry.
No domain dataset defines a parallel entity set.

### 5.2 Domain datasets consume the core

| Dataset | Task | Surfaces (response-shape authority) |
|---|---|---|
| Cost & budget | `synthetic_data_cost` | cost-views total / time-series / by-dimension / trends, cost-by-service, budgets list / detail / alerts. Authority: `dashboard.js`. |
| Governance & compliance | `synthetic_data_governance` | tag governance, compliance, findings, recommendations & savings, infra policies, resource inventory. Authority: `tagGovernance.js` + `dashboard.js`. |
| Platform & operations | `synthetic_data_platform` | workspace/users/API keys/automation, accounts/onboarding/auth, jobs, audit, inbox, chat, data explorer. Authority: `workspace.js`, `onboarding.js`, `auth.js`, `jobs.js`, `inbox.js`, `chat.js`, `dataExplorer.js`, and the audit/notification functions in `dashboard.js`. |

### 5.3 Determinism

The generator is seeded. Two runs produce byte-identical output: no live clock, no
random identifiers, no run-dependent ordering. Each domain dataset inherits the core
seed, so the full dataset is byte-identical across runs.

### 5.4 Cross-screen consistency invariants

A consistency harness (owned by `synthetic_data_core`) asserts:

1. **Aggregates reconcile.** A period total equals the sum of each of its breakdowns:
   time-series buckets, by-service, by-account, by-region, by-tag. Month-over-month trend
   figures are internally consistent with per-period totals.
2. **Same entity reads identically everywhere.** A canonical account, service, or region
   resolves to the same value on every screen that references it.
3. **Integration list == canonical accounts.** The accounts on the Integrations screen are
   exactly the canonical accounts. Every account referenced by ingestion status, job-run
   history, and audit records is a member of that set.
4. **Cross-domain reference integrity.** A resource flagged non-compliant appears in the
   inventory; a recommendation's target resources reference inventory IDs; a policy
   violation references an inventory resource; recommendation savings entries sum to the
   savings-summary totals.

## 6. Latency

Every mock response resolves after a small, configurable artificial delay so loading
spinners and skeletons render. Default range: 150–400 ms per response, applied by a
single shared wrapper so the delay is consistent and tunable in one place. The delay is
deterministic for tests (a fixed value, or zero, when the harness requires it). No forced
error states — latency only.

Illustrative wrapper shape (interface, not implementation):

    // resolves `value` after the configured delay
    withLatency(value) -> Promise<value>

## 7. Test reuse

Both test layers consume the same mock layer through the same `VITE_API_MODE=mock`
client — no separate test doubles, no MSW, no network.

- **Vitest (component tests).** `vitest.config.js` (separate from `vite.config.js`) sets
  `VITE_API_MODE` to `"mock"` via its own `define`, or the test npm script exports it.
  Components render through the API modules, which resolve via the shared `request()` to
  mock handlers. A mock-backed test asserts on data served via the seam and asserts no real
  network call is issued — distinguishing it from the existing direct-import tests.
- **Puppeteer (E2E).** A committed harness builds or serves the app with
  `VITE_API_MODE=mock` and drives a real browser through key flows with no backend
  running, exiting non-zero on failure.
- **Determinism.** Because the mock read path is seeded and the latency wrapper is fixed
  for tests, both suites pass identically across repeated runs. Any non-deterministic value
  is frozen for tests.

## 8. Out of scope

- Building real backend endpoints.
- A runtime or in-app toggle — the switch is build-time only.
- Refreshing the sibling `numio-demo` repo — a separate follow-up.
- Forced error-state simulation in mock responses.
- MSW or any Service-Worker-based interception.
- **The `params` / `json` API-client DRY unification** (centralizing query-string building
  and body serialization across ~49 call sites). It is a separate, audited follow-up task
  (see `api_client_dry_refactor`), deliberately decoupled: it touches no components and does
  not affect the seam. This feature consolidates `request()` itself but leaves call sites'
  existing query/body construction untouched.
- Migrating the existing 28 `frontend/src/mocks/` files beyond what the domain tasks adopt.

## 9. Traceability — spec section to feature acceptance criterion

| Feature AC | Spec section(s) |
|---|---|
| AC1 — `VITE_API_MODE` selects mock/real for the whole app, build-time only | §2, §3.2, §3.6 |
| AC2 — call sites unchanged in both modes | §3.1, §3.2 |
| AC3 — every endpoint served in mock mode; app navigates end-to-end | §3.3, §4, §5 |
| AC4 — synthetic data plausible and consistent across screens | §5.1, §5.2, §5.4 |
| AC5 — mock layer in `frontend/`, reuses `src/mocks/`, no `numio-demo` dep | §3, §5, §8 |
| AC6 — mock layer mirrors API-module structure one-to-one | §3.3, §4 |
| AC7 — Vitest + Puppeteer run in mock mode, deterministic | §2.2, §5.3, §7 |
| AC8 — small artificial delay so spinners/skeletons render | §6 |
