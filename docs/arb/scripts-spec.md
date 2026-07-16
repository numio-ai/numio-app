# Numio Scripts - User Guide and Functional Specification

**Version:** 3.0
**Last Updated:** 2026-04-12
**Status:** Specification for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [numio-dev.sh - Development CLI](#4-numio-devsh---development-cli)
5. [numio-ctl.sh - Runtime Management](#5-numio-ctlsh---runtime-management)
6. [Shared Utilities](#6-shared-utilities)
7. [Environment Configuration](#7-environment-configuration)
8. [Error Handling](#8-error-handling)
9. [QA Test Cases](#9-qa-test-cases)
10. [Known Limitations](#10-known-limitations)

---

## 1. Executive Summary

The Numio control plane consists of two primary scripts:

| Script | Purpose | Primary Use Cases |
|--------|---------|-------------------|
| `numio-dev.sh` | Development lifecycle | Run/stop/restart services, migrations, health checks, Docker builds |
| `numio-ctl.sh` | Production container management | Start/stop containers, health checks, logs, status |

### Design Principles

- **Separation of concerns**: `numio-dev.sh` for development (native processes + containers), `numio-ctl.sh` for production (containers only)
- **Architecture-aware**: Knows all five Numio services and their dependencies
- **Auto-start dependencies**: Running an app component automatically starts required infrastructure
- **Thin dispatcher**: Main scripts delegate to helper scripts in `scripts/tools/`
- **Idempotent operations**: Commands can be run multiple times safely
- **Fail-fast**: Strict error handling with immediate exit on failure
- **macOS compatible**: Bash 3.2 compatible for macOS default shell

---

## 2. Architecture Overview

```
scripts/
├── numio-dev.sh              # Development lifecycle CLI
├── numio-ctl.sh              # Production container management CLI
└── tools/
    ├── build.sh              # Build command implementation
    ├── common.sh             # Shared utilities (logging, validation)
    ├── dev.sh                # Development lifecycle helpers (run, stop, status, etc.)
    ├── docker.sh             # Docker build helpers
    └── worktree.sh           # Worktree-scoped ports and Compose project names
```

### Script Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     User Commands                           │
├─────────────────────────────────────────────────────────────┤
│  numio-dev.sh                 numio-ctl.sh                  │
│  ├── run <component...>       ├── start [SERVICE]           │
│  ├── stop <component...>      ├── stop [SERVICE]            │
│  ├── restart <component...>   ├── restart [SERVICE]         │
│  ├── rebuild <component...>   ├── status                    │
│  ├── status                   ├── logs [SERVICE]            │
│  ├── log [component...] [-f]  └── health                    │
│  ├── migrate                                                │
│  ├── health                                                 │
│  ├── init                                                   │
│  └── build                                                  │
├─────────────────────────────────────────────────────────────┤
│  tools/common.sh  tools/dev.sh  tools/build.sh              │
│  tools/docker.sh  tools/worktree.sh                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Model

Numio services are split into two categories:

| Category | Components | Execution Mode |
|----------|-----------|----------------|
| **Infrastructure** | postgres, valkey | Docker containers (always) |
| **Application** | backend, frontend, worker | Native processes with hot reload (development) |

Aliases: `infra` = postgres + valkey, `all` = all five services.

### Dependency Map

| App Component | Infra Dependencies |
|---------------|-------------------|
| backend | postgres, valkey |
| frontend | (none) |
| worker | postgres |

When `numio-dev.sh run <app-component>` is called, infra dependencies are auto-started if not already running.

---

## 3. Prerequisites

### Required Software

| Tool | Minimum Version | Used By | Verification Command |
|------|-----------------|---------|---------------------|
| Bash | 3.2+ | All scripts | `bash --version` |
| Node.js | 18+ | Frontend | `node --version` |
| npm | 9+ | Frontend | `npm --version` |
| uv | 0.1+ | Backend | `uv --version` |
| Docker | 20+ | All container operations | `docker --version` |
| Docker Compose | V2 | All container operations | `docker compose version` |
| curl | Any | Health checks | `curl --version` |

### Prerequisite Validation

Scripts automatically validate prerequisites before execution:

- `numio-dev.sh init` validates: node, npm, uv, docker
- `numio-dev.sh run` validates: docker, docker compose (for infra), uv/npm (for app components)
- `numio-dev.sh build` validates: docker, docker compose
- `numio-ctl.sh` validates: docker, docker compose

---

## 4. numio-dev.sh - Development CLI

### 4.1 Purpose

Development lifecycle CLI. Manages Numio services for local development: runs app components natively with hot reload, manages infrastructure containers, and provides ancillary commands (migrate, health, build).

### 4.2 Usage

```bash
./scripts/numio-dev.sh <command> [options]
```

### 4.3 Runtime State

PID files and log files are stored in `.numio/` at the project root:

```
.numio/
├── pids/
│   ├── backend.pid
│   ├── frontend.pid
│   └── worker.pid
└── logs/
    ├── backend.log
    ├── frontend.log
    └── worker.log
```

This directory is in `.gitignore`. PID files enable `stop`, `status`, and `log` to work across terminals. Log files are used when app components run in background mode (`run all`).

### 4.4 Commands

#### 4.4.1 run

**Purpose:** Run one or more components. App components run natively with hot reload. Infra components start as Docker containers. Auto-starts infra dependencies.

**Syntax:**
```bash
./scripts/numio-dev.sh run <component...>
```

**Parameters:**

| Parameter | Required | Values | Description |
|-----------|----------|--------|-------------|
| component | Yes | `backend`, `frontend`, `worker`, `postgres`, `valkey`, `infra`, `all` | One or more components to run |

**Behavior:**

| Scenario | Behavior |
|----------|----------|
| Single app component | Auto-starts infra deps, runs in **foreground** (output to terminal) |
| Single infra component | Starts container in detached mode, returns |
| Multiple components / `all` | Starts infra containers, starts app components in **background**, multiplexes log output |

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Component(s) started (or Ctrl+C in foreground mode) |
| 1 | Dependency failed to start, invalid component |
| 2 | Usage error (no component specified) |

**Examples:**
```bash
./scripts/numio-dev.sh run backend            # Start backend (auto-starts postgres + valkey)
./scripts/numio-dev.sh run frontend           # Start frontend
./scripts/numio-dev.sh run worker             # Start worker (auto-starts postgres)
./scripts/numio-dev.sh run infra              # Start postgres + valkey
./scripts/numio-dev.sh run backend frontend   # Start both (background mode)
./scripts/numio-dev.sh run all                # Start everything
```

**Expected Output (single component):**
```
[INFO] Starting infrastructure: postgres valkey
[INFO] Waiting for postgres to be ready...
[INFO] Waiting for valkey to be ready...
[INFO] Starting backend (port 8000, hot reload)...
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Expected Output (run all):**
```
[INFO] Starting infrastructure: postgres valkey
[INFO] Waiting for postgres to be ready...
[INFO] Waiting for valkey to be ready...
[INFO] Starting backend (background, port 8000)...
[INFO] backend started (PID 12345, log: .numio/logs/backend.log)
[INFO] Starting frontend (background, port 5173)...
[INFO] frontend started (PID 12346, log: .numio/logs/frontend.log)
[INFO] Starting worker (background)...
[INFO] worker started (PID 12347, log: .numio/logs/worker.log)
[INFO] All services started. Use 'numio-dev.sh log -f' to view output.
[INFO] Use 'numio-dev.sh stop all' to stop everything.
```

---

#### 4.4.2 stop

**Purpose:** Stop one or more components.

**Syntax:**
```bash
./scripts/numio-dev.sh stop <component...>
```

**Behavior:**
- App components: reads PID file, sends SIGTERM, waits 5 seconds, sends SIGKILL if needed
- Infra components: runs `docker compose stop <service>`

**Examples:**
```bash
./scripts/numio-dev.sh stop backend           # Stop backend
./scripts/numio-dev.sh stop all               # Stop everything
./scripts/numio-dev.sh stop infra             # Stop postgres + valkey
```

---

#### 4.4.3 status

**Purpose:** Show what is running and how (native process vs container).

**Syntax:**
```bash
./scripts/numio-dev.sh status
```

**Expected Output:**
```
COMPONENT    MODE       STATUS     DETAILS
---------    ----       ------     -------
postgres     container  running    numio-postgres
valkey       container  running    numio-valkey
backend      native     running    PID 12345
frontend     native     running    PID 12346
worker       native     stopped    -
```

---

#### 4.4.4 log

**Purpose:** Show recent logs from one or more components. Default is non-follow: prints the last page and exits.

**Syntax:**
```bash
./scripts/numio-dev.sh log [component...] [-f|--follow]
```

**Behavior:**
- **Default (non-follow):** prints the last 200 lines from each selected component, then exits with code 0.
- **`-f` / `--follow`:** seeds with the last 200 lines, then streams new output until Ctrl-C. Accepted before or after the component list.
- Infra components use `docker compose logs [--tail=200 | -f]`.
- App components (backgrounded) use `tail -n 200 [-f] .numio/logs/<component>.log`.
- App components running in a foreground terminal have no log file; the command warns and skips them.
- No component argument: selects all components (`postgres valkey backend frontend worker`).
- **stderr merge:** every child invocation redirects stderr to stdout so the output is safe to pipe through `grep`, `head`, or `less` without `2>&1`. Wrapper diagnostics (`log_info`, `log_warn`, `log_error`) remain on the script's own stderr.

**Examples:**
```bash
./scripts/numio-dev.sh log                       # Last 200 lines from every component, exit
./scripts/numio-dev.sh log backend               # Last 200 lines from backend, exit
./scripts/numio-dev.sh log -f backend            # Follow backend (Ctrl-C to stop)
./scripts/numio-dev.sh log --follow infra        # Follow postgres + valkey
./scripts/numio-dev.sh log worker | grep ERROR   # Filter safely — no stderr leak
./scripts/numio-dev.sh log worker | head -n 20   # Bounded output — exits cleanly
```

---

#### 4.4.5 restart

**Purpose:** Soft restart — restart process, keep data and state.

**Syntax:**
```bash
./scripts/numio-dev.sh restart <component...>
```

**Behavior:**
- App components: stop + re-launch in background
- Infra components: `docker compose restart <service>`
- If component is not running, starts it

---

#### 4.4.6 rebuild

**Purpose:** Hard restart — rebuild containers, force-recreate, re-run migrations.

**Syntax:**
```bash
./scripts/numio-dev.sh rebuild <component...>
```

**Behavior:**
1. For infra: `docker compose up -d --build --force-recreate <service>`
2. For app: stop the process
3. If postgres is running, re-run migrations
4. Re-start app components in background

**Examples:**
```bash
./scripts/numio-dev.sh rebuild infra          # Rebuild postgres + valkey, re-migrate
./scripts/numio-dev.sh rebuild all            # Full hard restart
```

---

#### 4.4.7 migrate

**Purpose:** Run database migrations.

**Syntax:**
```bash
./scripts/numio-dev.sh migrate
```

**Behavior:**
1. Auto-starts postgres if not running
2. Runs `uv run alembic upgrade head` from `backend/`

**Expected Output:**
```
[INFO] Running database migrations...
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
[INFO] Migrations complete
```

---

#### 4.4.8 health

**Purpose:** Check backend health.

**Syntax:**
```bash
./scripts/numio-dev.sh health
```

**Behavior:** Sends `GET http://localhost:8000/health` with a 5-second timeout.

**Expected Output (success):**
```
[INFO] Checking health at http://localhost:8000/health...
{"service":"numio","status":"ok","version":"0.1.0","environment":"local","database":"connected"}
[INFO] Health check passed
```

---

#### 4.4.9 init

**Purpose:** First-time setup. Installs dependencies for both frontend and backend.

**Syntax:**
```bash
./scripts/numio-dev.sh init
```

**Behavior:**
1. Validate prerequisites (node, npm, uv, docker)
2. Run `npm install` in `frontend/`
3. Run `uv sync` in `backend/`

---

#### 4.4.10 build

**Purpose:** Build Docker images locally. Images are environment-agnostic.

**Syntax:**
```bash
./scripts/numio-dev.sh build [--tag=<TAG>] [--service=<SVC>]
./scripts/numio-dev.sh build help
```

**Parameters:**

| Parameter | Required | Default | Values | Description |
|-----------|----------|---------|--------|-------------|
| `--tag` | No | `latest` | semver or `latest` | Image tag |
| `--service` | No | (all) | `backend`, `frontend` | Build single service |

**Image Naming:**
- Service `backend` -> Image `numio-srv:<tag>`
- Service `frontend` -> Image `numio-ui:<tag>`

**Examples:**
```bash
./scripts/numio-dev.sh build                              # All, tag: latest
./scripts/numio-dev.sh build --tag=v1.2.3                 # All, versioned
./scripts/numio-dev.sh build --service=backend --tag=v1.2.3  # Backend only
```

---

#### 4.4.11 Backward Compatibility

The `dev` subcommand is retained as a hidden alias for `run`:
```bash
./scripts/numio-dev.sh dev backend    # equivalent to: run backend
```

This is not documented in `--help` and may be removed in a future version.

---

## 5. numio-ctl.sh - Runtime Management

### 5.1 Purpose

Manages Numio containers via Docker Compose. Used for production-like and containerized deployments. All services run as containers.

**Scope note:** `numio-ctl.sh` is reserved for production container management. Development workflow uses `numio-dev.sh`.

### 5.2 Usage

```bash
./scripts/numio-ctl.sh <command> [SERVICE]
```

### 5.3 Commands

#### 5.3.1 start

**Purpose:** Start containers.

**Syntax:**
```bash
./scripts/numio-ctl.sh start [SERVICE]
```

**Parameters:**

| Parameter | Required | Default | Values | Description |
|-----------|----------|---------|--------|-------------|
| SERVICE | No | (all) | `backend`, `frontend`, `worker`, `postgres`, `valkey` | Start specific service |

**Behavior:**
- With SERVICE: `docker compose up -d <SERVICE>`
- Without SERVICE: `docker compose up -d`

---

#### 5.3.2 stop

**Purpose:** Stop containers.

**Syntax:**
```bash
./scripts/numio-ctl.sh stop [SERVICE]
```

**Behavior:**
- With SERVICE: `docker compose stop <SERVICE>`
- Without SERVICE: `docker compose down`

---

#### 5.3.3 restart

**Purpose:** Restart containers.

**Syntax:**
```bash
./scripts/numio-ctl.sh restart [SERVICE]
```

**Behavior:**
- With SERVICE: `docker compose up -d --force-recreate <SERVICE>`
- Without SERVICE: `docker compose down` then `docker compose up -d`

---

#### 5.3.4 status

**Purpose:** Show container status.

**Syntax:**
```bash
./scripts/numio-ctl.sh status
```

**Behavior:** Runs `docker compose ps`.

---

#### 5.3.5 logs

**Purpose:** Stream container logs.

**Syntax:**
```bash
./scripts/numio-ctl.sh logs [SERVICE]
```

**Behavior:** Runs `docker compose logs -f [SERVICE]`.

---

#### 5.3.6 health

**Purpose:** Check backend health.

**Syntax:**
```bash
./scripts/numio-ctl.sh health
```

**Behavior:** Sends `GET http://localhost:8000/health`.

---

## 6. Shared Utilities

### 6.1 tools/common.sh

Provides core utilities used by all scripts.

#### Logging Functions

| Function | Output Format | Destination | Visibility |
|----------|---------------|-------------|------------|
| `log_info` | `[INFO] message` | stdout | Always |
| `log_warn` | `[WARN] message` | stderr | Always |
| `log_error` | `[ERROR] message` | stderr | Always |
| `log_debug` | `[DEBUG] message` | stderr | Only when `NUMIO_DEBUG=1` |

#### Color Support

- Colors are enabled when stdout is a terminal
- Colors are disabled for piped/redirected output
- Uses ANSI escape codes: green (INFO), yellow (WARN), red (ERROR), blue (DEBUG)

#### Utility Functions

| Function | Purpose |
|----------|---------|
| `die "msg"` | Log error and exit 1 |
| `require_cmd <cmd>` | Verify command exists |
| `check_docker` | Verify Docker is running |
| `check_docker_compose` | Verify Docker Compose V2 |

### 6.2 tools/dev.sh

Development lifecycle helpers. Provides all run/stop/status/log/restart/rebuild/migrate/health functions. Manages the component model, dependency resolution, PID files, and log files.

### 6.3 tools/build.sh

Docker image build implementation. Provides `build_main`, `build_usage`.

### 6.4 tools/docker.sh

Docker build helpers: image naming (`get_local_image_name`), tagging (`docker_tag_images`), and flag parsing (`parse_tag_flag`, `parse_service_flag`).

### 6.5 tools/worktree.sh

Worktree-scoped Compose project naming, port allocation, and environment loading.

---

## 7. Environment Configuration

### 7.1 Environment Variables

| Variable | Default | Used By | Description |
|----------|---------|---------|-------------|
| `NUMIO_DEBUG` | `0` | All scripts | Enable debug logging (0/1) |

### 7.2 Laptop Container Configuration

The repository retains one container configuration for local and laptop operation:

```
deployment/
└── localhost/
    ├── .env.example
    └── docker-compose.yml
```

---

## 8. Error Handling

### 8.1 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (missing prerequisite, validation failure, operation failed) |
| 2 | Usage error (unknown command, missing required argument) |

### 8.2 Strict Mode

All scripts run with:
```bash
set -euo pipefail
```

- `-e`: Exit immediately on command failure
- `-u`: Treat unset variables as errors
- `-o pipefail`: Pipeline fails if any command fails

---

## 9. QA Test Cases

### 9.1 numio-dev.sh Test Cases

#### TC-DEV-001: Run backend (auto-starts infra)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `docker compose down -v` | Clean state |
| 2 | `./scripts/numio-dev.sh run backend` | Postgres + valkey auto-start, backend runs in foreground |
| 3 | Curl http://localhost:8000/health | Returns health JSON |
| 4 | Press Ctrl+C | Backend stops, infra keeps running |

#### TC-DEV-002: Run frontend
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh run frontend` | Vite dev server starts (no infra auto-start) |
| 2 | Open http://localhost:5173 | Page loads |
| 3 | Press Ctrl+C | Server stops |

#### TC-DEV-003: Run all
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh run all` | Infra starts as containers, app starts in background |
| 2 | `./scripts/numio-dev.sh status` | All 5 services shown as running |
| 3 | Ctrl+C | All app processes stop |

#### TC-DEV-004: Stop specific component
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start backend in background (`run all`) | Running |
| 2 | `./scripts/numio-dev.sh stop backend` | Backend stops, others remain |
| 3 | `./scripts/numio-dev.sh status` | Backend = stopped, others = running |

#### TC-DEV-005: Status
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start some services | Running |
| 2 | `./scripts/numio-dev.sh status` | Table shows mode (container/native), status, details |

#### TC-DEV-006: Log
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `run all` | Services running in background |
| 2 | `./scripts/numio-dev.sh log backend` | Prints last 200 lines, exits with code 0 |
| 3 | `./scripts/numio-dev.sh log -f postgres` | Postgres container logs stream until Ctrl-C |
| 4 | `./scripts/numio-dev.sh log worker \| grep __NOPE__` | No terminal output (stderr is merged) |
| 5 | `./scripts/numio-dev.sh log worker \| head -n 20` | Exits after 20 lines, no leaked stderr |

#### TC-DEV-007: Restart (soft)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start backend | Running |
| 2 | `./scripts/numio-dev.sh restart backend` | Backend stops and restarts, data preserved |

#### TC-DEV-008: Rebuild (hard)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start infra | Running |
| 2 | `./scripts/numio-dev.sh rebuild infra` | Containers rebuilt, force-recreated, migrations re-run |

#### TC-DEV-009: Migrate
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start postgres | Running |
| 2 | `./scripts/numio-dev.sh migrate` | Alembic runs, migrations applied |

#### TC-DEV-010: Health
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start backend | Running |
| 2 | `./scripts/numio-dev.sh health` | "Health check passed" |
| 3 | Stop backend | Stopped |
| 4 | `./scripts/numio-dev.sh health` | Exit code 1, "Health check failed" |

#### TC-DEV-011: Init
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh init` | Dependencies installed |
| 2 | Check `frontend/node_modules` | Directory exists |
| 3 | Check `backend/.venv` | Virtual env created |

#### TC-DEV-012: Build Docker images
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh build` | Docker build succeeds |
| 2 | `docker images | grep numio` | numio-srv:latest, numio-ui:latest listed |

#### TC-DEV-013: Build with version tag
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh build --tag=v1.0.0` | Docker build succeeds |
| 2 | `docker images | grep numio` | numio-srv:v1.0.0, numio-ui:v1.0.0 listed |

#### TC-DEV-014: Invalid component
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh run invalid` | Exit code 1, "Invalid component" error |

#### TC-DEV-015: Backward compatibility (dev alias)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh dev backend` | Same as `run backend` |

#### TC-DEV-016: Help
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh help` | Usage information with all commands |
| 2 | `./scripts/numio-dev.sh --help` | Same |
| 3 | `./scripts/numio-dev.sh` (no args) | Same |

---

### 9.2 numio-ctl.sh Test Cases

#### TC-CTL-001: Docker compose start/stop
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-ctl.sh start` | Containers start |
| 2 | `./scripts/numio-ctl.sh status` | Containers listed as running |
| 3 | `./scripts/numio-ctl.sh stop` | Containers stop |

#### TC-CTL-002: Health check
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start backend | Running on :8000 |
| 2 | `./scripts/numio-ctl.sh health` | "Health check passed" |
| 3 | Stop backend | Stopped |
| 4 | `./scripts/numio-ctl.sh health` | Exit code 1, "Health check failed" |

#### TC-CTL-003: Logs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-ctl.sh start` | Running |
| 2 | `./scripts/numio-ctl.sh logs backend` | Logs stream |
| 3 | Ctrl+C | Logs stop |

#### TC-CTL-004: Unknown command
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-ctl.sh unknown` | Exit code 2, error message, usage displayed |

---

### 9.3 Integration Test Cases

#### TC-INT-001: Full development workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh init` | Setup completes |
| 2 | `./scripts/numio-dev.sh run backend` (terminal 1) | Infra auto-starts, backend runs |
| 3 | `./scripts/numio-dev.sh run frontend` (terminal 2) | Frontend runs |
| 4 | Open http://localhost:5173 | UI loads |
| 5 | Curl http://localhost:8000/health | Health OK |
| 6 | `./scripts/numio-dev.sh status` (terminal 3) | All services shown |
| 7 | Ctrl+C in terminals 1 and 2 | App services stop |
| 8 | `./scripts/numio-dev.sh stop infra` | Infra stops |

#### TC-INT-002: Full Docker deployment workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `./scripts/numio-dev.sh build` | Images built |
| 2 | `./scripts/numio-ctl.sh start` | Containers start |
| 3 | `./scripts/numio-ctl.sh health` | Health OK |
| 4 | `./scripts/numio-ctl.sh logs backend` | Logs stream |
| 5 | `./scripts/numio-ctl.sh stop` | Containers stop |

---

## 10. Known Limitations

### 10.1 Platform Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| macOS Bash 3.2 | No associative arrays, special empty array handling | Scripts use compatible syntax |
| `sleep 0.5` in stop | Not POSIX, but works on macOS and Linux | Acceptable for dev tooling |

### 10.2 Log Files for Foreground Processes

When a single app component runs in foreground mode (`run backend`), output goes directly to the terminal. The `log` command cannot access it from another terminal. Log files are only created in background mode (`run all` or `run backend frontend`).

### 10.3 Assumptions

- Developer has appropriate permissions for Docker
- PostgreSQL and Valkey ports (5432, 6379) are not in use by other processes
- Backend port 8000 and frontend port 5173 are available

---

## Appendix A: Quick Reference

### Common Workflows

**Start backend with hot reload (most common):**
```bash
./scripts/numio-dev.sh run backend     # Terminal 1: auto-starts postgres + valkey
./scripts/numio-dev.sh run frontend    # Terminal 2
```

**Start everything at once:**
```bash
./scripts/numio-dev.sh run all
# Ctrl+C to stop all app components
./scripts/numio-dev.sh stop infra     # Stop infra when done
```

**Apply migrations:**
```bash
./scripts/numio-dev.sh migrate
```

**Check what's running:**
```bash
./scripts/numio-dev.sh status
```

**Full Docker deployment (via numio-ctl.sh):**
```bash
./scripts/numio-dev.sh build
./scripts/numio-ctl.sh start
./scripts/numio-ctl.sh health
# ... work ...
./scripts/numio-ctl.sh stop
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | - | Initial specification |
| 2.0 | 2026-01-26 | - | ECR-based deployment, --tag/--service flags, push command |
| 2.1 | 2026-01-28 | - | Multi-region ECR push, environment-agnostic images |
| 2.2 | 2026-01-28 | - | Build refactoring: add --push flag, build help subcommand |
| 3.0 | 2026-04-12 | - | Redesign numio-dev.sh: replace `dev` with full lifecycle commands (run/stop/restart/rebuild/status/logs/migrate/health). Add component model, dependency auto-start, PID management. Remove outdated push/deploy/secrets commands. Align numio-ctl.sh section with current implementation. |
