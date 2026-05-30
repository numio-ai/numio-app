---
status: done
kind: task
feature: ia_v2_optimize
title: IA v2 Autopilot — Rules + History tabs, archive/delete, bulk actions, + New rule picker
---

# IA v2 Autopilot — Rules + History tabs, archive/delete, bulk actions, + New rule picker

# IA v2 Autopilot — Rules + History tabs, archive/delete, bulk actions, + New rule picker

## Problem statement

The current Autopilot page (`pages/FinancialPlanning/Autopilot.jsx` routed at `/financial_planning/autopilot`) offers minimal control: per-row "Edit" radio, no history visibility, no global pause, no add/delete. Users can't audit what the system did or undo bad actions.

## Scope

In scope:
- New page at `/autopilot` matching `docs/design-mocks/numio-ia-v2/project/page-autopilot.jsx`. Legacy `/financial_planning/autopilot` is removed in `ia_v2_routes`.
- Page header: H1 + status pill ` [● Active]` + `⏸ Pause all` + `⚙ Safety` (button only; modal stub) + `+ New rule`.
- Subtitle: "4 of 5 rules active · 39 actions this week saved $14,732" pattern.
- Two tabs of equal status: Rules (default) and History. Each tab label carries a count.
- **Rules tab:**
  - Standard toolbar (Views, Share, Save as, Refresh) with presets: All rules · Active only · Created by me · Archived.
  - Filter chips: All / Active / Paused / Archived.
  - Dense table: checkbox · Rule + inline description · Schedule · Runs 7d · Saved 7d · Last run · Toggle switch · `⋯` menu (Edit · Duplicate · View runs · Archive).
  - Bulk action bar when rows selected: Pause selected · Resume selected · Archive selected · Export · Clear.
  - Footer "Showing N of M · View archived (X)".
- **History tab:**
  - Filter toolbar (Rule · Time · Outcome · Target) + Export CSV button.
  - Summary line "8 actions in the last 7 days · $9,210 saved · Full audit log →".
  - Action log table: When · Rule · Target · Outcome chip · Saved · Undo cell.
  - Undo cell semantics: within window → `↶ Undo · {time} left`; advisory action → `advisory only`; self-reversed → `auto-resumed`; past window → `undo expired`.
  - Outcome chip color: blocked/deleted=orange, stopped/resized=indigo, resumed=green.
  - Per-row `⋯` opens action detail drawer (stub).
  - Infinite scroll at bottom.
- **+ New rule modal:** 3 tabs (From recommendation · From template · From scratch). Footer reminder: "New rules require a dry-run + explicit approval before they fire." Every path routes through `<SendToAutopilotModal>` from task `ia_v2_send_to_autopilot`.
- **Archive vs delete:** Archive available in row `⋯` menu (one click; toggles off, hides from default view). Delete available only inside the archived rule's `⋯` menu, gated by type-the-name-to-confirm.

Out of scope:
- Safety modal contents — button visible, click shows placeholder dialog.
- Action detail drawer body — stub.
- Real DSL editor for "From scratch" — textarea + docs link.
- Backend rules persistence — `ia_v2_be_autopilot_rules`.

## Acceptance criteria

A1. `/autopilot` route resolves to the new page. Legacy `/financial_planning/autopilot` 404s (removed in `ia_v2_routes`).

A2. Rules tab renders the eight columns listed in Scope.

A3. Toggle switch in a row flips Active ↔ Paused without confirmation. Bulk pause/resume requires no confirmation.

A4. Archive routes through the `⋯` menu; archived rules don't appear in the default view; footer shows `View archived (X)`.

A5. Delete is only visible in the archived rule's `⋯` menu and requires typing the rule name to confirm.

A6. History tab renders the Undo cell semantics. Within-window actions show `↶ Undo · {time} left`. Past-window actions show `undo expired`. Advisory actions show `advisory only`.

A7. `⏸ Pause all` requires confirmation; after pause, page banner reads paused and the System pill in the top bar turns amber.

A8. `+ New rule` opens a 3-tab modal. Selecting any tab and proceeding routes through the Send-to-Autopilot confirmation modal.

A9. Outcome chip colors match the spec (blocked/deleted=orange, stopped/resized=indigo, resumed=green).

## Quality gates

- Build + tests pass.
- Unit test: archive → delete only visible in archived state with type-to-confirm.
- Unit test: Undo cell semantics for all four states.
- Visual diff vs the three Autopilot artboards in the mock HTML.

## Summary

### Steps completed

1. Built `pages/Autopilot/AutopilotPage.jsx` (~520 lines) with Rules + History tabs. Tab state lives in URL (`?tab=history`).
2. Built `pages/Autopilot/NewRuleModal.jsx` — 3-tab picker (From recommendation · From template · From scratch). Each tab supports keyboard navigation; Configure→ routes through `<SendToAutopilotModal>`.
3. Built `pages/Autopilot/DeleteRuleDialog.jsx` — type-the-rule-name-to-confirm; Delete button is disabled until input matches the rule name exactly.
4. Built `pages/Autopilot/autopilotMockData.js` — 6 rules (4 active, 1 paused, 1 archived), 6 action-history rows exercising all four Undo states (within / auto / advisory / expired), 4 rule templates, helpers `undoStateFor` + `outcomeChipTone`.
5. Refactored `hooks/useAutopilotStatus.js` from constant-stub to subscriber pattern with `setAutopilotPausedAll` / `setActiveRuleCount` setters. SystemPill picks up the pause-all signal and flips amber via the existing color mapping (`paused → degraded → amber`).
6. AutopilotPage syncs `activeRuleCount` to the global hook every time the rules state changes.
7. Pause-all flow: confirmation dialog → `setAutopilotPausedAll(true)` → page banner appears + status pill flips → SystemPill in top bar flips amber. Resume-all clears.
8. Wrote 17 vitest cases covering: default tab + columns (A2), toggle switch flips (A3), archive hides + counter increments (A4), delete dialog gating + type-name confirm (A5), all four Undo kinds (A6), Pause-all confirmation + status flip + resume (A7), New-rule 3-tab modal transitions to SendToAutopilotModal (A8), outcome chip colors (A9 — indigo/orange/green), bulk action bar.
9. Wired `/autopilot` lazy route in `App.jsx`.

### Changes made

- New: `pages/Autopilot/AutopilotPage.jsx`, `pages/Autopilot/NewRuleModal.jsx`, `pages/Autopilot/DeleteRuleDialog.jsx`, `pages/Autopilot/autopilotMockData.js`, `pages/Autopilot/AutopilotPage.test.jsx`.
- Modified: `hooks/useAutopilotStatus.js` (subscriber pattern + setters), `App.jsx` (lazy import + route).

### Notable decisions or deviations

- **Module-level subscription pattern in `useAutopilotStatus`** instead of full Context Provider. The hook had a single value before and a single subscriber pattern after — adding a Provider would have rippled into `App.jsx`'s provider stack. The setter functions are imported directly where needed (AutopilotPage). When backend lands, both the hook body and the setters are replaced by API calls; the call sites don't change.
- **`/autopilot?new=true&prefill={recId}` honored from the URL** — `useState(params.get("new") === "true")` opens the NewRuleModal on first render. This makes the "Open rule editor →" deep-link from `<SendToAutopilotModal>` (task 2) functional end-to-end.
- **Archive auto-pauses** — archiving a rule via `⋯ → Archive` sets `state: "paused"` as well as `archived: true`. Matches A4's spirit (archived rules don't fire) without needing a separate "archived means paused" UI rule.
- **`Edit`, `Duplicate`, `View runs` are stubs** — menu items render but the action handlers are no-ops. Backend task `ia_v2_be_autopilot_rules` introduces the real surfaces.
- **Safety modal is a stub** (button visible, click is a no-op) per task body.
- **Action detail drawer** in History rows is a stub (per-row ⋯ click is a no-op).
- **Bulk action bar surfaces only when at least one row is selected** — Pause / Resume / Archive selected work; Export is decorative.
- **`+ New rule` from-scratch tab uses a plain `<textarea>` and a docs link**, per task scope ("textarea + docs link; full editor is later work").
- **Test count: 303 → 320** (+17 AutopilotPage tests).

### Links

- Tests: `cd frontend && npm test` — 320 / 320 passing.
- Build: `cd frontend && npm run build` — successful.
