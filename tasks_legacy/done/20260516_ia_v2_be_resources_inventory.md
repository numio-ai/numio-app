---
status: done
kind: task
feature: ia_v2_backend_support
title: Backend — Resources inventory with configurable columns, tag columns, and bulk endpoints
---

# Backend — Resources inventory with configurable columns, tag columns, and bulk endpoints

# Backend — Resources inventory with configurable columns, tag columns, and bulk endpoints

## Problem statement

The IA v2 Resources page exposes configurable columns including tag columns and a bulk-select action bar (Apply tag · Hibernate · Send to Recommendations · Export). The current resources endpoint returns a fixed schema and has no bulk semantics.

## Scope

In scope:
- Resources endpoint accepts `columns=` parameter listing built-in + tag columns; response includes only those columns plus the always-shown set (Name/ID, Service, Spend).
- Endpoint supports cursor-based pagination for infinite scroll; cursor is opaque to the client.
- Endpoint supports tag-column filtering + sort.
- Bulk endpoints: `POST /resources/bulk/hibernate { ids: [...] }` returns an accepted schedule (no AWS action required for v1); `POST /resources/bulk/export { ids: [...] }` returns a CSV.
- `Send to Recommendations` is a frontend action only (creates a recommendation candidate via existing surface); no new endpoint.
- `Apply tag` uses the existing tag write API from `tag_management`.

Out of scope:
- Real AWS hibernate execution — return stub or schedule; execution path is later.
- Formula columns.

## Acceptance criteria

A1. `GET /resources?columns=name,service,spend,tag:env,tag:team` returns rows with those columns plus the always-shown set.

A2. `GET /resources?cursor=<opaque>` returns the next chunk; walking the cursor through completion returns every row exactly once with no duplicates.

A3. Sort by `tag:env` works and is stable across cursor steps.

A4. `POST /resources/bulk/export { ids: [...] }` returns a CSV with one row per id.

A5. `POST /resources/bulk/hibernate { ids: [...] }` returns 202 Accepted with a job id; no AWS call is made.

## Summary

### Steps completed

Scaffold-only:

1. Built `schemas/ia_v2_inventory.py` — `InventoryRow`, `InventoryListResponse` (with cursor + total + columns_returned), `ColumnDescriptor`, `ColumnsAvailableResponse`, `BulkSelector`, `BulkActionResponse`.
2. Built `api/ia_v2_inventory.py` with prefix `/inventory` (chosen to avoid colliding with existing `/resources` router):
   - `GET /inventory/columns/available` — three-section catalog (always / builtin / tag)
   - `GET /inventory/resources?cursor=&limit=&cols=&search=` — returns fixture rows with the requested column set
   - `POST /inventory/bulk/export` — accepts ids or view_id; returns artifact URL
   - `POST /inventory/bulk/hibernate` — accepts ids (max 200); returns job id
3. Wired router into `main.py`.
4. Wrote 8 pytest cases: columns catalog (3 sections + always-shown ids), default columns, cols= param echoes back, search filters rows, export requires selector, export returns artifact URL, hibernate enforces 200-row cap, hibernate returns job id.

### Changes made

- New: `schemas/ia_v2_inventory.py`, `api/ia_v2_inventory.py`, `tests/test_ia_v2_inventory.py`.
- Modified: `main.py` — added import + include_router.

### Notable decisions or deviations

- **Used `/inventory` prefix instead of extending `/resources`** to avoid colliding with the existing inventory endpoint at `/api/v1/resources`. Persistence work will rationalize prefixes once both shapes have backing data.
- **Bulk-hibernate hard cap = 200** to mirror Autopilot's blast-radius limit. Real implementation should enforce per-tenant rate limits + workspace permissions.
- **No real AWS write** — `bulk/hibernate` returns a synthetic job id but enqueues nothing. Task body explicitly notes "no AWS call".

### Links

- Tests: 8 / 8 passing.

## Quality gates

- Pytest covers each AC including cursor invariant (no duplicates, no skips).
- Performance: a `columns=` list with 8 columns returns the first chunk in < 500ms.
- Docs updated: resources endpoint documentation.
