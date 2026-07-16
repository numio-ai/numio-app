---
description: Task management standard for all projects in the organization.
alwaysApply: true
---

## Concepts

| Term | Meaning |
|------|---------|
| **Epic** | A named functional block larger than a feature. Decomposes into one or more features. Identified by a stable **slug**. |
| **Feature** | A named unit of product work that produces a plan and one or more tasks. Identified by a stable **slug**. Optionally belongs to an epic via `epic: <slug>`. |
| **Task** | A unit of implementation work. Either belongs to a feature (via `feature: <slug>`) or is **ad-hoc** (no feature field). |
| **Bug** | A task with `kind: bug`. Follows the same lifecycle. Can be attached to a feature (post-merge follow-up) or ad-hoc. |

Default `kind` is `task`. A task without a `feature` field is ad-hoc. A feature without an `epic` field is **stand-alone** — not part of any epic.

The hierarchy is **epic → feature → task**. Each tier is optional one level up: a task may have no feature, and a feature may have no epic. The hierarchy is open, not enforced.

## Storage

```
tasks/
  epics/             # epic files — flat folder, no lifecycle subfolders
    YYYYMMDD_<slug>.md
  features/          # feature files — flat folder, no lifecycle subfolders
    YYYYMMDD_<slug>.md
  backlog/           # task lifecycle
  active/
  done/
```

Epic and feature files do not move. Their lifecycle lives in the `status` field.

Task files move between `backlog/`, `active/`, `done/` as they transition. The folder is the source of truth for a task's state; the YAML `status` must agree.

## Naming

- **Epic file:** `YYYYMMDD_<slug>.md`. `YYYYMMDD` is the creation date; `<slug>` is the epic's identifier and is referenced by member features.
- **Feature file:** `YYYYMMDD_<slug>.md`. `YYYYMMDD` is the creation date; `<slug>` is the feature's identifier and is referenced by member tasks.
- **Task file:** `YYYYMMDD[_NN]_<slug>.md`. `_NN` added only when there's a same-day filename collision.
- **Slug format:** `[a-z][a-z0-9_]*` — lowercase, underscores, no hyphens or dots. Keep short and stable.

## YAML frontmatter

Every epic, feature, and task file starts with a YAML block.

**Epic:**
```yaml
---
status: backlog | active | done
slug: <slug>
title: <human-readable title>
---
```

**Feature:**
```yaml
---
status: backlog | active | done
slug: <slug>
epic: <slug>           # omit for stand-alone features
title: <human-readable title>
---
```

**Task:**
```yaml
---
status: backlog | active | done
kind: task | bug
feature: <slug>        # omit for ad-hoc tasks
title: <human-readable title>
---
```

## Body structure

**Epic body** — required sections:

- **Problem statement** — what problem this epic solves and why
- **Objective** — desired end state at the functional-block level
- **Scope** — what is in and out of scope; how this epic differs from adjacent epics
- **Acceptance criteria** — observable conditions at functional-block level that prove the epic is complete
- **Linked features** — ordered list of feature slugs that compose this epic, in execution order

An epic is a functional-block-sized project plan. It says **why** the work matters at a level larger than a single feature, **what** done looks like for the whole block, and **which features** deliver it. It does not duplicate feature or spec content. Each linked feature owns its own scope, acceptance criteria, and tasks.

**Feature body** — required sections:

- **Problem statement** — what problem this feature solves and why
- **Objective** — desired end state
- **Acceptance criteria** — testable conditions that prove the feature is complete; include any post-launch success measures here as observable conditions

Recommended:

- **Scope** — what is in and out of scope
- **Tasks** — ordered list of task titles or slugs that compose this feature, in execution order
- **Linked spec** — pointer to the implementation contract under `docs/<area>/.../-spec.md`

A feature is a tight project plan. It says **why** the work matters, **what** done looks like, and **which tasks** deliver it. It does not duplicate spec content.

**Do not** put **Requirements** in the feature file. Detailed requirements live in the linked spec — putting them in two places guarantees drift.

**Do not** put **Risks and mitigations** in the feature file unless each risk has a named owner and a mitigation plan you intend to track. Risks listed without action are dead weight.

**Do not** put **Success metrics** as a separate section. If a measure is testable, fold it into Acceptance criteria. If it is not testable, it does not belong here.

**Task body** — required sections:

- **Problem statement** — what problem this task solves
- **Scope** — what is in scope and what is explicitly out of scope
- **Acceptance criteria** — testable conditions that prove completion
- **Quality gates** — validation steps, required reviews, or checks that must pass before the task moves to `done`

Recommended: Constraints and assumptions.

## Completion summary (required at close)

When a task, feature, or epic moves to `done`, **append** a `## Summary` section at the end of the file, before the YAML is updated and the file is moved. This is mandatory for audit and traceability — a future agent troubleshooting a later issue should be able to read the file and understand what actually landed, without replaying git history.

The summary covers:

- **Steps completed** — what was actually done, in order.
- **Changes made** — files created, changed, or deleted; key artifacts produced.
- **Notable decisions or deviations** — anything that departs from the original plan and why.
- **Links** — PRs, commits, follow-up tasks, related bugs.

Example of how this matters: an agent investigating a reported bug jumped to changing the codebase, but the user recalled the bug had already been fixed weeks earlier. The agent then found the fix described in a `done/` task's summary and corrected its plan. That outcome depends on every completed task carrying an honest, specific summary.

Keep it factual and concrete. "Implemented per plan" is not a summary.

## Lifecycle

### Task

```
backlog → active → done
```

Moving a task changes both the folder and the `status` field. Use `taskman.sh move` — it keeps them in sync. Before moving to `done`, append a `## Summary` section (see *Completion summary*).

### Feature

```
backlog → active → done
```

A feature may only transition to `done` when **every** task with a matching `feature: <slug>` is in `done/`. Use `taskman.sh feature close <slug>` — it enforces this. Before closing, append a `## Summary` section to the feature file (see *Completion summary*).

Intermediate transitions (`backlog → active`) are set by the initiator and do not have mechanical preconditions.

### Epic

```
backlog → active → done
```

An epic may only transition to `done` when **every** feature with a matching `epic: <slug>` is in `done/`. Use `taskman.sh epic close <slug>` — it enforces this. Before closing, append a `## Summary` section to the epic file (see *Completion summary*).

Intermediate transitions (`backlog → active`) are set by the initiator and do not have mechanical preconditions.

## Tooling

All create / move / close / list operations go through `scripts/taskman.sh`. Skills (`/agn:epic-create`, `/agn:feature-create`, `/agn:task-create`, `/agn:task-implement`, `/agn:feature-implement`, `/agn:epic-implement`) must not write task files directly — they compose the body in dialog with the user, then hand off to taskman as the last step.

The important commands:

```
taskman.sh new epic     --slug <s> --title "<t>" < body
taskman.sh new feature  --slug <s> --title "<t>" [--epic <s>] < body
taskman.sh new task     --title "<t>" [--feature <s>] [--kind task|bug] < body
taskman.sh finalize     <path>
taskman.sh discard      <path>
taskman.sh move         <task-path> <backlog|active|done>
taskman.sh feature close <slug>
taskman.sh epic close   <slug>
taskman.sh list epics    [--status backlog|active|done]
taskman.sh list features [--epic <s>] [--status backlog|active|done]
taskman.sh list tasks    [--feature <s>] [--status backlog|active|done] [--kind task|bug]
taskman.sh validate
```

### Draft preview workflow

`taskman.sh new epic`, `taskman.sh new feature`, and `taskman.sh new task` write the file directly to its destination but stamp `draft: true` into the YAML header. The authoring skill then re-reads the file from disk, presents it to the user, and ends the dialog with one of:

- `taskman.sh finalize <path>` — clears the `draft: true` marker. The file becomes final.
- `taskman.sh discard <path>` — deletes the file. Refuses to act on files that are not marked `draft: true`, so it cannot accidentally remove finalised work.

The `draft: true` marker is informational only and does not introduce a fourth lifecycle state. Its purpose is debugging: if a skill abandons mid-creation, the leftover file is visibly unfinalised. `taskman.sh validate` accepts files with or without the marker.

Run `./scripts/taskman.sh help` for the full surface.

## Approval

The **initiator** of the work approves state transitions:

- Human-initiated — human approves backlog → active and active → done.
- Agent-initiated — agent approves after validation and notification of the product owner.

## Migration

Tasks that existed before this rule are **implicitly ad-hoc**. `taskman.sh validate` downgrades legacy `feature:` references to warnings (informal free-text or stale slugs) rather than errors. Features that existed before the epic tier are **implicitly stand-alone** — same treatment for legacy `epic:` references. No retroactive rewrite required.

## Relationship to Git

A feature is the natural unit of a git worktree: one feature slug → one branch → one isolated dev stack. Epics span multiple worktrees. This is an operational convention, not a rule — taskman does not enforce a feature:worktree mapping.
