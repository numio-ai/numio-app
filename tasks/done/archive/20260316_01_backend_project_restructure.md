---
status: done
---

# Backend Project Restructure

## Problem Statement

The current backend (`backend/src/numio/`) is an outdated stub with a flat structure that does not support the target application architecture. Before any feature work can begin, the project layout must be reorganized into a modular structure that cleanly separates concerns: business logic, API layer, MCP layer, data models, schemas, and background jobs.

## Scope

**In scope:**
- Reorganize the backend directory structure into distinct modules: `core/` (business logic), `models/` (database models), `schemas/` (API request/response schemas), `jobs/` (background job definitions), `api/` (REST API routes), `mcp/` (MCP server endpoints)
- Ensure existing functionality (health endpoint, basic API routes, MCP endpoint) continues to work after restructure
- Update all internal imports to reflect the new structure

**Out of scope:**
- Adding new functionality, endpoints, or dependencies
- Database setup (separate task)
- API scaffolding changes (separate task)
- Changes to frontend, deployment scripts, or Docker configuration

## Acceptance Criteria

1. Backend directory structure has distinct modules: `core/`, `models/`, `schemas/`, `jobs/`, `api/`, `mcp/`
2. `api/` and `mcp/` modules are thin layers that delegate to `core/` — no business logic lives in API or MCP layers
3. The backend starts successfully and responds to existing endpoints (`/health`, `/api/v1/`, `/mcp`)
4. All existing tests pass after restructure
5. No circular import dependencies between modules

## Quality Gates

- Backend starts without errors: `cd backend && uv run uvicorn numio.main:app`
- Existing tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
