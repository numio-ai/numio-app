---
status: done
kind: task
---

# Rewrite `docs/ops-runbook.md` for Operator Audience

## Date
2026-04-16

## Context

`docs/ops-runbook.md` is intended to be the operator guide for installing and running Numio on a **customer AWS account** or on a **forward-deployed engineer's (FDE) laptop**, using released artifacts (pre-built images and operator tooling). The current document was drafted by expanding the developer setup flow and does not match that scope.

Related documents:
- `docs/dev-runbook.md` — developer runbook (in better shape, will be the working reference while this task is open).
- `CLAUDE.md` — marks `ops-runbook.md` as a draft and redirects readers to this task.

## Problem

The current `ops-runbook.md` conflates operator concerns with developer concerns and cannot be followed by its intended audience:

1. **Builds from source in the install flow.** Step 2 instructs the reader to run `./scripts/numio-dev.sh build` to produce `numio-srv` and `numio-ui` images. Operators installing Numio on a customer account should pull published images (or use an installer), not build from sources.
2. **Raw container commands for required steps.** Database initialization uses `docker compose exec backend alembic upgrade head` and `docker compose exec postgres psql ...`. These are developer-internal plumbing, not an operator interface.
3. **Assumes the source tree is present.** Several commands rely on `./scripts/numio-*.sh`, which live in the repo and currently only wrap `docker compose` against the repo's `docker-compose.yml`. This is not the right surface for a customer install.
4. **Assumes developer tooling.** Parts of the document reference `uv`, native Alembic, and the dev `numio-dev.sh` lifecycle — none of which should be prerequisites for an operator.
5. **Dev/ops modes are mixed without being named.** `numio-ctl.sh status` and `numio-dev.sh status` return different results (containers only vs. containers + native processes) and the runbook does not explain this, which is actively confusing — see user-observed inconsistency where only `postgres` and `valkey` appeared in `numio-ctl.sh status` while five components appeared in `numio-dev.sh status`.
6. **Production deployment section is not operator-facing.** It uses `cd backend && uv run alembic upgrade head` against a production DB URL, which is a developer workflow, not an operator procedure.

**Evidence:**
- `docs/ops-runbook.md` Step 2 (lines ~28–43) calls `./scripts/numio-dev.sh build`.
- `docs/ops-runbook.md` Step 3 (lines ~45–62) uses `docker compose exec ...` for migration and seeding.
- `scripts/numio-ctl.sh` is a thin wrapper over `docker compose` against the checked-out repo.

**Impact:** The runbook is unusable for its intended users (FDEs, customer AWS admins). Any deployment attempted by following it will either fail or will accidentally require a developer workstation.

## Goals

Produce a rewritten `docs/ops-runbook.md` that:

1. **Targets the operator audience only** — forward-deployed engineer, or AWS-admin customer installing Numio on their own AWS account or their laptop.
2. Documents installation using **released artifacts only** (published container images, optional operator CLI / installer). No `build` step in the install path.
3. Provides an **operator-level interface** for:
   - Install / start / stop / restart / status / logs / health
   - First-run database initialization (schema + default workspace seed) as a single operator action
   - Upgrade to a new released version (pull image → migrate → restart → verify)
   - Rollback to the previous released version
   - Reset / uninstall
4. Captures the **production environment variables** required to run against a customer AWS account (database URL, Cognito, CORS, MCP hosts, LLM backend). Keep the current Configuration section as the basis, but drop anything dev-only.
5. Clearly separates what is **on-host** (Docker) vs. **in-AWS** (IAM roles, CUR exports, Cognito). Cross-link to the user guide for the in-AWS parts rather than duplicating.
6. Names the dev/ops distinction explicitly: a short section at the top explaining that this guide covers operator mode (all services as containers, released images), and that the developer mode (native dev servers with hot reload) lives in `docs/dev-runbook.md`.

## Non-goals

- Do **not** design or build the operator CLI / installer as part of this task. If the current `./scripts/numio-ctl.sh` is insufficient, capture a follow-up task; do not expand scope here.
- Do **not** rewrite `docs/dev-runbook.md`.
- Do **not** change `docker-compose.yml` or any code.
- Do **not** cover multi-node / Kubernetes deployment. Scope is single-host Docker (customer account EC2 / laptop).

## Constraints & assumptions

- **Constraint:** operators are not expected to have `uv`, Node, `npm`, or the source tree. Docker is the only assumed prerequisite (as stated today).
- **Constraint:** the document must remain self-contained for first-run install on a fresh host.
- **Assumption:** a published image distribution channel exists (or will exist) by the time this runbook is adopted. If no channel is defined yet, flag that gap in the task output and propose a follow-up task; do not paper over it with `docker compose build`.
- **Assumption:** there is exactly one supported operator CLI / command surface for install + lifecycle. Confirm which one during the rewrite (new `numio` CLI? revised `numio-ctl.sh`? plain `docker compose` with a shipped compose file?). Decide with the product owner before writing the new runbook.
- **Constraint:** every command in the rewrite must be runnable end-to-end by an operator with only: Docker, the released compose file (or installer), and the environment variables listed in Configuration.

## Acceptance criteria

1. **Audience & scope are stated up front.** The first section of the new `ops-runbook.md` names the target audience (FDE / AWS admin) and explicitly excludes developer workflows, with a link to `dev-runbook.md`.
2. **No `build` step in the install path.** The install procedure does not invoke `numio-dev.sh build`, `docker compose build`, or any equivalent. It uses released images (or a shipped installer).
3. **No `docker compose exec` in operator-facing steps.** Database initialization, migrations, and seeding are exposed via a single operator command (or a documented install-time bootstrap), not raw `exec` calls. If the underlying mechanism is still `exec`, it is hidden behind an operator command.
4. **Lifecycle commands use one consistent operator interface.** Install / start / stop / restart / status / logs / health / upgrade / rollback / uninstall are all shown using the same tool. No mixing of `numio-dev.sh` and `numio-ctl.sh` in operator-facing sections.
5. **Production deploy section rewritten.** It does not reference `uv`, native Alembic, or the source tree. The overlay compose file (`deployment/n0/docker-compose.prod.yml`) is either incorporated into the shipped install, or clearly marked as internal and removed from the operator runbook.
6. **Dev-vs-ops disambiguation.** The runbook contains a short "Modes" note explaining that this document covers container-mode only; that `numio-ctl.sh status` and `numio-dev.sh status` answer different questions; and that operators should never see native processes.
7. **Verify step is complete and correct.** The post-install verification table lists all five services (including the worker, with a note that it has no exposed port) and the correct backend paths: `/api/v1`, `/mcp`, `/mcp/sse`, `/health`.
8. **Raw-command appendix preserved.** A short appendix retains the raw `docker compose` equivalents for debugging, matching what already exists in the current draft.
9. **Draft banner removed.** The `⚠️ DRAFT — DO NOT USE` banner at the top of the current document is removed as part of this rewrite.
10. **`CLAUDE.md` updated.** The "Required Documentation" section in `CLAUDE.md` is updated to remove the "DRAFT, NOT READY" marker and the reference to this task once the rewrite lands.

## Validation steps

1. **Clean-host dry run.** On a fresh machine (or a clean VM) with only Docker installed, a reviewer who is not a Numio developer follows the new runbook end-to-end and reaches a working install with:
   - All five containers healthy (`postgres`, `valkey`, backend, worker, frontend).
   - `curl http://<host>:8000/health` returns `"status": "ok"`, `"database": "connected"`.
   - `http://<host>:3000` renders the Numio UI.
   - Default workspace exists in the database.
   No step in the walkthrough required `uv`, Node, `npm`, Python, or the source tree.
2. **Upgrade path.** The reviewer performs an upgrade from version N to version N+1 using only the runbook, and `/health` continues to report `"database": "connected"` afterwards.
3. **Rollback path.** The reviewer rolls back from N+1 to N using only the runbook, and the stack returns to a healthy state.
4. **Lint for forbidden commands.** `grep -nE 'numio-dev\.sh build|docker compose build|cd backend|uv run' docs/ops-runbook.md` returns no hits outside the raw-command appendix.
5. **Cross-reference check.** `CLAUDE.md` no longer flags `ops-runbook.md` as a draft; `dev-runbook.md` has a link to the new ops runbook where appropriate.

## Risks & rollback

- **Risk:** the operator install surface (published images, installer CLI) may not actually exist today. If the rewrite depends on artifacts that are not yet published, the rewrite will stall. Mitigation: open a dependency task to define and ship the operator install surface, and do not merge the runbook rewrite until that dependency is resolved.
- **Risk:** conflating this rewrite with tool work on `numio-ctl.sh`. Mitigation: keep this task documentation-only; capture tooling gaps as separate backlog tasks.
- **Rollback:** revert the rewrite commit and restore the `⚠️ DRAFT` banner. No runtime impact.
