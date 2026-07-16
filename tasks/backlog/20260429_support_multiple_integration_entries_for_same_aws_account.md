---
status: backlog
kind: task
feature: aws_onboarding_wizard
title: Support multiple integration entries for same AWS account
---

# Support multiple integration entries for same AWS account

## Problem statement

The `aws_accounts` table enforces a unique `(workspace_id, aws_account_id)` constraint. This causes two limitations:

1. Running **Guided setup** for an AWS account already onboarded silently **overwrites** the existing entry's credentials and role ARN.
2. Running Guided setup twice for the same account is impossible — the second attempt is treated as an update, not an addition.

The team needs the ability to onboard the same AWS account multiple times. Primary motivation is **experimentation**: comparing different CUR configurations (hourly vs daily vs monthly, different detail levels) side-by-side without juggling a single shared record.

## Scope

**In scope**

- Backend `aws_accounts` schema: remove the `(workspace_id, aws_account_id)` uniqueness so multiple rows per account are allowed in one workspace. The UUID `id` remains the primary key and the only entry identity.
- Alembic migration that drops the existing unique index without data loss.
- Onboarding API (`backend/src/numio/api/onboarding.py`) and account API: allow creating a new entry when an account with the same `aws_account_id` already exists in the workspace.
- Guided setup wizard: when the entered `aws_account_id` matches an existing entry, default to creating a **new** entry. Existing entries are edited from the Settings → Integrations list, not by re-entering Guided.
- Advanced setup form: same behavior — always create a new entry; never silently update by `aws_account_id`.
- Settings → Integrations list: each entry is shown, edited, validated, and deleted independently.
- Backend tests covering the new multi-entry behavior.

**Out of scope**

- Cost data attribution and de-duplication. Two entries with different CUR configs may ingest overlapping data — this is acceptable for the experimentation use case and not part of this task.
- Feature flags or environment guardrails. The capability is available to all users in all environments.
- UI affordances to compare, merge, or visually group sibling entries.
- Migration of historical `cost_records` to any new identity model.
- Alias uniqueness. Alias stays free-form; users disambiguate visually.

## Acceptance criteria

A1. Running Guided setup for an AWS account that already has one entry in the workspace produces a **second** entry — different internal UUID, same `aws_account_id`. Both entries persist independently.

A2. Running Advanced setup with an `aws_account_id` already present creates a new entry instead of returning a conflict error.

A3. The Settings → Integrations list shows every entry separately, including duplicates of the same `aws_account_id`. Each row can be edited, validated, and deleted independently.

A4. Editing one entry's role ARN, credentials, external ID, or CUR config does not modify any sibling entry that shares the same `aws_account_id`.

A5. Deleting one entry leaves sibling entries with the same `aws_account_id` intact and connected.

A6. Backend tests cover: (a) two entries for the same account coexist; (b) Guided/Advanced flow rerun creates a new entry rather than updating; (c) per-entry edit and delete are isolated.

A7. The `(workspace_id, aws_account_id)` unique index is removed from the schema. An Alembic migration ships with the change and applies cleanly to a development database that contains existing `aws_accounts` rows.

## Quality gates

- `cd backend && uv run pytest -k "aws_account or onboarding"` passes.
- `cd backend && uv run ruff check . && uv run ruff format --check .` passes.
- `cd frontend && npm run build` passes.
- `./scripts/numio-dev.sh migrate` applies the new Alembic revision against a dev database holding at least one existing `aws_accounts` row, without data loss.
- Manual end-to-end check: run Guided setup twice for the same AWS account in one workspace; verify both entries appear in Settings → Integrations and both can be edited, validated, and deleted independently.
