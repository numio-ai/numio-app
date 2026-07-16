---
status: done
kind: bug
title: Cognito-not-configured warning in local dev with AUTH_ENABLED=false
---

# Cognito-not-configured warning in local dev with AUTH_ENABLED=false

## Problem statement

**Observed (local dev, branch `dev`, started via `./scripts/numio-dev.sh run all`):**
The login page renders the yellow warning:

> Cognito is not configured. Set AUTH_ENABLED=false in the backend to use bypass mode, or configure VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.

**Expected:**
With `AUTH_ENABLED=false` on the backend (local-dev default per [docs/ops-runbook.md:136](docs/ops-runbook.md:136)), the frontend should never reach the Login page. `AuthContext.checkSession()` at [frontend/src/context/AuthContext.jsx:22](frontend/src/context/AuthContext.jsx:22) calls `GET /api/v1/auth/me`, which in bypass mode returns the synthetic admin. `isAuthenticated` becomes `true` and the user is routed to `/overview`.

The warning is a *symptom*: the Login page is being reached at all, which means the `/me` call did not return the bypass admin (proxy failure, backend unreachable, or a regression in the bypass path).

**History:**
This was fixed once before. It regressed after a significant codebase rework and a Vite upgrade (see [f37b4e1](f37b4e1) "Fix vite version for frontend"). There is no documented guidance on how to recover, and no default frontend config file — only [docker-compose.yml](docker-compose.yml), [frontend/Dockerfile](frontend/Dockerfile), and [deployment/n0/static-config](deployment/n0/static-config) reference `VITE_*`, none of which apply to `numio-dev.sh run all`.

**Impact:**
A developer running the documented local-dev happy path hits a dead-end login screen with no actionable remediation. Time-to-first-page is broken for new contributors.

## Scope

**In scope:**
1. Reproduce the failure on `dev` using `./scripts/numio-dev.sh run all` and capture the actual network-level cause (proxy misconfig, `/me` 401/404/CORS, missing `VITE_API_URL`, etc.).
2. Fix the root cause so the bypass-mode flow works end-to-end in local dev with zero manual config.
3. Ship a `frontend/.env.example` (or equivalent checked-in template) with inline comments covering every `VITE_*` var the frontend reads today: `VITE_API_URL`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REDIRECT_URI`. Comments must state which vars are required, which are optional, and when each is needed (bypass vs Cognito).
4. Update [docs/dev-runbook.md](docs/dev-runbook.md) with a short "Authentication in local dev" section explaining: default is bypass mode, no Cognito config required, and how to verify `/me` returns the synthetic admin. Cross-link from a troubleshooting entry titled "Frontend shows 'Cognito is not configured' warning".
5. Add a regression guard so this cannot silently re-break — either an e2e/integration check that hits `/` in bypass mode and asserts the Login page is not rendered, or a contract test on the frontend proxy → backend `/me` path. Pick the lighter of the two that gives signal.

**Out of scope:**
- Cognito-enabled (`AUTH_ENABLED=true`) flows.
- Production / `deployment/n0` configs.
- UX changes to the Login page itself.
- Refactoring the Auth bypass mechanism on the backend.

## Acceptance criteria

1. From a clean checkout of `dev`, running `./scripts/numio-dev.sh init && ./scripts/numio-dev.sh run all` and opening http://localhost:5173 lands the user directly on `/overview` with no Login page and no warning banner.
2. `curl -fsS http://localhost:8000/api/v1/auth/me` returns the synthetic admin JSON (HTTP 200) without any auth header.
3. `frontend/.env.example` exists, is committed, is referenced from the dev runbook, and each `VITE_*` entry has an inline comment explaining purpose, required-vs-optional, and the mode (bypass / Cognito) it applies to.
4. [docs/dev-runbook.md](docs/dev-runbook.md) contains a discoverable "Authentication in local dev" section and a troubleshooting entry whose title matches the exact warning text the user would paste into search.
5. The regression guard (chosen in scope item 5) runs in the normal test command (`cd frontend && npm test` or backend `uv run pytest`) and fails if the bypass-mode landing flow breaks again.
6. The `## Summary` section of this task file, written at close, names the root cause found and the single commit or PR that fixed it.

## Quality gates

- `cd frontend && npm run build` passes.
- `cd frontend && npm test` passes (including the new regression guard).
- `cd backend && uv run pytest` passes.
- `cd backend && uv run ruff check .` passes.
- Manual verification: stop all services, run `./scripts/numio-dev.sh run all`, open http://localhost:5173 in a fresh browser profile, confirm direct landing on `/overview` with no warning.
- `./scripts/taskman.sh validate` passes.

## Constraints and assumptions

- Default local-dev posture stays `AUTH_ENABLED=false`. Do not flip this default.
- `VITE_*` vars are baked at build time; the `.env.example` must work with the current Vite dev server loading order (`.env`, `.env.local`, `.env.development`, etc.). Document which file name `numio-dev.sh` expects, or make it explicit.
- Do not introduce Cognito credentials into any committed file.
- Keep the fix surface minimal — if the root cause is a single misrouted proxy path or a missing dev-time env default, prefer that over refactoring auth plumbing.

## Risks and rollback

- **Risk:** Regression guard gives false positives on CI due to timing (backend not ready when frontend test runs). *Mitigation:* pick a unit-level or contract-level check rather than a full e2e, or gate the e2e on the existing `./scripts/numio-dev.sh health` wait.
- **Risk:** Shipping `.env.example` accidentally overrides a developer's local `.env`. *Mitigation:* `.env.example` is never auto-copied; runbook instructs `cp .env.example .env` only if the developer wants to override defaults.
- **Rollback:** Revert the fix commit. No data or schema changes involved.

## Summary

**Root cause.** After the per-worktree dev-stack rework, `./scripts/numio-dev.sh run all` no longer seeded the default workspace and `dev_migrate` was not worktree-aware. A fresh worktree therefore had a Postgres with no `workspaces` table (or an empty one). `GET /api/v1/auth/me` in bypass mode queries `workspaces.slug = 'default'`, crashed with HTTP 500, the frontend treated the error as unauthenticated, `RequireAuth` redirected to `/login`, and the Login page fell back to the "Cognito is not configured" banner. The banner was the *last* visible symptom of a much earlier setup-flow breakage — not a Cognito config problem.

**Fix posture (per direct guidance from the product owner).** Dev tooling stays non-opinionated: `run backend` and `run all` still do not auto-migrate, auto-seed, or mutate application data. Instead, the missing setup steps were made first-class commands and the SOP was documented.

**Steps completed.**

1. Reproduced the failure on a fresh worktree stack: `./scripts/numio-dev.sh run all` on a clean Postgres → `/api/v1/auth/me` returned HTTP 500 with `UndefinedTable: relation "workspaces" does not exist`. After running migrations: 500 with `Default workspace not found. Run seed data first.`. After seeding the default workspace: 200 with synthetic admin JSON.
2. Wrote and confirmed the end-to-end SOP on a nuked worktree: `run infra → migrate → seed → run all → curl /api/v1/auth/me` returns the synthetic admin via both the backend port and the Vite proxy.
3. Fixed the secondary defect: `dev_migrate` now exports the worktree's `DATABASE_URL`, so alembic no longer silently migrates a sibling worktree's Postgres.
4. Added a `seed` subcommand that idempotently inserts the default workspace row.
5. Shipped `frontend/.env.example` with inline comments for every `VITE_*` variable.
6. Documented the new SOP in `docs/dev-runbook.md` (sections: *First-time worktree setup*, *Authentication in local dev*) and a troubleshooting entry titled *Frontend shows "Cognito is not configured" warning*.
7. Added regression guard `TestAuthBypassSetupGuard` in `backend/tests/test_auth.py` — deletes the default workspace and asserts `/api/v1/auth/me` fails loudly with 5xx and a message mentioning workspace/seed. Catches future silent regressions of the bypass error path.

**Changes.**

- `scripts/tools/dev.sh` — `dev_migrate` now exports worktree `DATABASE_URL`; new `dev_seed` function.
- `scripts/numio-dev.sh` — wired the `seed` subcommand, updated help text and `init` next-steps output.
- `frontend/.env.example` — new, documents every `VITE_*` var and its required-vs-optional status per auth mode.
- `docs/dev-runbook.md` — new SOP and authentication sections, new troubleshooting entry.
- `backend/tests/test_auth.py` — new `TestAuthBypassSetupGuard::test_me_surfaces_clear_error_when_default_workspace_missing`.

**Notable decisions / deviations.** The original plan proposed auto-migrate + auto-seed inside `run backend`. The product owner explicitly rejected this: dev tools must not silently mutate application state. The fix was refocused on documenting the SOP and adding an explicit `seed` command. This feedback was saved to memory as `feedback_dev_tools_non_opinionated.md`.

**Quality gates.** `cd backend && uv run pytest` → 496 passed. `cd frontend && npm test` → 131 passed. `cd frontend && npm run build` → green. `ruff check` / `ruff format --check` clean on all files touched. `./scripts/taskman.sh validate` → OK. Manual end-to-end verified on the running worktree stack.

**Links.** Commit: filled in at close by the commit step in the implementation flow.

