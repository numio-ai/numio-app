---
status: done
---

# Docker Compose Update for Local Development

## Problem Statement

The current Docker Compose setup does not include PostgreSQL or a background worker service. Developers need a single `docker compose up` command that brings up the complete local development environment: frontend, backend API, background worker, and database.

## Scope

**In scope:**
- Add PostgreSQL service to `docker-compose.yml` with persistent local volume for data
- Add a background worker service (`numio-worker`) that runs the same backend codebase but starts the job scheduler instead of the API server
- Ensure the backend API service (`numio-api`) depends on PostgreSQL being ready before starting
- Ensure the worker service depends on PostgreSQL being ready before starting
- Environment variables for database connection are configured for all services that need database access
- Verify that `docker compose up` brings up all four services (frontend, API, worker, PostgreSQL) and they can communicate

**Out of scope:**
- Production Docker Compose changes (production deployment has its own configuration)
- Kubernetes or other orchestration
- Adding Redis, message queues, or other infrastructure services
- Changes to Dockerfiles (unless required to support the worker entrypoint)

## Acceptance Criteria

1. `docker compose up` starts four services: frontend (numio-ui), backend API (numio-api), background worker (numio-worker), and PostgreSQL
2. PostgreSQL data persists across `docker compose down` / `docker compose up` cycles (local volume)
3. The backend API can connect to PostgreSQL and `/health` reports database connectivity
4. The worker service starts and connects to PostgreSQL
5. The frontend can reach the backend API
6. `docker compose down` cleanly stops all services

## Quality Gates

- `docker compose up` starts all four services without errors
- `curl http://localhost:8000/health` returns OK with database status
- Frontend loads at `http://localhost:5173/` (or configured port)
- `docker compose down` stops all services cleanly
- @dev-runbook.md - contains the correct instructions for managing the local development environment.
