---
status: done
kind: task
feature: tag_management
title: Frontend audit page split into Setup and Operations tabs
---

# Frontend audit page split into Setup and Operations tabs

## Problem statement

The frontend audit page (`frontend/src/pages/Govern/AuditLog.jsx`, and `pages/Settings/AuditLogs.jsx`) reads from `/api/v1/audit-events` via `frontend/src/api/dashboard.js:437`. Task `audit_events_rename` renames that route to `/audit-config-events` and `audit_action_events_schema` adds `/audit-action-events`. Without this task the audit page 404s after the rename. Spec §9.2 and §11 step 4.

## Scope

In scope:
- Update `frontend/src/api/dashboard.js` to call `/api/v1/audit-config-events`; add client functions for `/audit-action-events` list and `/audit-action-events/{event_id}` detail.
- Split `/govern/audit` into two tabs: **Setup** (default, reads `/audit-config-events`, same filters as today) and **Operations** (reads `/audit-action-events`, adds `operation_type` filter with values `tag_apply`, `tag_remove`).
- Operations row click opens a drawer showing the parent event + all child items from `/audit-action-events/{event_id}`.

Out of scope:
- Backend endpoints (tasks `audit_events_rename`, `audit_action_events_schema`).
- Tag-write UI (task `tag_apply_api`).

## Acceptance criteria

A1 (=feature A9). `/govern/audit` shows Setup (default) and Operations tabs. Setup queries `/audit-config-events`; Operations queries `/audit-action-events`. Clicking an Operations row opens a drawer with parent event + child items.
A2. No frontend code references `/api/v1/audit-events` (old route).

## Quality gates

- `cd frontend && npm test` green.
- `cd frontend && npm run build` clean.
- `git grep -n "audit-events" frontend/src/` returns zero hits.
- Manual smoke: both tabs load against a running backend; drawer renders child items.
- Must ship together with `audit_events_rename` (spec §11).

## Summary

**Steps completed**
1. Repointed `getAuditConfigEvents` (renamed from `getAuditEvents`) to `/api/v1/audit-config-events`; added `getAuditActionEvents` + `getAuditActionEvent` client functions.
2. Built `AuditActionEventTable` (Operations tab): filters (operation_type select, actor, status, dates), status pills, pagination, and an `OperationDrawer` showing parent event + child items via the detail endpoint.
3. Rebuilt `GovernAuditLog` as a two-tab page: Setup (default, existing config table) + Operations.
4. Verified: `npm test` 357 passed, `npm run build` clean, zero `audit-events` refs; browser smoke confirmed both tabs and the drawer (seeded a partial_failure event with success + AccessDenied child items).

**Changes made**
- `frontend/src/api/dashboard.js` — renamed + 2 new functions.
- `frontend/src/components/AuditActionEventTable.jsx` (new), `frontend/src/components/AuditEventTable.jsx` (import swap).
- `frontend/src/pages/Govern/AuditLog.jsx` — two-tab layout.

**Notable decisions**
- `Settings/AuditLogs.jsx` keeps the config table (`AuditEventTable compact`) unchanged — it is the Setup view; only `/govern/audit` got the two-tab split per spec §9.2.
- Drawer implemented as a simple right-side overlay panel (KISS), no new dependency.

**Links**: shipped with `audit_events_rename` + `audit_action_events_schema` in one commit. Feature `tag_management`.
