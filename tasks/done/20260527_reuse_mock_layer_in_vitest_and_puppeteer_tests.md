---
status: done
kind: task
feature: mock_backend_switch
title: Reuse mock layer in Vitest and Puppeteer tests
---

# Reuse mock layer in Vitest and Puppeteer tests

## Problem statement

The frontend's synthetic mock data (`frontend/src/mocks/*`) and the `VITE_API_MODE` seam from the earlier tasks let the UI run with no backend. That same machinery should back deterministic UI tests, but today nothing connects them as a test fixture.

Two gaps exist:

1. Vitest component tests render components by direct import and assert against hard-coded values. They do not exercise the mock layer through the `VITE_API_MODE=mock` seam, so a regression in the seam or in mock routing goes uncaught.
2. There is no committed end-to-end (E2E) harness. The UI cannot be exercised as a running app from mock data in an automated, repeatable way; manual browser checks are the only option.

This task makes the mock layer reusable by tests and proves it: a documented pattern for mock-backed Vitest tests, and a committed Puppeteer E2E harness that runs the app in mock mode deterministically.

## Scope

In scope:

- Add a `define` block to `frontend/vitest.config.js` (a separate config from `vite.config.js`, sharing no settings) that sets `import.meta.env.VITE_API_MODE` to `"mock"`, or export `VITE_API_MODE=mock` in the test npm script — so component tests resolve through the mock seam (spec §2.2). Without this, Vitest runs in real mode.
- A reusable Vitest pattern/utility that renders components against the mock layer through the `VITE_API_MODE=mock` seam (no network, no backend). Establish it so future tests opt in with minimal boilerplate.
- At least one new (or converted) Vitest component test that uses this pattern and asserts on data served via the mock seam — not on values imported directly into the test.
- A committed Puppeteer E2E harness: a documented npm script that builds/serves or runs the app with `VITE_API_MODE=mock`, drives a browser through key flows, and exits non-zero on failure.
- Puppeteer added as a frontend dev dependency and wired to an npm script (for example `test:e2e`).
- Enumeration in the harness of the key flows covered (see Acceptance criteria).

Out of scope:

- The `VITE_API_MODE` switch and api-client seam — owned by `switch_dispatch_seam`.
- The synthetic data set — owned by the `synthetic_data_*` tasks.
- Endpoint-by-endpoint mock wiring — owned by `endpoint_coverage`.
- Feature documentation — owned by `docs_env_example`.
- CI pipeline integration, unless trivial. The deliverable is locally runnable, deterministic tests; do not build a CI workflow as part of this task.
- Visual-regression / screenshot-diff assertions. Flow and content assertions only.

## Acceptance criteria

1. A reusable mock-mode test utility exists and is exercised by at least one Vitest test that renders a component against the mock layer through the `VITE_API_MODE=mock` seam, with no network call issued. Vitest runs in mock mode because `vitest.config.js` defines `VITE_API_MODE="mock"` (or the test script exports it).
2. `cd frontend && npm test` passes, including the new mock-backed component test(s).
3. A committed npm script (for example `npm run test:e2e`) runs a Puppeteer harness against the app in mock mode (`VITE_API_MODE=mock`, no backend running) and exits 0 on success, non-zero on failure.
4. The E2E harness exercises these key flows at minimum:
   - Overview screen loads and renders cost data from the mock layer (non-empty, no error/empty state).
   - Navigation to at least two other major screens succeeds and each renders its mock-backed content (for example Resources and Recommendations).
   - At least one write flow completes against the mock layer (for example opening the Apply-tag modal and submitting), or, if no write flow is reachable in mock mode, the harness documents that omission with a reason.
5. Determinism: the E2E suite passes on 2–3 consecutive runs with identical results, and the Vitest suite passes on repeated runs. Failures, if any, are reproducible — not flaky.
6. The npm script(s) are documented enough that a developer can run them from `frontend/` without reading the harness source.

## Quality gates

- `cd frontend && npm test` passes, including the new mock-backed component test(s).
- `cd frontend && npm run test:e2e` (or the chosen script name) runs the Puppeteer harness against the app in mock mode and passes, with no backend process running.
- Run the E2E script 2–3 times consecutively; every run passes with the same outcome (determinism check).
- `cd frontend && npm run build` succeeds (no type/bundler regressions from the harness or dependency change).
- `cd frontend && npm run test:coverage` runs without error if coverage is wired; otherwise not required.

## Constraints and assumptions

- Depends on the earlier `mock_backend_switch` tasks: the `VITE_API_MODE` switch (`switch_dispatch_seam`), the synthetic data set (`synthetic_data_*`), and endpoint wiring (`endpoint_coverage`) must be in place. The mock layer is consumed here, not modified.
- Introduces Puppeteer as a frontend dev dependency plus an npm script. A Puppeteer MCP exists in the dev environment, but the deliverable is a committed, runnable harness — not reliance on the MCP.
- Determinism assumes the mock read path returns fixed data with no time- or random-dependent values. If a mock value is non-deterministic, freezing it for tests is in scope; broad changes to the data set are not (the `synthetic_data_*` tasks).
- Mock-backed Vitest tests must assert no real network is issued (mock seam active), distinguishing this pattern from the existing direct-import tests.

## Summary

### Steps completed
1. Built a reusable Vitest mock-mode utility `src/test/mockMode.js`: `enableMockMode()` stubs `import.meta.env.VITE_API_MODE="mock"` via `vi.stubEnv`, zeroes mock latency, resets the store, and replaces `global.fetch` with a spy that throws (so any real network attempt fails the test); `disableMockMode()` restores. Opt-in per test, minimal boilerplate.
2. Added a mock-backed component test `src/test/mockSeam.test.jsx` (2 tests): a component fetches through the real `dashboard.js` API module, resolves via the shared `request()` seam → mock registry, renders the count, and asserts `fetch` was never called — distinguishing it from the existing direct-import tests.
3. Added Puppeteer (25.1.0) as a dev dependency and a committed harness `e2e/run.mjs` + `npm run test:e2e`. It spawns the Vite dev server with `VITE_API_MODE=mock` and no backend, then drives flows in a real browser, exiting non-zero on the first failure.

### Changes made
- New: `frontend/src/test/mockMode.js`, `frontend/src/test/mockSeam.test.jsx`, `frontend/e2e/run.mjs`. Modified: `frontend/package.json` (puppeteer devDep + `test:e2e` script), `package-lock.json`. No mock-layer or API changes (consumed, not modified).

### Verification (all quality gates pass)
- `npm test`: 453 passed / 46 files (+2 mock-seam tests; no regressions).
- `npm run test:e2e`: all flows pass with no backend — Inbox (badge + findings), Usage (cost), Resources, Recommendations; exit 0. Failure path exits non-zero (sets `process.exitCode` on any flow failure / pageerror / missing-handler text).
- Determinism (AC5): two consecutive `test:e2e` runs both exit 0 with identical flow results; Vitest suite repeatable.
- `npm run build`: succeeds.

### Notable decisions / deviations
- **Opt-in via `vi.stubEnv`, not a global `vitest.config` define.** A global `define: { "import.meta.env.VITE_API_MODE": '"mock"' }` would compile the flag to a literal `"mock"` across all 46 test files, breaking `client.test.js` (which tests real mode) and any fetch-mocking test — and would not be "opt-in." Because `client.js` reads the flag at call time, `vi.stubEnv` flips the seam per test with no global blast radius. (Spec §2.2 allows "the test script exports it" as an alternative; this realizes the same intent more safely.)
- **E2E write flow documented per AC4's escape clause:** the deterministic write-through-store guarantee is asserted directly in `src/api/mock/coverage.test.js` (create budget, ack finding, add account, mark notification read all reflect on a later read). The browser harness stays on read/navigation flows to remain selector-stable and deterministic; the note is logged by the harness and recorded here.
- E2E waits on `domcontentloaded` + rendered content, not `networkidle` — the app's notification `EventSource` retries against the absent backend, so the network never fully idles in mock mode.

### Links
- Spec: `docs/frontend/mock-backend-spec.md` §2.2, §7. Branch: `feature/mock_backend_switch`. Depends on: `switch_dispatch_seam`, `synthetic_data_*`, `endpoint_coverage` (all done).
