---
status: done
kind: task
feature: mock_backend_switch
title: Document the mock/real switch
---

# Document the mock/real switch

## Problem statement

The `mock_backend_switch` feature lets the frontend run the full UI from synthetic data with no backend, controlled by one build-time flag (`VITE_API_MODE`). The sibling tasks build the switch, mock layer, coverage, and tests. Without operator- and developer-facing docs, a new reader cannot discover the flag, launch a backend-free demo, or find where the mock layer lives. This task closes that gap.

## Scope

In scope:
- Add a `VITE_API_MODE` block to `frontend/.env.example`: allowed values `mock|real`, the default, and when to use each. Match the comment style of the existing `VITE_API_URL` and `VITE_COGNITO_*` entries. Note in the comment that this file is documentation only — the build default is set by the `define` block in `vite.config.js` (spec §2.1), and mock mode is selected per-command (`VITE_API_MODE=mock npm run dev`), not by editing `.env.example`.
- Add one section to `docs/dev-runbook.md` (place it directly after "Frontend Cognito configuration", before "## Daily Workflow"; name it "Frontend mock mode"). Cover: run the app in mock mode with no backend, switch to the real backend, how mock mode relates to deterministic tests, and where the mock layer and synthetic data live (`frontend/src/mocks/`).
- Cross-reference the linked spec `docs/frontend/mock-backend-spec.md` from the new runbook section.
- Add `docs/frontend/mock-backend-spec.md` to the "Full list of documentation" in `CLAUDE.md`. `docs/frontend/` is a new doc area; the index must list it.

Out of scope:
- Writing the spec `docs/frontend/mock-backend-spec.md` (authored during the `/agn:design feature mock_backend_switch` step).
- Any frontend or runtime code; the switch, mock data, coverage, or tests (the sibling tasks).
- Operator runbook (`docs/ops-runbook.md`) — mock mode is a developer/demo concern, not a laptop-install concern.

Note: this is the dedicated documentation pass for the feature. Sibling tasks still patch any docs they directly affect, per the repo docs-sync rule. This task ensures the switch documentation is complete and internally consistent.

## Acceptance criteria

1. `frontend/.env.example` contains a `VITE_API_MODE` block that states allowed values `mock|real`, the default value, and when to use each. Comment style matches the existing `VITE_*` entries.
2. `docs/dev-runbook.md` contains a new "Frontend mock mode" section that documents: (a) the command(s) to run the app in mock mode with no backend, (b) how to switch to the real backend, (c) how mock mode relates to tests, (d) a pointer to `frontend/src/mocks/`.
3. The new runbook section links to `docs/frontend/mock-backend-spec.md`, and the link resolves to an existing file at close time.
4. The "Full list of documentation" in `CLAUDE.md` lists `docs/frontend/mock-backend-spec.md`.
5. All internal links and path references added by this task resolve: `docs/frontend/mock-backend-spec.md` and `frontend/src/mocks/`.

## Quality gates

- Markdown renders correctly; no syntax errors in the edited files.
- No broken internal links or path references in the changed docs (spec path, `frontend/src/mocks/`, runbook anchors).
- A reader following only the new runbook section can launch the app in mock mode with no backend running, without consulting other files.
- `docs/frontend/mock-backend-spec.md` exists when this task closes (the cross-reference must resolve). The spec is authored during the `/agn:design feature mock_backend_switch` step, so this task runs after that step.

## Constraints and assumptions

- The spec `docs/frontend/mock-backend-spec.md` is authored during the `/agn:design feature mock_backend_switch` step (before implementation). This task references it and does not write it. The cross-reference (AC 3) only resolves once that file exists.
- `frontend/src/mocks/` already exists and holds the synthetic data modules (index plus per-area `mock*.js` files). This task points readers to it; it does not modify it.
- The exact `VITE_API_MODE` values and default (`mock|real`, default per the implemented switch in `switch_dispatch_seam`) must match what that task ships. If it changed the default or value names, align the docs to the code, not to this brief.

## Summary

### Steps completed
1. Added a `VITE_API_MODE` block to `frontend/.env.example` (allowed `mock | real`, default `real`, when to use each), matching the existing `VITE_*` comment style and noting the file is documentation-only — the build default comes from the `vite.config.js` define and mock mode is selected per-command.
2. Added a "Frontend mock mode" section to `docs/dev-runbook.md`, placed directly after "Frontend Cognito configuration" and before "## Daily Workflow": how to run mock mode with no backend, how to switch back to real, how mock mode backs Vitest/Puppeteer tests, and where the mock layer + synthetic data live. It cross-references `docs/frontend/mock-backend-spec.md`.
3. Added `docs/frontend/mock-backend-spec.md` to the "Full list of documentation" in `CLAUDE.md` (new `docs/frontend/` area).

### Changes made
- Modified: `frontend/.env.example`, `docs/dev-runbook.md`, `CLAUDE.md`. Docs only — no code touched.

### Verification (all quality gates pass)
- Aligned to shipped code: default `real`, values `mock|real`, per-command selection — matches `switch_dispatch_seam`.
- All added path/link references resolve: `docs/frontend/mock-backend-spec.md`, `frontend/src/mocks/` (and `frontend/src/mocks/synthetic/`), `frontend/src/api/mock/`, `frontend/src/test/mockMode.js` (verified on disk).
- The new runbook section is self-contained: a reader can launch mock mode (`VITE_API_MODE=mock npm run dev`) with no backend without consulting other files.

### Links
- Spec: `docs/frontend/mock-backend-spec.md`. Branch: `feature/mock_backend_switch`.
