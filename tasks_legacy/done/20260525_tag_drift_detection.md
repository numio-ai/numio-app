---
status: done
kind: task
feature: tag_management
title: tag_policy_rules.equivalence_groups + compliance drift status + UI surface
---

# tag_policy_rules.equivalence_groups + compliance drift status + UI surface

## Problem statement

The compliance evaluator treats `prod` and `production` as two valid enum values, so it cannot detect value drift. Feature `tag_management` needs per-rule equivalence groups and a new `drift` status. Spec §5.6, §7.3.

## Scope

In scope:
- Alembic: add `tag_policy_rules.equivalence_groups` JSONB nullable. Shape `[["production","prod"],...]`; first entry canonical.
- Extend `core/compliance_service._evaluate_rule`: if `equivalence_groups` set and value found at position 0 → `compliant`; found at any other position → `drift` (record actual `current_value`); not found and `value_type=enum` → fall through to existing `invalid_value`.
- Extend `ComplianceResult.status` accepted set to include `drift`. `drift` counts as non-compliant in cost-weighted scoring.
- `/compliance/non-compliant` includes `drift` rows; UI surfaces them.

Out of scope:
- Editing equivalence groups from the UI (not in MVP scope unless already present in policy editor).

## Acceptance criteria

A1 (=feature A7). A rule with `equivalence_groups=[["production","prod"]]` causes `env=prod` resources to get `status=drift` (not `compliant`, not `invalid_value`) in the next compliance audit; `/compliance/non-compliant` includes drift rows.
A2. Canonical value (`production`) stays `compliant`.
A3. Value absent from all groups under an enum rule still returns `invalid_value`.

## Quality gates

- `cd backend && uv run pytest` green (evaluator matrix: canonical / non-canonical / unknown).
- `cd frontend && npm test` + `npm run build` green.
- Alembic upgrade/downgrade verified.
- Parallelizable with tasks 4–8 per spec §11.

## Summary

Steps completed (in order):
1. Alembic migration `983dae207764` adds `tag_policy_rules.equivalence_groups` (JSONB, nullable). Upgrade/downgrade verified against the worktree Postgres (column dropped then restored).
2. Model field `TagPolicyRule.equivalence_groups` (JSONB, nullable).
3. `compliance_service._evaluate_rule` extended: when a rule has `equivalence_groups`, a value matching a group's canonical (first) entry is `compliant`, any other member is `drift` (recording the actual value as `current_value`); a value in no group falls through to existing validation, so enum rules still emit `invalid_value`. New helper `_match_equivalence_groups`.
4. `drift` added to the `ComplianceStatus` enum (schemas/tag_policy.py). The `compliance_results.status` column is plain `String(50)` — no DB constraint change needed.
5. Round-tripped `equivalence_groups` through `TagPolicyRuleCreate` / `TagPolicyRuleResponse` and `TagPolicyRepository.create`/`update`, so the column is reachable via the existing tag-policy API.

Verification:
- `/compliance/non-compliant` already filters `status != 'compliant'`, so drift rows are included with no repository change. Cost-weighted scoring already treats any non-`compliant` status as non-compliant, so drift counts against the score with no snapshot change.
- Backend: 701 passed (7 new — 6-case drift matrix + 1 integration test asserting a `prod` value surfaces as `drift` in `/compliance/non-compliant`). ruff clean. Frontend: 376 passed, `npm run build` green.

Notable decisions / deviations:
- **Equivalence-group persistence (added, beyond literal task text):** the column would be dead without a write path. Made it settable via the existing `POST`/`PUT /tag-policies` API (schema + repository). No UI control — UI editing stays out of scope per the task. Spec §5.5 updated with a one-line note.
- **Frontend "surface drift rows":** no live consumer of `/compliance/non-compliant` exists (`listNonCompliant` / `getNonCompliantResources` are defined in API clients but unused; the TagGovernance Resources tab renders mock data and already classifies a `drift` cell kind). Per advisor guidance, did NOT build a new compliance list page (YAGNI). A1 is satisfied by the backend endpoint including drift rows. **Known follow-up:** wire a live compliance/non-compliant view when one is built.

Changes made:
- `backend/alembic/versions/983dae207764_add_tag_policy_rules_equivalence_groups.py` (new)
- `backend/src/numio/models/tag_policy.py`, `backend/src/numio/core/compliance_service.py`, `backend/src/numio/schemas/tag_policy.py`, `backend/src/numio/db/tag_policy_repository.py`
- `backend/tests/test_tag_policy_compliance.py` (drift matrix + integration test; `_make_rule` helper gains `equivalence_groups`)
- `docs/tag-management/tag-management-spec.md` (§5.5 persistence note)
