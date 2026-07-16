---
status: done
---

# Document Database Schema Management in Ops Runbook

## Problem Statement

The ops runbook (`docs/ops-runbook.md`) has a placeholder section for "Database Schema Management" but no actual content. Since the application does not run migrations on startup, DevOps engineers need clear instructions on how to manage database schema changes as part of the deployment process.

## Scope

**In scope:**
- Document how to run Alembic migrations before deploying a new application version
- Document rollback procedures (downgrade to a specific revision)
- Document migration verification steps (checking current revision, pending migrations)
- Document the relationship between application versions and migration revisions

**Out of scope:**
- Changing migration tooling (Alembic stays)
- Automating migrations in CI/CD (separate task)
- Local development setup (already covered in dev-runbook.md)

## Acceptance Criteria

1. The "Database Schema Management" section in `docs/ops-runbook.md` contains complete, actionable instructions
2. A DevOps engineer can follow the instructions to apply migrations to a production database without additional guidance
3. Rollback procedure is documented with a concrete command example
4. Cross-references between dev-runbook.md and ops-runbook.md are consistent

## Quality Gates

- Read through the documented procedures and verify each command is correct and complete
- Verify cross-references between dev-runbook.md and ops-runbook.md resolve correctly
