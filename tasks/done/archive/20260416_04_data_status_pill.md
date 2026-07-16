---
status: done
kind: task
---

# Top-bar Data status pill + popover

**Date:** 2026-04-16

## Context

Task 02 lands the `StatusPill` primitive and renames the existing pill to `Autopilot: <state>`. Task 03 lands the `/ingestion` page. This task adds the second top-bar pill — `Data: <state>` — giving users ambient awareness of ingestion health without navigating anywhere.

## Problem

Without a passive signal, users only learn about ingestion failures when a dashboard looks empty or a report looks stale. Peripheral awareness is the industry-standard fix (Stripe, Datadog, Vercel). Without it, Task 03's page exists but users don't know when to visit it.

## Goals

1. Add a `Data: <state>` pill in the top bar, sibling to the Autopilot pill, using the `StatusPill` primitive from Task 02.
2. Derive state from `/jobs/ingestion-status` across accounts in the current workspace.
3. Open a compact popover on click with an accounts summary and deep link to `/ingestion`.

## Non-goals

- Inline freshness on dashboard widgets — Task 05.
- Empty-state diagnostics — Task 06.
- App-shell banners — Task 07.
- Admin actions in the popover (triggers belong on the `/ingestion` page only).

## Dependencies

- **Task 02** — `StatusPill` primitive must exist.
- **Task 03** — `/ingestion` route must exist so the popover can deep-link.

## Constraints & assumptions

- Must render in both `Header.jsx` and `SlimTopBar.jsx`.
- Popover max width ~360px; mirrors the notifications popover pattern for consistency.
- Popover contains no destructive or admin actions.
- Polling interval 60s while app in foreground; pause when tab hidden (Page Visibility API) to avoid waste.
- Thresholds are frontend constants named and documented in code.

## Acceptance criteria

1. A `DataStatusPill` component exists at `frontend/src/components/DataStatusPill.jsx` (or equivalent), using `StatusPill`.
2. Pill leading icon is consistent with the Data Ingestion sidebar entry from Task 03 (e.g. `Database` or `Activity`).
3. Pill label: `Data: Synced` / `Data: Syncing` / `Data: Delayed` / `Data: Issue` / `Data: Not configured`.
4. State derivation rules (pure function, unit-tested):
   - Zero accounts in workspace → `Not configured`
   - Any account with `last_status == "failed"` → `Issue`
   - Else: any account where `last_sync_at` is null but account was created < `INITIAL_SYNC_GRACE_HOURS` ago OR any recent run in `/jobs/history` has status `running` → `Syncing`
   - Else: any account with `last_sync_at` older than `STALE_THRESHOLD_HOURS` → `Delayed`
   - Else → `Synced`
   - Thresholds exported as named constants with comments.
5. Data source: hook `useDataPillState` fetches `/jobs/ingestion-status` on mount and every 60s; pauses on `document.hidden`; shared cache across both top-bar variants if both mount simultaneously.
6. Click opens a popover (max 360px wide) containing:
   - Header: "Data ingestion · <state>" with matching dot color
   - List of up to 5 most-recently-synced accounts: alias, data source, last sync relative time, row count; "View all accounts" link if > 5.
   - Most recent failure (if any): account alias, data source, timestamp, one-line error (truncated, full on hover/click).
   - Footer link: "Open Data Ingestion →" navigating to `/ingestion`.
   - No action buttons beyond the footer link.
7. Popover closes on outside click, Escape, route navigation, or clicking the pill again.
8. `aria-label`: `"Data ingestion status: <state>. Open details"`; popover is an accessible disclosure (`aria-haspopup`, `aria-expanded`).
9. Narrow viewport: pill collapses to icon-only; popover still functional (or falls back to a full-screen sheet on mobile, matching the existing notifications pattern).
10. Unit tests cover:
    - State derivation across the full decision tree with mocked ingestion-status payloads
    - Popover opens / closes
    - Deep link navigates to `/ingestion`
    - Polling pauses on `document.hidden`

## Validation steps

1. No accounts → pill shows `Data: Not configured`; popover shows "No accounts connected" + link to Integrations.
2. Add a new account, no scheduled run yet → pill within seconds shows `Syncing`.
3. After first successful run → `Synced`; popover shows correct last-sync time and row count.
4. Induce failure (e.g. revoke CUR creds) and wait for next scheduled run → `Issue`; popover surfaces the failure with one-line error and timestamp.
5. Stop the scheduler for > `STALE_THRESHOLD_HOURS` without inducing failure → `Delayed`.
6. Click pill → popover opens; click "Open Data Ingestion →" → route to `/ingestion`.
7. Resize to narrow viewport → pill collapses to icon; popover still reachable and readable.
8. Hide the tab for 10 minutes → return and inspect network: no calls fired while hidden; resumes on focus.

## Risks & rollback

**Risks:**

- Polling `/jobs/ingestion-status` from every open tab could add load. Mitigation: 60s interval + Page Visibility pause; factor to single in-memory cache shared between both top-bar variants.
- State derivation thresholds may not match real CUR cadence in all environments. Mitigation: constants are named and documented; easy to tune; consider server-provided thresholds in a future task.

**Rollback:**

- Frontend-only. Revert PR to remove the second pill; Autopilot pill (from Task 02) unaffected.
