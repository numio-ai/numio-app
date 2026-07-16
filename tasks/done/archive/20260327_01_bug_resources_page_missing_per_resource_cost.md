---
status: done
kind: bug
related_task: P4.4
---

# Bug: Resources page always shows "N/A" for per-resource cost

## Problem Statement

The Resources page (P4.4) always displays "N/A" for per-resource cost, regardless of whether CUR data is available. Per the P4.4 acceptance criteria (AC7), per-resource cost should be shown when CUR data is available (matched by `resource_id` from `cost_records`), and "N/A" only when Cost Explorer data is the sole source.

The current implementation has no path to display actual cost even if CUR data is present in the database.

## Root Cause

Two gaps prevent per-resource cost from being displayed:

1. **Backend**: The `GET /api/v1/resources` endpoint does not join `cloud_resources` with `cost_records`. The `CloudResourceResponse` schema (`backend/src/numio/schemas/cloud_resource.py`) has no cost field.
2. **Frontend**: The Resources page (`frontend/src/pages/Resources/ResourcesPage.jsx`) hardcodes "N/A" in the cost column (line 236) and expanded detail (line 294) instead of conditionally rendering based on API data.

The `CostRecord` model already has a `resource_id` column that can be used for the join. The compliance service (`backend/src/numio/core/compliance_service.py`) already performs this join as a reference implementation.

## Scope

**In scope:**
- Add an optional `cost` field to `CloudResourceResponse` schema
- Join `cost_records` in the resources API to return per-resource cost when CUR data exists
- Update Resources page to display cost when available, "N/A" when null

**Out of scope:**
- CUR ingestion pipeline changes
- Cost Explorer integration changes

## Acceptance Criteria

1. When a resource has matching CUR cost data in `cost_records`, the Resources page displays the per-resource cost
2. When a resource has no CUR cost data, the cost column shows "N/A"
3. Existing Resources page functionality (filters, search, compliance) is unaffected

## Quality Gates

- Backend tests pass: `cd backend && uv run pytest`
- Frontend builds without errors: `cd frontend && npm run build`
