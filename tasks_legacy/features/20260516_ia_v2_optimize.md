---
status: done
slug: ia_v2_optimize
title: Numio IA v2 — Optimize surfaces (Recommendations, Send-to-Autopilot modal, Autopilot)
---

# Numio IA v2 — Optimize surfaces (Recommendations, Send-to-Autopilot modal, Autopilot)

# Numio IA v2 — Optimize surfaces (Recommendations, Send-to-Autopilot modal, Autopilot)

## Problem statement

Recommendations and Autopilot are core Numio value but today they have no first-class sidebar entry; the "Generate new" button is ambiguous; there is no evidence model behind a recommendation, so users can't audit the claim before enabling automation; and Zombie Hunter is a parallel page that duplicates 90% of Recommendations' UI. Autopilot offers minimal control: a confusingly-labeled "Edit" radio, no history visibility, no global pause, no add/delete path.

## Objective

Recommendations and Autopilot are dense, evidence-backed, first-class surfaces. Every recommendation can be expanded inline to inspect signals, affected resources, what-will-happen, exclusions, and a risk verdict. Send-to-Autopilot routes through a confirmation modal with dry-run gating. Autopilot has equal-weight Rules and History tabs, an `⋯` row menu replacing the "Edit" radio, archive-vs-delete semantics, a global Pause-all, and a 3-tab "+ New rule" picker. Zombie Hunter is gone — its functionality lives as a saved view inside Recommendations + the manual-CLI evidence slot inside every applicable recommendation card.

## Scope

In scope:
- Recommendations page redesign (cards, evidence sections, Rescan, Views, Zombie-Hunter saved view).
- Send-to-Autopilot confirmation modal (reusable component, used from Recommendations and from Autopilot + New rule).
- Autopilot page redesign (Rules + History tabs, `⋯` row menu, archive vs delete, bulk actions, Pause all, + New rule picker).

Out of scope:
- "View all N in Resources" deep-link banner state on Resources page — track as follow-up if needed.
- Per-action detail drawer in History (diff, approver, re-run) — leave as `⋯` row menu stub.
- Autopilot DSL editor for "From scratch" path — stub with textarea + docs link; full editor is later work.
- Backend: rules CRUD, history with undo windows, evidence model — `ia_v2_be_recommendations_evidence`, `ia_v2_be_autopilot_rules`.

## Acceptance criteria

A1. `/recommendations` renders a list of recommendation cards, each collapsed by default; clicking expands inline with: Signals detected, Affected resources (mini-table + "View all N in Resources →" deep link), What will happen, Exclusions, Risk box.

A2. Recommendations page has a single `⟳ Rescan · last {N} ago` button in the header — no separate Refresh button, no "Generate new".

A3. Zombie Hunter is no longer a route. The Recommendations Views picker includes a "Zombie Hunter" preset filtering category in (Idle resource, Orphan reclaim); the page is reachable only via that preset.

A4. Clicking "Send to Autopilot" opens a confirmation modal with: action summary, evidence checklist, rule preview (DSL-style code block), safety properties (reversibility window, idempotency, manual-review first-runs, blast-radius cap), Dry-run toggle (checked by default), and Cancel / Approve and enable buttons.

A5. `/autopilot` has two tabs of equal status: Rules (default) and History. Each tab's count appears in the tab label.

A6. Rules tab table columns: checkbox · Rule + description · Schedule · Runs 7d · Saved 7d · Last run · Toggle switch · `⋯` menu. The `⋯` menu has Edit · Duplicate · View runs · Archive.

A7. History tab: filter by Rule / Time / Outcome / Target; per-row Undo cell renders `↶ Undo · {time} left` within window, `auto-resumed` / `advisory only` / `undo expired` otherwise; infinite scroll.

A8. `⏸ Pause all` is a button in the Autopilot page header. Pausing flips the System pill to amber.

A9. `+ New rule` opens a 3-tab modal: From recommendation (default), From template, From scratch. Every new rule routes through the same Send-to-Autopilot confirmation modal.

A10. Archive (in row `⋯` menu) toggles a rule off + hides it from the default view. Delete is available only inside the archived rule's `⋯` menu, gated with type-the-name-to-confirm.

## Tasks

Execute in order:

1. `ia_v2_recommendations` — Recommendations redesign (cards, evidence, Rescan, Views, Zombie-Hunter saved view).
2. `ia_v2_send_to_autopilot` — reusable Send-to-Autopilot confirmation modal.
3. `ia_v2_autopilot` — Autopilot redesign (Rules + History tabs, ⋯ menu, archive/delete, bulk, Pause all, + New rule picker).

## Linked design mocks

- `docs/design-mocks/numio-ia-v2/project/page-recommendations.jsx`
- `docs/design-mocks/numio-ia-v2/project/page-autopilot.jsx`
- `docs/design-mocks/numio-ia-v2/project/Numio IA v2.html` — Send-to-Autopilot artboard at line 102.

## Summary

### Steps completed

All three member tasks completed and merged in order:

1. **`ia_v2_recommendations`** — new `/recommendations` page with collapsible evidence cards (Signals · Affected resources · What will happen · Exclusions · Risk), manual-remediation code block, single Rescan button, ViewsPicker (Zombie Hunter preset filters Idle resource + Orphan reclaim), Apply-once toast, ⟳ Rescan + URL state.
2. **`ia_v2_send_to_autopilot`** — reusable `components/SendToAutopilotModal.jsx` with five sections (action summary · evidence · rule preview · safety · dry-run footer). Default dry-run=true. Approve callback yields `{ ruleId, dryRun, approvedBy }`. Replaces the stub in Recommendations.
3. **`ia_v2_autopilot`** — new `/autopilot` page with Rules + History tabs, polymorphic Undo cell semantics, archive vs delete with type-name confirm, bulk actions, Pause-all confirmation that flips the global System pill amber, 3-tab + New rule modal routing through SendToAutopilotModal.

### Changes made

- New pages: `Recommendations/RecommendationsPage.jsx`, `Autopilot/AutopilotPage.jsx`.
- New page data: `Recommendations/recommendationsMockData.js`, `Autopilot/autopilotMockData.js`.
- New components: `SendToAutopilotModal.jsx`, `Autopilot/NewRuleModal.jsx`, `Autopilot/DeleteRuleDialog.jsx`.
- Refactored: `hooks/useAutopilotStatus.js` from constant stub to module-level subscriber with setters.
- Tests: 41 net new (13 Recommendations + 11 SendToAutopilotModal + 17 Autopilot). Total: 320 / 320 passing.

### Acceptance criteria status

| AC | Status |
|----|--------|
| A1 — Cards with five evidence sections, collapsible inline | ✅ |
| A2 — Single Rescan button, no Refresh, no Generate | ✅ |
| A3 — Zombie Hunter is a saved view, not a route | ✅ |
| A4 — Send-to-Autopilot modal with all five sections + dry-run | ✅ |
| A5 — Autopilot Rules + History tabs with counts | ✅ |
| A6 — Rules columns (checkbox, Rule, Schedule, Runs 7d, Saved 7d, Last run, Toggle, ⋯) | ✅ |
| A7 — History Undo cell semantics for all four states | ✅ |
| A8 — Pause all flips the System pill amber | ✅ |
| A9 — + New rule 3-tab modal routes through Send-to-Autopilot | ✅ |
| A10 — Archive in row menu; Delete only on archived with type-name confirm | ✅ |

### Notable decisions or deviations

- **`SendToAutopilotModal` extracted as a top-level component**, not a page-local helper. Recommendations and Autopilot both consume the same component (verified by `git grep -F "SendToAutopilotModal"` returning 4 matches: the component file, its test, RecommendationsPage, AutopilotPage).
- **Module-level subscription in `useAutopilotStatus`** lets AutopilotPage flip the System pill amber from anywhere in the app without a context provider rewrap. Backend task (`ia_v2_be_autopilot_rules`) will replace the body with an API hook; consumers don't change.
- **`/autopilot?new=true&prefill={recId}` deep-link** opens the NewRuleModal on initial render, matching the link target `<SendToAutopilotModal>` emits.
- **Zombie Hunter saved view** is the only path to the filtered "Idle + Orphan" subset of recommendations. Old `/zombie-hunter` route is gone (deleted in feature A task 3); `?view=zombie` is shareable.
- **Modal stack**: SendToAutopilotModal can sit on top of NewRuleModal (Autopilot page renders both via state) — z-indices stacked correctly (`new-rule-modal` z-index 150, `send-to-autopilot-modal` z-index 200).
- **Action stubs**: Apply-once, Snooze 7 days, Dismiss, Edit, Duplicate, View runs, Safety, action detail drawer, Save as, Share link, Sort/Status selectors all render but are no-ops. Each is tracked under backend tasks `ia_v2_be_recommendations_evidence` and `ia_v2_be_autopilot_rules`.
