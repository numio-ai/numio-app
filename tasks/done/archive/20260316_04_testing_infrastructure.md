---
status: done
---

# Testing Infrastructure

## Problem Statement

The backend has no structured testing infrastructure. Without it, there is no way to verify that features work correctly or to prevent regressions as the codebase grows. A testing foundation is needed that supports both unit tests and integration tests against a real database.

## Scope

**In scope:**
- pytest configured with async support (asyncio_mode = "auto")
- Test database setup and teardown: tests run against a real PostgreSQL instance, not mocks
- Database is reset between test runs (clean state for each test session)
- Factory fixtures for creating common test objects (workspaces, users) so that tests don't repeat boilerplate setup
- At least one integration test that verifies the API health endpoint against a running database
- At least one integration test that verifies workspace-scoped data isolation
- Documentation for developers on how to run tests locally

**Out of scope:**
- Frontend testing (separate concern, later phase)
- CI/CD pipeline configuration (can be added once tests exist)
- Performance or load testing
- Test coverage thresholds (premature at this stage)

## Constraints

- Tests must run against a real PostgreSQL instance, not SQLite or mocks — this prevents the class of bugs where tests pass but production fails due to database behavior differences
- Test database must be isolated from the development database (different database name or instance)

## Acceptance Criteria

1. `cd backend && uv run pytest` discovers and runs all tests
2. Tests run against a real PostgreSQL database
3. Test database is in a clean state at the start of each test session (migrations applied, no leftover data)
4. Factory fixtures exist for creating workspace and user objects in tests
5. At least one test verifies `/health` returns success when the database is connected
6. At least one test verifies that querying data in workspace A does not return data from workspace B
7. Developer guide documents how to set up and run tests locally

## Quality Gates

- `cd backend && uv run pytest` passes with all tests green
- Tests do not leave data in the test database after completion
- Linting passes: `cd backend && uv run ruff check .`
