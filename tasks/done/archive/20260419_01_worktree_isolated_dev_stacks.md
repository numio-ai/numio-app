---
status: done
kind: task
feature: Developer environment
---

# Isolate dev infrastructure per git worktree

**Date:** 2026-04-19

## Problem statement

Numio's dev stack (`docker-compose.yml` + `numio-dev.sh`) hardcodes a single Compose project: fixed container names (`numio-postgres`, `numio-valkey`, `numio-srv`, `numio-worker`, `numio-ui`), a single `pgdata` volume, and fixed host ports (5432, 6379, 8000, 5173/3000). When a developer opens multiple git worktrees of the repo in parallel — common for split-branch work — every worktree competes for the same containers, volume, and host ports.

Concrete consequences:

- Worktree A applies an Alembic migration; worktree B (on an older branch) instantly breaks because its ORM doesn't know about the new schema.
- Worktree B starts `numio-dev.sh run backend` → port 8000 already bound → hard error, or worse, it silently wires itself to worktree A's Postgres and writes data into the wrong DB.
- `docker compose down -v` in one worktree wipes the other worktree's data.

The root cause is **shared naming and shared host ports**, not shared Postgres as a concept. Docker Compose already namespaces containers/volumes/networks by *project name*; the codebase opts out of that scoping via explicit `container_name:` fields and literal port numbers.

## Objective

Each worktree runs its own independent dev stack — own Postgres, own Valkey, own volumes, own ports — with zero cross-worktree interference. Single-worktree workflow remains unchanged (same default ports, same commands).

## Requirements

**R1. One worktree = one Compose project.**
- `numio-dev.sh` derives a stable `COMPOSE_PROJECT_NAME` per worktree (from the worktree path).
- All `docker compose …` invocations inherit the project name.
- Outcome: Postgres volume becomes `<project>_pgdata`; containers become `<project>-postgres-1`, etc. Zero volume/network collision across worktrees.

**R2. Per-worktree host port allocation.**
- First worktree to run keeps classic defaults (postgres 5432, valkey 6379, backend 8000, frontend dev 5173, frontend container 3000) when those ports are free.
- Subsequent worktrees dynamically pick free ephemeral ports for whichever defaults are already taken.
- Allocations persist per worktree in `.numio/worktree.env` (gitignored — `.numio/` already is). Same worktree → same ports across invocations.

**R3. Backend/frontend consume the worktree env.**
- Native backend's `DATABASE_URL` / `VALKEY_URL` are assembled from `POSTGRES_HOST_PORT` / `VALKEY_HOST_PORT` in the worktree env, overriding any stale `.env` defaults.
- Native backend's listen port = `BACKEND_HOST_PORT` from the worktree env.
- Vite dev server listens on `FRONTEND_DEV_PORT` and proxies `/api` to `http://localhost:$BACKEND_HOST_PORT`.

**R4. `docker-compose.yml` is parameterized.**
- Remove all `container_name:` fields so Compose can auto-prefix with the project name.
- Host port bindings use `${VAR:-default}` with the defaults above, so bare `docker compose up -d` (no wrapper) still works.
- Build-arg `VITE_API_URL` uses `${BACKEND_HOST_PORT:-8000}`.

**R5. Visibility.**
- `./scripts/numio-dev.sh status` prints project name and port map at the top so a developer switching terminals knows which worktree's stack they're looking at.
- `./scripts/numio-dev.sh ports` prints the port map in a format suitable for eye-balling and copy-pasting into `psql` / `redis-cli` commands.

**R6. Compatibility.**
- Operator mode (`numio-ctl.sh`, `ops-runbook.md`) is untouched — one host, one install, classic names.
- Existing `docker exec numio-postgres …` one-liners in `dev-runbook.md` must be updated to use `docker compose exec postgres …` (container name is no longer predictable).

## Acceptance criteria

1. Run `numio-dev.sh run all` in worktree A; run it again in worktree B. Both stacks boot. `docker compose ps` inside each worktree shows only that worktree's containers.
2. `psql` into A and B — inserting a row into A's `workspaces` table does not appear in B's.
3. Running `alembic upgrade head` in A does not affect B's schema.
4. `numio-dev.sh status` shows the worktree's project name and the four bound host ports.
5. `numio-dev.sh stop all` in A stops only A's stack.
6. With a freshly cloned repo (single worktree), all ports are the classic 5432/6379/8000/5173 — no behavioral change.
7. `numio-ctl.sh` operator mode still works with no regression.

## Quality gates

- `scripts/numio-dev.sh status` and `scripts/numio-dev.sh ports` show the derived project name + port map.
- Manual validation per acceptance criteria 1–6.
- `numio-ctl.sh help` still runs (smoke check that operator wrapper isn't broken).

## Scope (explicit)

**In scope:** `docker-compose.yml`, `scripts/numio-dev.sh`, `scripts/tools/dev.sh`, new `scripts/tools/worktree.sh`, `frontend/vite.config.js` (read proxy target from env).

**Out of scope:** operator mode, production configs, auto-detection on `cd`, `numio-dev.sh nuke` data-wipe command, doc rewrites beyond touching stale `docker exec numio-postgres …` examples.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Existing `docker exec numio-postgres …` habit breaks | Update dev-runbook examples in the same PR; keep classic names for the first worktree so the default flow still works. |
| Worktree env file diverges from `docker-compose.yml` defaults | Single source of truth: `worktree.sh` sets defaults; `docker-compose.yml` uses `${VAR:-default}` with identical fallback values. |
| Two worktrees race on port allocation | Port pick + persist is atomic per worktree; collision only possible if two worktrees launch within milliseconds of each other — rerun resolves it. |
