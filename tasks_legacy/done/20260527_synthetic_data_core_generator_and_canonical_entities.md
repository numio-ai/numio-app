---
status: done
kind: task
feature: mock_backend_switch
title: Synthetic data core: generator and canonical entities
---

# Synthetic data core: generator and canonical entities

# Synthetic data core: generator and canonical entities

## Problem statement

The `mock_backend_switch` feature runs the full Numio UI from synthetic data with no backend, primarily for a customer demo. Today `frontend/src/mocks/` holds 28 files; `frontend/src/mocks/index.js` re-exports 11. Pages import the rest directly as hand-curated static data. Values diverge across files: `mockOverview.js` sets the period to "February 2026" while its `alertHistory` uses January dates, and `monitoringStatus` uses run-relative strings like "2 min ago". The same AWS account or service can read differently on two screens, and timestamps shift between runs. The three domain datasets (cost, governance, platform) cannot stay consistent without a shared, deterministic foundation underneath them.

## Scope

In scope:

- A seeded, deterministic generator under `frontend/src/mocks/`. Two runs produce byte-identical output: no live clock, no random identifiers, no run-dependent ordering.
- A shared canonical-entity registry, defined once and importable: AWS accounts (valid 12-digit IDs), AWS service names (real names such as "Amazon EC2"), AWS region codes (real codes), and a fixed demo time window.
- A reusable cross-screen consistency-check harness plus a determinism check. The harness proves aggregates reconcile and that a canonical identifier resolves identically across domains.
- Enough sample data to exercise the harness end to end.

Out of scope:

- The `VITE_API_MODE` switch and dispatch seam (task `switch_dispatch_seam`).
- The cost, governance, and platform datasets (their own tasks; this task supplies only the shared entities, generator, and harness they build on).
- Wiring synthetic data into `frontend/src/api/` modules (task `endpoint_coverage`).
- Integration tests and documentation (their own tasks).
- Migrating or consolidating the existing 28 mock files. This task establishes the substrate; domain tasks migrate as they adopt it.

## Acceptance criteria

1. Running the generator twice produces byte-identical output.
2. Canonical entities are importable from a single module under `frontend/src/mocks/`.
3. Canonical AWS account IDs are 12-digit numerics; service names match real AWS service names (for example "Amazon EC2"); region codes match real AWS region codes.
4. The demo time window is a fixed absolute date range, not derived from the current date.
5. The harness asserts that aggregates reconcile (a total equals the sum of its breakdown) on the sample data.
6. The harness asserts that the same canonical identifier (account ID, service, region) resolves identically across every screen that references it.
7. The harness and the determinism check run as part of `npm test` and pass.

## Quality gates

- `cd frontend && npm test` passes.
- `cd frontend && npm run build` succeeds.
- Determinism check: generating the data twice yields identical output, repeatably.
- Consistency harness runs and passes on the canonical entities and sample data.
- No lint gate: `frontend/package.json` defines no lint script.

## Constraints and assumptions

- Data authority is the live response shapes in `frontend/src/api/`. Generated output must match those shapes.
- Sibling repo `../numio-demo` is reference-only. It lags current functionality and must never be imported or treated as a source of truth.
- The three domain tasks (`synthetic_data_cost`, `synthetic_data_governance`, `synthetic_data_platform`) depend on this task. The canonical entities and harness must be importable and extensible by them.

## Summary

### Steps completed
1. Built a seeded, deterministic generator (`frontend/src/mocks/synthetic/seed.js`): mulberry32 PRNG (`makeRng`), `rngInt`/`rngFloat`/`rngPick`, `round2`, and `allocate(total, weights)` — which splits a total into parts that sum **exactly** to the total (the primitive the cost/governance datasets use to make by-dimension breakdowns reconcile with epsilon 0). Shared `CORE_SEED` so the full dataset is reproducible.
2. Defined the canonical-entity registry (`frontend/src/mocks/synthetic/entities.js`): 4 AWS accounts (12-digit IDs, alias, environment, primary region), 10 real AWS service names, 5 real region codes, and a fixed absolute demo window (Jan–May 2026), plus `accountById`/`serviceByKey`/`serviceByName`/`regionByCode` lookups. All fixed constants — stable across runs.
3. Built the cross-screen consistency + determinism harness (`frontend/src/mocks/synthetic/consistency.js`): `sum`/`sumField`, `reconciles`/`reconcilesField`, `resolvesIdentically` (same entity across screens), `isDeterministic` (two-run byte-equality).
4. Single import entry point (`frontend/src/mocks/synthetic/index.js`) re-exporting entities + seed + harness for the domain tasks.
5. Proved it end to end (`frontend/src/mocks/synthetic/core.test.js`, 8 tests): a sample period total split by-service / by-account / time-series via `allocate`, asserting every breakdown reconciles, the same account resolves identically across "screens", entity validity (12-digit IDs, real region pattern, real service names, fixed window), and determinism (sample built twice is identical; same-seed RNGs yield the same sequence).

### Changes made
- New: `frontend/src/mocks/synthetic/{seed,entities,consistency,index}.js` + `core.test.js`. No existing files touched (legacy `frontend/src/mocks/mock*.js` left for the domain tasks to migrate as they adopt the substrate).

### Verification (all quality gates pass)
- `npm test`: 404 passed / 41 files (+8 new core tests; no regressions).
- `npm run build`: succeeds.
- Determinism: `isDeterministic(buildSample)` true; same-seed RNG sequences equal.
- Consistency harness: reconciliation + same-entity assertions pass on the sample.

### Notable decisions / deviations
- Placed the new deterministic substrate in a dedicated `frontend/src/mocks/synthetic/` subdir to keep it cleanly separate from the 27 legacy ad-hoc `mock*.js` files (which the spec leaves for per-task migration).
- Added `allocate()` to the core (not strictly named in the brief) because exact-reconciliation is the core invariant the three domain datasets must satisfy; centralizing it here keeps reconciliation guaranteed rather than re-derived per domain.
- Canonical entities are fixed constants (not generated) so they are stable cross-screen references; only derived data uses the seeded RNG.

### Links
- Spec: `docs/frontend/mock-backend-spec.md` §5. Branch: `feature/mock_backend_switch`. Depends on: `switch_dispatch_seam` (done).
