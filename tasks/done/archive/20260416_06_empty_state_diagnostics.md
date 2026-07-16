---
status: done
kind: task
---

# Diagnostic empty-state rescue for dashboard widgets

**Date:** 2026-04-16

## Context

Dashboard widgets today fall back to generic "No data" empty states when their underlying query returns nothing — see for example `frontend/src/pages/Overview.jsx:65-74` (`EmptyState` / `SetupCTA`). When the root cause is ongoing ingestion rather than actual absence of data, this empty state is unhelpful and unnerving. The original user complaint for this whole plan was exactly this — "no data appears in dashboards, and no way to analyse what's going on."

This task replaces generic empty states with a **diagnostic card** that walks the user through the ingestion pipeline and tells them which stage they are at.

## Problem

Users who recently connected an AWS account see empty widgets and don't know whether the product is broken, misconfigured, or just working in the background.

## Goals

1. Introduce a `PipelineDiagnosticCard` component that can render in place of generic empty states.
2. Derive pipeline stage from account state + ingestion status + recent job history.
3. Surface concrete next action per stage ("connect an account", "CUR export not yet detected", "ingestion running — expected within Xh", "ingestion failed — see details").
4. Replace generic empty states on Overview and Costs widgets where the cause is likely ingestion.

## Non-goals

- Changing the widget's happy-path rendering.
- Replacing empty states on non-ingestion-driven pages (e.g. a page explicitly for "no anomalies detected" stays unchanged).
- Adding new backend endpoints; all stage derivation is frontend composition of existing `/jobs/ingestion-status` + `/accounts` + `/jobs/history`.

## Dependencies

- **Task 03** — `/ingestion` page required as the "View details" deep-link target.

## Constraints & assumptions

- Stage derivation must be deterministic and covered by unit tests with fixture payloads.
- Card must not exceed the visual footprint of the widget it replaces (no pop-out, no modal).
- Acceptable for some widgets to keep their existing empty state if the data isn't ingestion-dependent (e.g. `ActionItemsWidget` may legitimately have zero items).

## Acceptance criteria

1. A `PipelineDiagnosticCard` component exists at `frontend/src/components/PipelineDiagnosticCard.jsx` with a `stage` prop covering:
   - `no_account` — no AWS account registered in the workspace
   - `account_invalid` — registered but not validated / `disconnected` / `incomplete`
   - `awaiting_first_export` — valid account, zero job runs against it, < `INITIAL_EXPORT_GRACE_HOURS` since registration
   - `running` — a job run is currently in progress
   - `recently_ingested_no_data_in_range` — ingested successfully but the query's time range predates the earliest data
   - `failed` — last run for this data source was a failure
2. Each stage renders: an icon matching the state (check / spinner / warning / error), a one-line headline, a 2–3 step checklist showing what has succeeded (✓), what is in progress (⏳), and what is blocked / failed (✗), a one-line expected-next-action, and a secondary button "View details →" linking to `/ingestion`.
3. Primary CTA per stage:
   - `no_account` → "Connect AWS account" → `/settings/integrations`
   - `account_invalid` → "Fix connection" → `/settings/integrations`
   - `awaiting_first_export` → "Learn about CUR exports" → external docs link (pulled from config or a constant)
   - `running` → no primary CTA; secondary "View details" only
   - `recently_ingested_no_data_in_range` → "Change time range" → focuses the widget's own time selector via a callback prop
   - `failed` → "View details →" (primary) → `/ingestion`
4. A stage-derivation hook `useWidgetPipelineStage({ dataSource, startDate, endDate })` computes the stage from existing API responses (accounts, ingestion-status, history). Fully unit-tested across the decision tree with fixtures.
5. `SetupCTA` (`frontend/src/components/SetupCTA.jsx`) usages in `Overview.jsx` — specifically inside `TotalSpendWidget` and any widget currently passing `showSetupCTA` — now delegate to `PipelineDiagnosticCard` when the query returns empty.
6. `SpendTrendWidget` and `TopCostDriversWidget` use the diagnostic card for their empty states when the zero-data condition is ingestion-dependent.
7. Applied to the primary Costs-page widget (Cloud Usage, etc.) where an empty result is plausibly ingestion-driven.
8. Diagnostic card must NOT appear when the widget is legitimately empty (e.g. compliance widget returns no resources even though ingestion is `Synced`); those continue to use their existing empty state.
9. Unit / component tests cover:
   - Stage derivation across every decision-tree branch
   - Card renders the correct headline / CTA per stage
   - CTA actions (navigation, callback firing for time-range case)

## Validation steps

1. Fresh workspace, no accounts → Overview widgets show diagnostic card at stage `no_account` with CTA to Integrations.
2. Register an AWS account but with invalid role ARN → widgets show `account_invalid` with CTA to fix connection.
3. Connect a valid account, no CUR export in S3 yet → widgets show `awaiting_first_export` with explanatory copy and link to docs.
4. Trigger a CUR job manually and observe while it is running → widgets show `running` with spinner.
5. Complete a successful run. Set the widget time range to a period predating the data → widgets show `recently_ingested_no_data_in_range` with "Change time range" CTA that focuses the time selector.
6. Induce a job failure → widgets show `failed` with "View details →" linking to `/ingestion`.
7. Compliance / action-items widgets in a Synced state with genuinely zero results → show their existing empty state, not the diagnostic card.

## Risks & rollback

**Risks:**

- Stage-derivation logic is a source of bugs if API shapes drift. Mitigation: fixture-driven unit tests and a single centralized hook rather than per-widget branching.
- Diagnostic card replacing familiar empty states could confuse returning users. Mitigation: reserve diagnostic card for ingestion-dependent widgets; keep existing empty states elsewhere.

**Rollback:**

- Frontend-only. Revert PR; widgets fall back to previous empty states.
