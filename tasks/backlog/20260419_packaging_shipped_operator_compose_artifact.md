---
status: backlog
kind: task
feature: packaging
title: Ship an user compose artifact (compose file + `.env.example`)
---

# Ship an user compose artifact (compose file + `.env.example`)

## Date
2026-04-16

## Context

The rewritten operator runbook (`tasks/active/20260416_01_rewrite_ops_runbook.md`) targets operators who install Numio on a laptop using only Docker. They do not have the source tree, `uv`, Node, or any build tooling.

The current `docker-compose.yml` at the repo root is a developer file: the `backend` and `frontend` services include `build:` stanzas and reference the source tree for bind-mounted volumes. It cannot be handed to an operator as-is.

Distribution channel for the operator artifact: alongside images on GHCR (see `tasks/backlog/20260416_10_publish_images_to_ghcr.md`) or as a GitHub release asset.

## Problem

Operators need a single, versioned compose file that:
- References GHCR images by tag (no `build:` sections).
- Has no host-side bind mounts into source paths.
- Ships with a `.env.example` covering all required and optional operator env vars.

## Goals

1. Add `deployment/operator/docker-compose.yml` — operator-facing, no build sections, pins GHCR image tags.
2. Add `deployment/operator/.env.example` — one variable per line, with comments, grouped by: auth, database, cache, logging, CORS, MCP, LLM, rate limiting.
3. Image tag is parameterized via env var (e.g. `NUMIO_VERSION`) so an operator can pin or upgrade by changing a single value.
4. Compose file exposes the ports the runbook documents: frontend `3000`, backend `8000`. No dev ports (5173) exposed.
5. Artifact is published on each release (attached to the GitHub release, or committed at a stable URL) so operators can fetch it with `curl`.

## Scope

- New `deployment/operator/` directory with `docker-compose.yml` and `.env.example`.
- Optional: a tiny `README.md` in that directory pointing to `docs/ops-runbook.md`.

## Out of scope

- Changes to the developer `docker-compose.yml` at repo root.
- Changes to `deployment/n0/` (retired separately in `tasks/backlog/20260416_13_retire_deployment_n0.md`).
- CI to publish the artifact — capture as part of the GHCR publish workflow.

## Acceptance criteria

1. From a clean directory with only Docker installed, `curl -O <artifact-url>/docker-compose.yml`, `curl -O <artifact-url>/.env.example`, `cp .env.example .env`, `docker compose up -d` brings up all five services healthy.
2. The compose file contains no `build:` keys.
3. The compose file contains no bind mounts into source-relative paths (`./backend`, `./frontend`).
4. `grep -E '^\s*build:' deployment/operator/docker-compose.yml` returns no hits.
5. `.env.example` documents every variable listed in the Configuration section of `docs/ops-runbook.md`, with sensible defaults for local-laptop use.

## Validation steps

1. On a clean VM with only Docker: follow the install section of `docs/ops-runbook.md` using the published artifact. `/health` returns `"status": "ok"` and `"database": "connected"`.
2. Change `NUMIO_VERSION` to a pinned older tag, restart, and confirm the older images are pulled and run.

## Risks

- **Risk:** drift between the developer compose file and the operator compose file. Mitigation: add a CI check that flags service name / port / env var differences that materially affect operators.
- **Risk:** an operator env var needed for a feature is missing from `.env.example`. Mitigation: audit the backend config loader against `.env.example` as part of acceptance.
