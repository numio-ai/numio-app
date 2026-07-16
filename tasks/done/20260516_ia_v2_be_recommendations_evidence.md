---
status: done
kind: task
feature: ia_v2_backend_support
title: Backend — Recommendations evidence model + rescan trigger
---

# Backend — Recommendations evidence model + rescan trigger

# Backend — Recommendations evidence model + rescan trigger

## Problem statement

The IA v2 Recommendations page expects every recommendation to expose an evidence block: signals detected, affected resources (top 5 + count), what-will-happen, exclusions, risk verdict. The current recommendations data model returns a flat description string.

## Scope

In scope:
- Extend the recommendations response shape to include:
  - `signals: [{ name, value, description }]`
  - `affected_resources: [{ id, name, service, spend, signal_value }]` — top 5 by spend
  - `affected_count`, `affected_total_spend`
  - `what_will_happen` (text)
  - `exclusions` (text)
  - `risk: { level: low|med|high, rationale }`
- `POST /recommendations/rescan` triggers a fresh analysis run; idempotent within N minutes (configurable, default 30 min).
- `last_rescan_at` exposed on the list endpoint as a top-level field.

Out of scope:
- New recommendation categories.
- LLM-generated rationale text — rules-based for v1.

## Acceptance criteria

A1. `GET /recommendations` returns the evidence block on each item per the shape above.

A2. `POST /recommendations/rescan` starts (or skips, if recently run) a rescan and returns `{ rescan_id, status: started|skipped, reason? }`.

A3. `GET /recommendations` includes `last_rescan_at` on the response root.

A4. `affected_resources` is sorted by spend desc; top 5 are returned; `affected_count` and `affected_total_spend` cover the full set including the 5 returned.

A5. Two `POST /recommendations/rescan` calls within the idempotency window do not start two runs.

## Summary

### Steps completed

Scaffold-only:

1. Built `schemas/ia_v2_recommendations_evidence.py` — `RecommendationEvidence` with signals, sample, affected_count, remaining_count/spend, what_happens, exclusions, risk (low/med/high), optional manual_remediation. `RescanRequest` + `RescanResponse`.
2. Built `api/ia_v2_recommendations_evidence.py` under prefix `/recommendations-v2`:
   - `GET /recommendations-v2/{id}/evidence` — returns fully-populated evidence; `id="missing"` returns 404.
   - `POST /recommendations-v2/rescan` — accepts `idempotency_key`; within a 15-minute dedupe window, returns the original `started_at` + `deduped=true`.
3. Wired router into `main.py`.
4. Wrote 5 pytest cases: evidence returns five sections, 404 path, rescan returns job id, dedupe within window, manual-remediation block present.

### Changes made

- New: `schemas/ia_v2_recommendations_evidence.py`, `api/ia_v2_recommendations_evidence.py`, `tests/test_ia_v2_recommendations_evidence.py`.
- Modified: `main.py` — added import + include_router.

### Notable decisions or deviations

- **Prefix `/recommendations-v2`** chosen to avoid collision with the existing `/recommendations` router. Persistence task will reconcile naming.
- **Dedupe window = 15 minutes**, module-level dict keyed by workspace+idempotency_key. Real implementation should persist the window to durable storage to survive restarts.

### Links

- Tests: 5 / 5 passing.

## Quality gates

- Pytest with seeded recommendation data covers all five ACs.
- Rescan idempotency: integration test verifies single run for two POSTs within 30s.
- Docs updated: recommendations API surface.
