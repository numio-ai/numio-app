---
status: done
kind: task
---

# Global app-shell banner when ingestion is failing

**Date:** 2026-04-16

## Context

Tasks 04, 05, and 06 surface ingestion health passively (top-bar pill), inline (widget freshness labels), and contextually (empty-state diagnostics). None of them shout. When ingestion is genuinely broken — not just stale — users may still miss it because they are not looking at the top bar or the specific affected widget.

This task adds a dismissible app-shell banner that renders only when the aggregate ingestion state is `Issue` (hard failure), on every page. Rare, loud, and always actionable.

## Problem

A failing data pipeline can go unnoticed until a user happens to look at a specific surface that carries the signal. For a recover-oriented tool like Numio, that latency is unacceptable.

## Goals

1. Render a single global banner in the app shell when aggregate ingestion state is `Issue`.
2. Provide a concise explanation and a primary CTA to `/ingestion`.
3. Allow per-session dismissal; re-appear on new failure or after session reset.

## Non-goals

- Banners for `Delayed` state (that's what the pill is for — don't over-shout).
- Persistent cross-session dismissal (always re-surface on new session).
- Notifications center integration (future task).
- Per-dashboard "stale" banners (handled inline via Task 05/06).

## Dependencies

- **Task 03** — `/ingestion` required as the banner's link target.
- **Task 04** — reuses the same state-derivation hook / cache as the Data pill to avoid double fetches.

## Constraints & assumptions

- Banner renders in the app shell (e.g. above `SlimTopBar` / `Header`) so it spans all authenticated pages.
- Does not render on Login or unauthenticated routes.
- Visual weight must be proportionate: `Issue` only. Compliance / budget / anomaly banners that already exist (see `CostsMtdBanner.jsx`) are respected and coexist.
- Dismissal state stored in `sessionStorage` keyed per workspace + most-recent-failure timestamp; a new failure after dismissal re-shows the banner.

## Acceptance criteria

1. A component `IngestionFailureBanner` exists at `frontend/src/components/IngestionFailureBanner.jsx` and is mounted once in the app shell (e.g. `frontend/src/App.jsx` just inside the authenticated layout wrapper).
2. Banner consumes the same `useDataPillState` / ingestion-status hook as Task 04 — no duplicate fetches.
3. Banner renders only when aggregate state is `Issue`; hidden otherwise.
4. Content:
   - Icon: amber/red warning glyph
   - Headline: "Data ingestion failing"
   - Short body: "<N> account(s) failing. Costs and reports may be stale or incomplete."
   - Primary action: "View details →" linking to `/ingestion`
   - Dismiss `×` button (per session)
5. Dismissal state is keyed by `(workspace_id, most_recent_failure_timestamp)` in `sessionStorage`. A new failure after dismissal re-shows the banner. Page reload within the same dismissed key keeps it hidden.
6. `role="alert"`; `aria-live="polite"` to announce when the banner appears.
7. Does not render on `/login` or any unauthenticated route.
8. Does not crowd out pre-existing banners (`CostsMtdBanner`, etc.) — stack vertically if multiple are present, ingestion failure first.
9. Unit / component tests cover:
   - Renders only for `Issue`; hidden for other states
   - Dismissal persists across reloads of the same failure
   - New failure timestamp re-shows after dismissal
   - Accessible live-region announcement

## Validation steps

1. Ingestion healthy → no banner on any page.
2. Induce a failure on any account → banner appears on every authenticated page within the next poll cycle; navigation preserves visibility.
3. Click "View details →" → routes to `/ingestion` and highlights the failing account(s).
4. Dismiss the banner → stays hidden across route changes and page reloads within the session.
5. Induce an additional, later failure (new timestamp) → banner reappears.
6. Sign out / sign in → session reset; banner reappears if still failing.
7. Screen reader announces the banner when it first renders.
8. Verify layout interaction: if `CostsMtdBanner` is also visible, banners stack without overlap.

## Risks & rollback

**Risks:**

- Banner noise if the `Issue` threshold is too sensitive. Mitigation: uses same derivation as pill, which already only flags hard `failed` state; thresholds shared and named.
- SessionStorage key scheme bugs could hide banner permanently. Mitigation: unit test the keying logic, key includes failure timestamp to force re-show on new failure.
- Global mount location must not regress auth-gated routing. Mitigation: mount inside the authenticated layout only.

**Rollback:**

- Frontend-only. Revert PR; banner disappears everywhere.
