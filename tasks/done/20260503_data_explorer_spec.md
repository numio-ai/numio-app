---
status: done
kind: task
feature: data_explorer
title: Data Explorer spec
draft: true
---

# Data Explorer spec

## Problem statement

The Data Explorer feature needs a single source of truth for the API contract, UI layout, role gating, read-only enforcement strategy, and operational defaults (statement timeout, row cap). Locking these before code prevents drift between backend, frontend, and operator docs.

## Scope

**In**

- New file `docs/data-explorer/data-explorer-spec.md` covering:
  - Goals and non-goals (mirroring the feature file).
  - API contract: `POST /api/v1/data-explorer/query` (request, response, error model, truncation flag), `GET/POST/PUT/DELETE /api/v1/data-explorer/queries` (saved-query shape).
  - Saved-query data model (columns, uniqueness, workspace scoping).
  - Read-only enforcement: separate Postgres role `numio_readonly`, separate connection pool, no app-level SQL parsing.
  - Statement timeout default and how it is configured.
  - Row cap default and how truncation is reported.
  - Role gating: admin-only in prod; synthetic admin in dev mode.
  - UI layout: editor, Run, result table, saved-queries panel.
  - A reserved "Worked example" section to be filled by `data_explorer_validate_motivating_bug`.
- An entry in `CLAUDE.md` *Full list of documentation* pointing to the new spec.

**Out**

- Implementation. This task only defines the contract.
- Chat / NL→SQL design.

## Acceptance criteria

1. `docs/data-explorer/data-explorer-spec.md` exists with all sections listed above.
2. The API contract is precise enough that backend and frontend tasks can implement against it without further design dialogue.
3. The spec is linked from `CLAUDE.md` documentation list.
4. The spec calls out single-tenant assumption and points to the feature file for the full rationale.

## Quality gates

- `./scripts/taskman.sh validate` passes.
- Spec is reviewed by the user before merging.
- Markdown lints cleanly (no broken internal links).

## Summary

### Steps completed

1. Read feature file, architecture doc, existing API patterns, auth core, and DB session module to ground spec decisions.
2. Drafted `docs/data-explorer/data-explorer-spec.md` covering goals/non-goals, architecture summary, full API contract for `/query` and `/queries` CRUD, saved-query data model, read-only role + connection design, operational defaults, role gating, UI layout, and a reserved Worked-example section.
3. Linked the spec from `CLAUDE.md` documentation list.
4. Ran `taskman.sh validate` — passes (only pre-existing legacy warnings).
5. User reviewed and approved.

### Changes made

- New: `docs/data-explorer/data-explorer-spec.md`
- Modified: `CLAUDE.md` (one new bullet under *Full list of documentation*)

### Notable decisions

- **No app-level SQL parsing.** Read-only enforcement is a dedicated `numio_readonly` Postgres role with `SELECT`-only grants. Reasoning: SQL parsing is brittle (CTEs, comments, `WITH ... INSERT`) and misclassification is too costly.
- **`ALTER DEFAULT PRIVILEGES`** in the role-creation migration so future tables are automatically readable by `numio_readonly` without follow-up grants.
- Saved queries: any admin in workspace can edit/delete any saved query (no per-row ownership) — Numio is single-tenant single-admin in practice.
- Result rows returned as opaque values — frontend renders raw, no number/date reformatting (operators are debugging raw rows).
- Write-tier rate limit (`RATE_LIMIT_WRITE`, 20/min) on `/query` despite read-only role — interactive SQL is operationally write-shaped.
- Defaults: 10 s statement timeout, 1000 row cap, 50 KB SQL length cap. All env-configurable.

### Links

- Spec: `docs/data-explorer/data-explorer-spec.md`
- Feature: `tasks/features/20260503_data_explorer.md`
