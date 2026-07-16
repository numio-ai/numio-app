---
status: done
kind: task
title: Introduce feature-scoped task management and taskman.sh
---

# Introduce feature-scoped task management and taskman.sh

## Problem statement

Task management was flat: tasks under `tasks/{backlog,active,done}/` with no way to group them by the feature they belonged to. Implementation plans and tasks had no structural linkage. Bugs that surfaced after a feature shipped could not be traced back to the feature that caused them. As the project moves toward autonomous agentic development — with multiple features progressing in parallel, each in its own worktree — this flat structure blocks the agent from scoping work to a single feature without manual filing.

The goal of this work was to enhance the task-management process to express features as first-class entities, without exploding the directory structure, while preserving the interactive dialog quality of the existing `/agn:create-*` skills.

## Scope

**In scope:**
- `.claude/rules/task-management.md` — rewrite to introduce features, YAML fields (`feature`, `kind`), required body sections per entity type, and the completion-summary requirement.
- `CLAUDE.md` — update the "Working on Tasks" section to reflect the new model.
- `scripts/taskman.sh` — new CLI encapsulating all filesystem operations with invariants enforced at creation time.
- `scripts/tests/taskman_test.sh` — smoke tests.
- `.claude/skills/create-feature/SKILL.md` — new skill (renamed from `create-plan`) authoring feature plan + child tasks through dialog, writing via taskman.
- `.claude/skills/create-task/SKILL.md` — updated to write via taskman.
- `.claude/skills/implement/SKILL.md` — added `feature <slug>` mode; all moves via taskman.
- `.claude/skills/codebase-review/SKILL.md` — creates ad-hoc tasks via taskman; optional bug-on-feature attachment.
- `.claude/skills/design/SKILL.md` — fix a stale `/agn:plan` reference.

**Out of scope:**
- Retroactive migration of existing task files. Legacy tasks stay "implicitly ad-hoc"; `taskman.sh validate` downgrades their informal `feature:` values to warnings.
- Changes to `docs/implementation-plan.md` (the project-level DAG). The legacy `/agn:implement plan` mode remains valid for that artifact.
- Enforcing the feature:worktree 1:1 mapping in tooling. Kept as a convention.
- Parallel agent execution across features. v1 is sequential.

## Acceptance criteria

- `scripts/taskman.sh` supports the eight planned commands (`new feature`, `new task`, `move`, `list features`, `list tasks`, `feature show`, `feature close`, `validate`) with the documented flags and invariants.
- `--dry-run` on both `new` commands prints the target path and composed file content without writing.
- `scripts/tests/taskman_test.sh` runs a 24-case lifecycle covering create, dry-run, duplicate-slug, body validation, `--no-validate` override, feature attachment, orphan rejection, ad-hoc bugs, move with YAML sync, feature-close preconditions, list filters, and invalid-slug rejection — all passing.
- `taskman.sh validate` is green on the real repo; legacy tasks produce warnings only.
- `/agn:create-feature` exists; `/agn:create-plan` does not. All skill references to the old name are gone.
- All skills authoring tasks use taskman via stdin heredoc and preview with `--dry-run`.

## Quality gates

- `bash -n scripts/taskman.sh` — syntax check.
- `./scripts/tests/taskman_test.sh` — 24/24 passing.
- `./scripts/taskman.sh validate` — green on the repo; warnings on legacy tasks only.
- `grep -r /agn:create-plan .claude/` — no results.
- `grep -r /agn:plan .claude/skills/` — no results (outside this task file).

## Summary

**Steps completed (in order):**

1. Dialogued the problem: flat task layout blocks feature grouping and autonomous parallel work. Considered three design alternatives (metadata/flat, feature folders with sub-lifecycle, feature folders flat inside). Selected Option A: metadata-based grouping, smallest delta from the existing model.
2. Locked design decisions: explicit feature `status`, `kind: task|bug`, legacy tasks stay implicitly ad-hoc, `/agn:create-plan` renamed to `/agn:create-feature`, `--dry-run` as the skill preview hook.
3. Implemented `scripts/taskman.sh` — 8 commands, stdin-body contract with metadata flags, slug/section validation, slug-uniqueness among non-done features, feature-existence check at task creation, YAML status rewrite on move, feature-close precondition. Fixed a glob-expansion bug (`[[ -e ]]` instead of globbing literal paths) during smoke testing.
4. Authored `scripts/tests/taskman_test.sh` — 24 cases against a sandbox directory via `TASKMAN_TASKS_DIR`. All passing.
5. Rewrote `.claude/rules/task-management.md`: concepts table, storage, naming, YAML per entity, body structure, lifecycle with feature-close precondition, taskman.sh mandate, migration note, git-worktree convention. Later added the Completion summary requirement (this section).
6. Updated `CLAUDE.md` "Working on Tasks" with the new layout, feature-close rule, taskman mandate, and a quick-reference command block.
7. Created `.claude/skills/create-feature/SKILL.md`, removed old `.claude/skills/create-plan/` directory.
8. Rewrote `.claude/skills/create-task/SKILL.md`: dialog structure preserved; write step switched to taskman stdin + dry-run preview; bug flow aligned with the required sections.
9. Rewrote `.claude/skills/implement/SKILL.md`: added `feature <slug>` mode; all lifecycle actions routed through `taskman.sh move` and `feature close`.
10. Updated `.claude/skills/codebase-review/SKILL.md`: findings now produce ad-hoc tasks via taskman; bug-on-feature attachment flagged as an option when a finding clearly belongs to an open feature.
11. Fixed a stale `/agn:plan` reference in `.claude/skills/design/SKILL.md`.
12. Added the Completion summary rule retrospectively after the user raised it, then created this task file as a retrospective audit record and moved it straight to `done/` to exercise the new rule.

**Files created:**

- `scripts/taskman.sh`
- `scripts/tests/taskman_test.sh`
- `.claude/skills/create-feature/SKILL.md`
- `tasks/done/20260419_introduce_feature_scoped_task_management_and_taskman_sh.md` (this file)

**Files changed:**

- `.claude/rules/task-management.md` — full rewrite
- `CLAUDE.md` — "Working on Tasks" section
- `.claude/skills/create-task/SKILL.md`
- `.claude/skills/implement/SKILL.md`
- `.claude/skills/codebase-review/SKILL.md`
- `.claude/skills/design/SKILL.md` — one-line fix

**Files deleted:**

- `.claude/skills/create-plan/SKILL.md` (and its directory)

**Notable decisions and deviations:**

- Validation for legacy tasks with informal `feature:` tags was originally planned to error; downgraded to warn after discovering 10 existing free-text or slug-shaped orphans in `tasks/backlog/`. Creation-time enforcement remains strict so no new orphans can be introduced.
- `taskman.sh move` is permissive about lifecycle order — it allows `backlog → done` directly. This was exercised here to file this retrospective task. Left permissive for now; can be tightened later if needed.
- Feature body required sections are `Problem statement / Objective / Acceptance criteria` (plan-shaped). Open item: tighten to fully match the Plan Structure in `first-principles.md` (which also lists Requirements and Risks) — not done in this pass.
- `tasks/done/` destination for this file was reached with an explicit `taskman.sh move … done` from `tasks/backlog/`, skipping `active/`, because the work was already complete when the record was created.
- No commit made. Changes sit on the working tree of branch `feat/worktree-isolated-dev-stacks` pending user review.

**Quality gates executed:**

- `bash -n scripts/taskman.sh` — clean.
- `./scripts/tests/taskman_test.sh` — 24/24 passing.
- `./scripts/taskman.sh validate` — green (2 warnings on legacy informal `feature:` values, as expected).
- `grep -r /agn:create-plan .claude/` — empty.
- `grep -r /agn:plan .claude/skills/` — empty.

**Follow-ups (not done in this task):**

- Consider tightening feature body required sections to match `first-principles.md` plan structure.
- Consider whether `taskman.sh move` should enforce linear lifecycle (reject `backlog → done` skip).
- Consider whether `taskman.sh move <path> done` should require a `## Summary` section before accepting the move (enforce the new rule in tooling).
