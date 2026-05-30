---
status: done
kind: task
feature: tag_management
title: audit_action_events schema, models, repository, endpoints
---

# audit_action_events schema, models, repository, endpoints

## Problem statement

Numio has no model for actions taken against external systems (tag writes, future cleanups). Feature `tag_management` needs a two-level audit: one parent row per logical operation, one child row per leaf change with before/after/AWS request id. Spec §5.2, §5.3, §8.2, §11 step 2.

## Scope

In scope:
- Alembic revision (M2): create `audit_action_events` (cols per spec §5.2) and `audit_action_event_items` (cols per spec §5.3, FK → parent, cascade delete). Indexes per spec. Reversible downgrade.
- SQLAlchemy models `AuditActionEvent`, `AuditActionEventItem`; `AuditActionEventRepository`.
- Pydantic schemas for parent + child + list.
- Endpoints: `GET /api/v1/audit-action-events` (paginated; filters `operation_type`, `actor`, `status`, date range; viewer+) and `GET /api/v1/audit-action-events/{event_id}` (parent + all child items; viewer+).

Out of scope:
- Writing rows (task `tag_write_service` is the first writer).
- Frontend (task `audit_page_split`).

## Acceptance criteria

A1. Migration upgrade/downgrade round-trips cleanly. Child FK cascades on parent delete.
A2. `GET /audit-action-events` returns paginated rows honoring each filter; `GET /audit-action-events/{event_id}` returns parent + child items.
A3. Empty state returns 200 with empty list (no rows yet).

## Quality gates

- `cd backend && uv run pytest` green; new tests cover repository + both endpoints + filters.
- `cd backend && uv run ruff check .` clean.
- Alembic upgrade/downgrade verified against this worktree's Postgres.

## Summary

**Steps completed**
1. Added migration `d2e3f4a5b6c7` creating `audit_action_events` (parent) and `audit_action_event_items` (child, FK cascade) with spec indexes; reversible.
2. Added models `AuditActionEvent` / `AuditActionEventItem` (relationship + cascade), exported in `models/__init__.py`.
3. Added `AuditActionEventRepository` with read methods (list with filters, get-with-items) and write helpers (`create_event`, `add_item`, `finalize_event`) for the future tag-write service.
4. Added schemas and endpoints `GET /audit-action-events` (paginated; operation_type/actor/status/date filters) and `GET /audit-action-events/{event_id}` (parent + items); registered router.
5. Verified: 9 new tests pass (repo, cascade, filters, both endpoints, 404, empty, route registration); full backend suite 662 passed; ruff clean; migration round-trip.

**Changes made**
- `models/audit_action_event.py`, `db/audit_action_event_repository.py`, `schemas/audit_action_event.py`, `api/audit_action_events.py` (all new).
- `models/__init__.py`, `main.py` updated.
- `alembic/versions/d2e3f4a5b6c7_create_audit_action_events.py` (new).
- `tests/test_audit_action_events.py` (new).

**Notable decisions**
- Distributed the spec §11 "M2" schema across owning tasks: this task creates only the two action tables. `aws_org_tag_policy`, `tag_writer_role_arn`, and `equivalence_groups` land in their own tasks' migrations — keeps each task's schema self-contained and parallelizable.
- Repository includes write helpers now (not just reads) so `tag_write_service` reuses it without a second repo.

**Links**: shipped with `audit_events_rename` + `audit_page_split` in one commit. Feature `tag_management`.
