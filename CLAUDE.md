# CLAUDE.md

Numio is a cloud cost management co-pilot and agent. The codebase is a monorepo with `backend/`, `frontend/`, and `deployment/` directories.

## Foundatinal principles to alway follow

@.claude/rules/first-principles.md

### Key Architecture Decisions

- **Database**: PostgreSQL with SQLAlchemy + Alembic migrations
- **Authentication**: AWS Cognito (customer-owned user pool), with option to disable auth entirely
- **Cost data**: Cost and Usage Report (CUR) is primary source, Cost Explorer is fallback. Common data model for both.
- **Workspace scoping**: Every table carries `workspace_id` — multi-tenancy stays open without schema change.
- **MVP scope**: AWS only. Detect and recommend only — no autonomous execution.
- **LLM integration**: LMGate API (preferred) with Anthropic API fallback, configurable

## Repository Structure

- `frontend/` - React prototype (dummy UI from demo, will be replaced with production UI)
- `backend/` - Python/FastAPI backend (being redesigned per Phase 1 tasks)
- `scripts/` - Build and control plane scripts
- `docs/` - Project documentation
- `tasks/` - Task tracking (backlog / active / done)

External dependencies:
- Repository `../infra/` contains platform infrastructure code and documentation.

## Working on Tasks

Work is organized as **features** (named product initiatives with a plan) and **tasks** (units of implementation, optionally attached to a feature). Bugs are tasks with `kind: bug`. Tasks without a `feature:` field are ad-hoc. See [`.claude/rules/task-management.md`](.claude/rules/task-management.md) for the full model.

**All create / move / close operations go through [`scripts/taskman.sh`](scripts/taskman.sh).** Skills (`/agn:create-feature`, `/agn:create-task`, `/agn:implement`) author content in dialog and use taskman as the save step. Don't write task files directly.

---

## CRITICAL — never use absolute paths for files inside this project

Every tool call (`Bash`, `Edit`, `Write`, `MultiEdit`, `Read`, etc.) must reference project files by **paths relative to the session's current working directory**. Never use an absolute path that hard-codes the project location (e.g. `/Users/.../numio-app/backend/...`), and never `cd` to such a path.

The session's working directory is already set correctly by the harness — it may be the main repo or a worktree under `.claude/worktrees/<name>/`. Absolute paths silently bypass the active worktree and write to the wrong checkout. This has happened: an entire task feature's worth of work landed on the wrong branch because absolute paths were used. Don't repeat it.

- **Yes:** `backend/src/numio/api/onboarding.py`, `./scripts/taskman.sh ...`, `tasks/backlog/foo.md`
- **No:** `/Users/vladimirkroz/repos/numio-root/numio-app/backend/...`, `cd /Users/.../numio-app && ...`

The only exception is paths to genuinely external resources (e.g. `/tmp/...`, sibling repos like `../infra/`) — and even those should be flagged to the user before use.

---


## Documentation

### Where specs live — structure standard

Feature and subsystem specs live under `docs/<area>/[<subarea>/]<name>-spec.md`. Group by product area using subdirectories. Example: `docs/settings/integration/aws-onboarding-spec.md`.

Top-level `docs/` is reserved for cross-cutting product documents — vision, functional specification, architecture, runbooks, API guide. Do not place feature-scoped specs at the top level.

Naming: the file name ends in `-spec.md` for specs, `-design.md` for design documents. Use lowercase with hyphens.

### Required Documentation

@docs/dev-runbook.md — Developer runbook. How to develop Numio.
@docs/ops-runbook.md — Operator runbook. Laptop-only install via GHCR + `numio-ctl.sh`. End-to-end install blocked on backlog tasks `20260416_10..13`; use the Developer Runbook until those land.

### Full list of documentation

- `docs/Numio.ai%20-%20core%20spec%20(source%20of%20truth).md`  - Product vision and core spec (source of truth)
- `docs/Numio%20functional%20specification.md` - Functional specification
- `docs/implementation-plan.md` - Phased plan, task inventory, prerequisites, parallelization
- `docs/architecture-design.md` - System architecture (stale — rewrite pending).
- `docs/dev-runbook.md` — Developer runbook.
- `docs/ops-runbook.md` — Operator runbook. Laptop-only install via GHCR images + shipped compose artifact. End-to-end install blocked on supporting artifacts (`tasks/backlog/20260416_10..13`).
- `docs/arb/*` - Architectural Review Board documents
- `docs/data-explorer/data-explorer-spec.md` — Data Explorer feature spec (admin-only in-app SQL runner)
- `docs/frontend/mock-backend-spec.md` — Frontend mock/real backend switch (`VITE_API_MODE`): dispatch seam, mock handler contract, synthetic data model
