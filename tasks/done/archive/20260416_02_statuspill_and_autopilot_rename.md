---
status: done
kind: task
---

# StatusPill primitive + Autopilot rename

**Date:** 2026-04-16

## Context

Top-bar pill currently renders bare `Active` in two places:

- `frontend/src/components/Header.jsx:308` — full dropdown with "Automation Status" heading and "Pause all automation" / "Disable automation" actions; links to `/optimize/autopilot` page.
- `frontend/src/components/SlimTopBar.jsx:356` — static pill with `title="Automation active"` only.

Neither tells the user which subsystem the badge represents. The product's feature for autonomous action execution is called **Autopilot** (`/optimize/autopilot` route, dedicated page already exists). This task aligns all references in the top bar to "Autopilot" and factors a reusable primitive so the upcoming Data pill (Task 04) can land with visual parity.

Part of the data-ingestion visibility plan discussed in `tasks/backlog/20260416_03_data_ingestion_page.md` and siblings.

## Problem

Users cannot tell what "Active" refers to in the top bar. Adding a second subsystem pill without fixing this first makes the ambiguity worse, so this is a prerequisite for Task 04 and the wider observability surface.

## Goals

1. Create a reusable `<StatusPill>` component usable by both the Autopilot pill and the future Data pill.
2. Rename the existing pill label to `Autopilot: Active` / `Autopilot: Paused` / `Autopilot: Disabled` in both top-bar variants.
3. Align dropdown heading, action verbs, and aria-labels to the Autopilot vocabulary.

## Non-goals

- Adding the Data pill — see Task 04.
- Renaming the Autopilot feature elsewhere (route, page, nav) — already consistent; no change.
- Redesigning the Autopilot dropdown's internal actions beyond label text.
- Backend changes.

## Constraints & assumptions

- Both `Header.jsx` and `SlimTopBar.jsx` must be updated; missing either leaves half the users seeing `Active`.
- Functional behaviour of Pause / Resume / Disable must be preserved unchanged.
- Narrow viewport: pill must collapse to icon-only while retaining state in `title` + `aria-label`.

## Acceptance criteria

1. A `StatusPill` component exists (e.g. `frontend/src/components/StatusPill.jsx`) with at minimum the following props: `subsystem` (visible prefix string), `state` (key), `stateConfig` (state → `{ label, dotColor, background, textColor }`), `icon` (optional leading icon component), `onClick`, `ariaLabel`.
2. Component handles narrow-viewport collapse to icon-only via a responsive breakpoint constant shared with the top bar.
3. Component has unit tests covering: rendering each state, icon presence/absence, click handler, aria-label output.
4. `Header.jsx` renders the Autopilot pill using `StatusPill` with `subsystem="Autopilot"`, a `lucide-react` icon (e.g. `Bot` or `Zap`), and state labels `Active` / `Paused` / `Disabled`.
5. `SlimTopBar.jsx` renders the Autopilot pill using `StatusPill` with identical configuration.
6. Dropdown in `Header.jsx` heading reads "Autopilot Status"; action verbs read "Pause Autopilot" / "Resume Autopilot" / "Disable Autopilot".
7. Dropdown link to the feature page reads "Configure in Autopilot" (unchanged).
8. Dropdown's state summary line (currently "🟢 Active - Running normally" etc.) is updated to "Autopilot active / paused / disabled" phrasing.
9. Pill `aria-label` reads `"Autopilot status: <state>. Open Autopilot menu"`.
10. No regression in Pause / Resume / Disable behaviour (existing state setter still wired; state persists per-session as today).

## Validation steps

1. Load the app, desktop viewport. Pill renders `[🤖 Autopilot: Active]` with icon + text.
2. Click pill → dropdown opens with heading "Autopilot Status" and action buttons "Pause Autopilot", "Disable Autopilot".
3. Click "Pause Autopilot" → pill updates to `Autopilot: Paused`. Click "Resume Autopilot" → back to `Active`. Click "Disable Autopilot" → `Autopilot: Disabled`.
4. Navigate to a route that uses `SlimTopBar` (e.g. Overview). Confirm pill renders identically.
5. Resize viewport below mobile breakpoint. Pill collapses to icon-only; hover tooltip shows "Autopilot: Active"; keyboard focus reads same state.
6. Screen reader (VoiceOver / NVDA) announces "Autopilot status: Active. Open Autopilot menu." on focus.
7. Tab order and focus rings render correctly around the pill and dropdown items.

## Risks & rollback

**Risks:**

- Two files to update; missing one leaves inconsistent labels. Mitigation: unit test assertions per variant.
- Minor visual regression possible from the refactor. Mitigation: capture before/after screenshots in the PR.

**Rollback:**

- Pure frontend; revert the PR to restore the previous pill.
