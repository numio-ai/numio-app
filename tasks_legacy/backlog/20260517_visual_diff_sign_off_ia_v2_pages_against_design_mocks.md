---
status: backlog
kind: task
feature: ia_v2_release_cleanup
title: Visual diff sign-off: IA v2 pages against design mocks
---

# Visual diff sign-off: IA v2 pages against design mocks

## Problem statement

Page-level vitest assertions verify structure + data-binding for every IA v2 page. They do not cover pixel-level visual fidelity. The IA v2 design mocks at `docs/design-mocks/numio-ia-v2/project/*.jsx` are canonical; a human reviewer must confirm the live UI matches before the IA v2 release is sealed.

## Scope

In scope:
- Walk all 9 IA v2 surfaces in the running dev frontend with the matching `docs/design-mocks/numio-ia-v2/project/*.jsx` mock open side-by-side: V2Sidebar, SlimTopBar/SystemPill, InboxPage, UsagePage (Cloud + AI tabs), ResourcesPage, RecommendationsPage (collapsed + expanded), SendToAutopilotModal, AutopilotPage (Rules + History tabs + New Rule modal), TagGovernancePage (Resources + Schema tabs), BudgetsPage, PoliciesPage.
- For each surface: spacing within ±2px, color tokens match the mock, copy verbatim, density matches.
- Record findings as small bugfix tasks under `bugfixes` if any defect is found; do NOT block this task on minor adjustments — file them and proceed.
- Sign-off: append a row to `docs/qa/2026-05-17_ia_v2_system_test.md` confirming visual review complete with the reviewer's name + date.

Out of scope:
- Re-running tests or builds (already covered by `ia_v2_remove_legacy_usage_routes` and the existing QA reports).
- Mobile shell — `MobileMenu.jsx` and `MobileTabBar.jsx` were explicitly out of scope for the IA v2 rollout.
- Pre-existing pages (`/settings`, `/ingestion`, `/anomalies/:id`, etc.) — they were not redesigned.

## Acceptance criteria

A1. A markdown table or checklist in `docs/qa/` exists with one row per IA v2 surface, marked Pass / Pass-with-findings / Fail.

A2. Every Fail or Pass-with-findings row links to a filed bugfix task under the existing `bugfixes` feature.

A3. `docs/qa/2026-05-17_ia_v2_system_test.md` carries an appended "Visual diff" section with the reviewer's name + date.

A4. No Critical or Major visual defects open (Minor defects may remain as backlog).

## Quality gates

- Sign-off doc updated.
- Filed bugfix tasks visible in `./scripts/taskman.sh list tasks --feature bugfixes`.
