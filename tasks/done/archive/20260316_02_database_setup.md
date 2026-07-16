---
status: done
---

# Database Setup with PostgreSQL, Alembic, and Workspace Scoping

## Problem Statement

The backend has no database, no migration framework, and no data persistence layer. All downstream features (cost data storage, resource inventory, findings, budgets, policies) require a database. The foundation must include schema migration tooling and workspace scoping to support future multi-tenancy without requiring schema rework later.

## Scope

**In scope:**
- PostgreSQL as the application database, running in Docker for local development
- SQLAlchemy as the ORM / data access layer with async support
- Alembic for database schema migrations
- Initial migration that creates base tables: workspaces and users
- All tables include a `workspace_id` column for workspace scoping
- Data access layer scopes queries by workspace
- A single default workspace is created automatically on first run (seed data or initialization logic)
- Add required Python dependencies: SQLAlchemy, Alembic, psycopg (async driver)

**Out of scope:**
- Authentication or authorization logic
- User registration or login flows
- API endpoints for workspace or user management
- Docker Compose changes (separate task)
- Any tables beyond workspaces and users (those come in later phases)

## Constraints

- Python 3.12+ required
- Use `uv` as the package manager (not pip)
- Backend uses `hatchling` build system
- Follow existing ruff linting rules (line-length=100, py312 target)
- Docker is required to run PostgreSQL locally for quality gate validation

## Acceptance Criteria

1. PostgreSQL is accessible for local development (developer documentation explains how to run it)
2. Alembic is configured and the initial migration creates `workspaces` and `users` tables
3. Both tables include a `workspace_id` column (users belong to a workspace; workspaces have their own ID as the scoping key)
4. Running migrations on a fresh database produces the expected schema
5. A default workspace is created automatically when the application initializes for the first time
6. Data access layer provides workspace-scoped queries — a query for workspace A never returns data from workspace B
7. Migrations are reversible (upgrade and downgrade both work)

## Quality Gates

Prerequisites — start a local PostgreSQL instance before running the gates:
```bash
docker run -d \
  --name numio-postgres \
  -e POSTGRES_USER=numio \
  -e POSTGRES_PASSWORD=numio \
  -e POSTGRES_DB=numio \
  -p 5432:5432 \
  postgres:16-alpine
```

Gates (run from the `backend/` directory):
- Alembic migrations run cleanly: `cd backend && uv run alembic upgrade head`
- Alembic downgrade works: `cd backend && uv run alembic downgrade base`
- At least one integration test verifies workspace-scoped data isolation
- Linting passes: `cd backend && uv run ruff check .`
- All tests pass: `cd backend && uv run pytest`
