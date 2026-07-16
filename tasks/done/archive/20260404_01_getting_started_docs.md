---
status: done
kind: task
---

# Update README and User Guide with Getting Started Instructions

**Date:** Apr 4, 2026

## Context

Numio has detailed developer and ops runbooks (`docs/dev-runbook.md`, `docs/ops-runbook.md`). Neither `README.md` nor `docs/user-guide.md` contains instructions for a first-time user to run Numio locally. `README.md` has an empty "Quick Start" section. `docs/user-guide.md` is blank.

The current setup path requires Node.js 20+, Python 3.12+, and `uv` on the host — four prerequisites before the user types a single command. Docker Compose runs all services in containers, but database migrations still require `uv` on the host (`cd backend && uv run alembic upgrade head`).

## Problem

A new user who clones the repo has no clear path to a running Numio instance. The developer runbook targets contributors, not evaluators. The migration step breaks the Docker-only workflow. Result: high friction for first-time users evaluating Numio.

## Goals

1. **README.md** — Add a concise "Quick Start" section (clone, one command, open browser). Link to `docs/user-guide.md` for details.
2. **docs/user-guide.md** — Write a "Getting Started" section with the same content, expanded where needed. This file will grow in future tasks.
3. **Docker-only prerequisite** — The quick start requires only Docker Desktop (with Compose V2). No Node.js, Python, or `uv` on the host.
4. **Docker-runnable migrations** — Migrations must run inside the backend container (e.g., `docker compose exec backend alembic upgrade head`). No host-side Python needed.
5. **Writing style** — Follow `.claude/rules/writing-guideline.md` strictly: active voice, sentences under 30 words, no weasel/peacock words, absolute dates, acronyms defined on first use.

## Non-goals

- Full user guide (usage, navigation, dashboards) — future task.
- Native dev server instructions — already in `docs/dev-runbook.md`.
- AWS account setup walkthrough — mentioned as optional next step only.
- Changes to `docs/dev-runbook.md` or `docs/ops-runbook.md`.

## Constraints & Assumptions

- Docker Compose file (`docker-compose.yml`) defines all services: postgres, valkey, backend, worker, frontend.
- The backend container image already contains `alembic` and migration files. Running `alembic upgrade head` inside the container should work without changes to `Dockerfile` or `docker-compose.yml`. If it does not, fix the container setup as part of this task.
- The app requires a default workspace row. The seed step (`INSERT INTO workspaces ...`) must be included or automated.
- Without an AWS account configured, dashboards show empty states. The quick start should set this expectation.

## Acceptance Criteria

1. **AC1**: `README.md` contains a "Quick Start" section with 5 or fewer steps. The only host prerequisite listed is Docker.
2. **AC2**: `docs/user-guide.md` contains a "Getting Started" section. Content matches README quick start, with optional expansion (e.g., verifying health, connecting an AWS account).
3. **AC3**: A user with only Docker installed can follow the quick start and reach the Numio UI at `http://localhost:3000` with a healthy backend (`/health` returns `"status": "ok"`).
4. **AC4**: No step in the quick start requires Node.js, Python, or `uv` on the host.
5. **AC5**: Database migrations run inside a Docker container (not on the host).
6. **AC6**: The default workspace seed is either automated or documented as a single copy-paste command.
7. **AC7**: README links to `docs/user-guide.md` for the full guide.
8. **AC8**: All text follows the writing guideline: active voice, sentences under 30 words, no weasel/peacock words, no relative dates, acronyms defined on first use.

## Validation Steps

1. Clone the repo into a fresh directory.
2. Follow README quick start with only Docker installed.
3. Confirm `http://localhost:8000/health` returns `{"status": "ok", "database": "connected"}`.
4. Confirm `http://localhost:3000` loads the Numio UI.
5. Review all written text against `.claude/rules/writing-guideline.md` checklist.

## Risks & Rollback

| Risk | Mitigation |
|------|------------|
| Backend container lacks `alembic` CLI or migration files | Verify during implementation; update `Dockerfile` if needed |
| Migration inside container connects to wrong DB host | Use the `DATABASE_URL` already set in `docker-compose.yml` (points to `postgres` service) |
| Seed command fails on re-run | Use `ON CONFLICT DO NOTHING` (already in existing seed command) |

Rollback: Revert commits to `README.md`, `docs/user-guide.md`, and any `Dockerfile`/`docker-compose.yml` changes.
