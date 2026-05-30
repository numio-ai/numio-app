---
status: backlog
kind: task
feature: tools
title: Evolve `numio-ctl.sh` into a standalone operator CLI
---

# Evolve `numio-ctl.sh` into a standalone operator CLI

## Date
2026-04-16

## Context

The rewritten operator runbook (`tasks/active/20260416_01_rewrite_ops_runbook.md`) documents a single operator command surface: `numio-ctl.sh`. Today that script is a thin `docker compose` wrapper that runs only from the repo source tree (`cd "${PROJECT_DIR}"` before every call). Operators do not have the source tree, so the script cannot be used as written.

This task evolves `numio-ctl.sh` into a standalone CLI that works from a released install directory, with convenience commands that hide raw `docker compose exec` calls.

## Problem

1. Script hard-codes `PROJECT_DIR` as the repo checkout and sources `scripts/tools/common.sh` from there. It cannot run without the repo.
2. Database init / migrate / seed require raw `docker compose exec backend alembic upgrade head` and `docker compose exec postgres psql ...`. The runbook's acceptance criteria forbid exposing these to operators.
3. No upgrade or rollback commands. Operators currently have no way to change image tag → migrate → restart → verify in one step.

## Goals

1. `numio-ctl.sh` runs from an install directory chosen by the operator, e.g. `$NUMIO_HOME` (default `/opt/numio` or `$HOME/.numio`). It reads the shipped `docker-compose.yml` and `.env` from that directory.
2. Add these subcommands (hiding all raw `exec` / `compose` plumbing):
   - `install` — first-run: fetch the compose artifact, pull images, start services, run migrations, seed default workspace, verify health.
   - `init-db` — apply migrations and seed default workspace (idempotent; safe to re-run).
   - `upgrade <version>` — pin `NUMIO_VERSION`, `docker compose pull`, run migrations, restart, verify health.
   - `rollback <version>` — pin to the previous tag, restart, verify health.
   - `uninstall` — stop containers, offer to remove `pgdata` volume.
3. Keep existing subcommands: `start`, `stop`, `restart`, `status`, `logs`, `health`.
4. Ship the script as part of the operator artifact (alongside `docker-compose.yml` and `.env.example`), so `curl -O …/numio-ctl.sh && chmod +x numio-ctl.sh && ./numio-ctl.sh install` is a valid first-run.
5. Remove every dependency on `scripts/tools/common.sh` from the source tree, or inline the helpers the operator CLI needs.

## Scope

- Refactor `scripts/numio-ctl.sh`.
- Inline minimal helpers (logging, `docker` / `docker compose` version checks, `require_cmd`) so the file is self-contained.
- Add `install`, `init-db`, `upgrade`, `rollback`, `uninstall`.
- Add the artifact-fetch logic used by `install` (download compose file + `.env.example` from the release).

## Out of scope

- A compiled binary (`numio` in Go / Rust). Stay with bash for now.
- Changes to `numio-dev.sh` (developer lifecycle CLI stays as it is).
- GHCR publishing (covered by `tasks/backlog/20260416_10_publish_images_to_ghcr.md`).
- Compose artifact content (covered by `tasks/backlog/20260416_11_shipped_operator_compose_artifact.md`).

## Acceptance criteria

1. On a clean host with only Docker and `curl`: `curl -O <url>/numio-ctl.sh && chmod +x numio-ctl.sh && ./numio-ctl.sh install` brings up all five services healthy, applies migrations, and seeds the default workspace.
2. `./numio-ctl.sh upgrade 0.2.0` pulls the pinned images, runs migrations, restarts the stack, and leaves `/health` returning `"database": "connected"`.
3. `./numio-ctl.sh rollback 0.1.0` returns the stack to the previous version.
4. `./numio-ctl.sh uninstall` stops and removes containers and (with confirmation) the `pgdata` volume.
5. `grep -nE 'docker compose exec' scripts/numio-ctl.sh` returns no hits in operator-facing code paths; if any `exec` remains, it lives inside the CLI and is not surfaced to the operator.
6. The script does not `cd` into a source-tree path and does not `source` files outside the install dir.

## Validation steps

1. Clean-host dry run: fresh VM, only Docker + curl. Run `install`, `upgrade`, `rollback`, `uninstall` in sequence. Each returns 0 and leaves the expected state.
2. Run `./numio-ctl.sh install` a second time on a host that already has Numio installed. Exit code 0 with a clear "already installed" message, or an idempotent re-install — pick one and document it.

## Risks

- **Risk:** GHCR outage at `install` time leaves the operator with partial state. Mitigation: `install` is re-runnable; if `pull` fails it aborts before `docker compose up`.
- **Risk:** migration failure leaves DB schema halfway. Mitigation: `init-db` and `upgrade` must not start the backend if migrations fail; print the failing revision and leave data intact for retry.
