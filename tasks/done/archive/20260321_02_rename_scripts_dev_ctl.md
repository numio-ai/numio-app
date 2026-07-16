---
status: done
---

# Rename Control Plane Scripts: numio-dev.sh + numio-ctl.sh

**Date:** 2026-03-21

## Context

The current script names (`numio-build.sh`, `numio-manager.sh`) don't clearly communicate their purpose. `numio-build.sh` handles more than builds (init, dev servers, push). `numio-manager.sh` is vague. This causes confusion about which script to use for what.

## Problem

Developer and operations tooling are not clearly separated by name. The dev-runbook references `numio-manager.sh backend dev` but that command lives in `numio-build.sh dev backend`.

## Goals

Rename and reorganize the two scripts to clearly separate concerns:

| New Name | Purpose | Commands |
|----------|---------|----------|
| `numio-dev.sh` | Developer workflow | `init`, `dev backend/frontend`, `build`, `push` |
| `numio-ctl.sh` | Runtime control | `deploy`, `start/stop/restart`, `status`, `logs`, `health`, `secrets` |

## Scope

- Rename `numio-build.sh` → `numio-dev.sh`
- Rename `numio-manager.sh` → `numio-ctl.sh`
- Move `deploy` and `secrets` commands from dev script to ctl script
- Update all references in documentation (dev-runbook, ops-runbook, CLAUDE.md, READMEs)
- Update any cross-references between the scripts

## Non-goals

- Adding new commands or features
- Changing command behavior or flags
- Modifying CI/CD pipelines (none exist yet)

## Acceptance Criteria

1. `./scripts/numio-dev.sh` shows help with: init, dev, build, push
2. `./scripts/numio-ctl.sh` shows help with: deploy, start, stop, restart, status, logs, health, secrets
3. `./scripts/numio-dev.sh dev backend` starts backend dev server
4. `./scripts/numio-dev.sh dev frontend` starts frontend dev server
5. All documentation references updated to new names
6. Old script names no longer exist
7. `cd backend && uv run ruff check .` passes

## Risks & Rollback

- **Risk:** Muscle memory — developers may type old names.
  **Mitigation:** Documentation is updated; old names are removed (clean break, no aliases).
- **Rollback:** Revert the commit to restore old names.
