---
status: done
kind: task
---

# Redesign `numio-dev.sh` CLI for Development Workflow

**Date:** 2026-04-12

## Context

`numio-dev.sh` is the developer-facing CLI for local development. It currently has three commands: `init`, `dev <backend|frontend>`, and `build`. A separate script `numio-ctl.sh` handles container management for production-like environments and is out of scope.

Numio has five services defined in `docker-compose.yml`:
- **Infrastructure:** postgres, valkey (always run as containers)
- **Application:** backend, frontend, worker (run natively with hot reload during development)

## Problem

1. **Redundant naming.** The `dev` subcommand duplicates the script name: `numio-dev.sh dev backend` reads as "dev dev backend". The intent is to *run* a component, not to "dev" it.

2. **Missing architecture awareness.** The script only knows `backend` and `frontend`. A developer's daily workflow requires 3 separate tools and a manual migration command:
   - `docker compose up postgres valkey -d` (start infra)
   - `cd backend && uv run alembic upgrade head` (migrate)
   - `numio-dev.sh dev backend` (terminal 1)
   - `numio-dev.sh dev frontend` (terminal 2)

3. **Missing lifecycle commands.** The script can start components but cannot stop them, show status, view logs, restart, or rebuild. Developers fall back to raw `docker compose` and manual process management for these operations.

## Goals

Replace the `dev` command with a complete set of development lifecycle commands that reflect Numio's architecture (5 services, 2 categories) and cover the full developer workflow from a single tool.

### Target command set

| Command | Description |
|---------|-------------|
| `run [component...]` | Run component(s). App components (backend, frontend, worker) run natively with hot reload. Infra components (postgres, valkey) start as containers. Auto-starts infra dependencies if not already running. |
| `run all` | Run everything: infra in containers, app components natively. |
| `stop [component...]` | Stop specific component(s). |
| `stop all` | Stop all running components. |
| `status` | Show what is running and how (native process vs container). |
| `logs [component...]` | Tail logs from specific component(s) or all. |
| `restart [component...]` | Soft restart: restart process, keep data and state. |
| `rebuild [component...]` | Hard restart: rebuild containers, force-recreate, re-run migrations. |
| `migrate` | Run `alembic upgrade head` against the local database. |
| `health` | Backend health check (`GET /health`). |
| `init` | First-time setup — unchanged. |
| `build` | Build Docker images — unchanged. |

### Component names

| Name | Type | What it means |
|------|------|---------------|
| `backend` | app | FastAPI server (native, hot reload via uvicorn `--reload`) |
| `frontend` | app | Vite dev server (native, hot reload) |
| `worker` | app | Background worker (native) |
| `postgres` | infra | PostgreSQL (container) |
| `valkey` | infra | Valkey/Redis cache (container) |
| `infra` | alias | postgres + valkey |
| `all` | alias | All five services |

### Dependency auto-start behavior

When running an app component, the script must ensure its infra dependencies are running:
- `run backend` — auto-starts postgres and valkey if not running
- `run frontend` — no infra dependency, runs directly
- `run worker` — auto-starts postgres if not running

## Non-goals

- Changes to `numio-ctl.sh` (reserved for production container management)
- Changes to `docker-compose.yml`
- Adding new services or components
- Background/daemon mode for native processes (developer runs each in a terminal)

## Constraints and assumptions

- Infrastructure components always run as Docker containers via `docker compose`
- App components always run natively (from source, with hot reload) in the foreground
- The main script should remain a thin dispatcher. Business logic for each command group should live in helper scripts under `scripts/tools/` (existing pattern: `tools/dev.sh`, `tools/build.sh`, etc.). Not a hard rule — use judgment on when splitting improves maintainability.
- `numio-ctl.sh` and `numio-dev.sh` must not conflict (they manage different execution modes)
- Docker and docker compose must be available for any infra-related command

## Acceptance criteria

1. `numio-dev.sh run backend` starts postgres and valkey (if not running), then starts the backend natively with hot reload
2. `numio-dev.sh run frontend` starts the Vite dev server natively
3. `numio-dev.sh run worker` starts postgres (if not running), then starts the worker natively
4. `numio-dev.sh run all` starts infra in containers and all app components natively
5. `numio-dev.sh stop <component>` stops the specified component
6. `numio-dev.sh status` shows running components with their mode (native/container)
7. `numio-dev.sh logs <component>` tails logs for the specified component
8. `numio-dev.sh restart <component>` performs a soft restart
9. `numio-dev.sh rebuild <component>` performs a hard restart (rebuild + force-recreate for containers; restart + re-migrate for app)
10. `numio-dev.sh migrate` runs `alembic upgrade head`
11. `numio-dev.sh health` checks `GET http://localhost:8000/health`
12. `init` and `build` commands continue to work as before
13. Help text (`-h`, `--help`) documents all commands with examples
14. Dev runbook (`docs/dev-runbook.md`) and project structure docs are updated to reflect the new commands

## Validation steps

1. From a clean state (`docker compose down -v`), run `numio-dev.sh run backend` — postgres and valkey should auto-start, backend should start with hot reload
2. Run `numio-dev.sh status` — should show postgres (container), valkey (container), backend (native)
3. Run `numio-dev.sh stop backend` then `numio-dev.sh status` — backend should be gone, infra still running
4. Run `numio-dev.sh migrate` — should apply migrations without error
5. Run `numio-dev.sh health` — should return healthy response
6. Run `numio-dev.sh run all` — all 5 services should be running
7. Verify `numio-dev.sh --help` shows the full command set

## Risks and rollback

- **Risk:** Developers have muscle memory for `numio-dev.sh dev backend`. Consider keeping `dev` as a hidden alias for `run` during a transition period.
- **Rollback:** Script changes are self-contained. Revert the commit to restore the previous version.
