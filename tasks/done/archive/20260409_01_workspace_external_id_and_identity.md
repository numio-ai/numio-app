---
status: done
kind: task
---

# T1: Workspace ExternalId and Identity Endpoint

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)

## Problem

Numio's AssumeRole calls do not include an ExternalId, leaving customers vulnerable to confused-deputy attacks. Additionally, the IAM Setup Guide cannot render a concrete trust policy because there is no way to discover the IAM identity Numio runs as.

## Goals

1. Add `external_id` (UUID) column to the `workspaces` table. Auto-generate on creation; backfill existing workspaces via migration.
2. Expose `GET /api/v1/workspace/info` returning the workspace's ExternalId and Numio's own principal ARN (discovered via `sts:GetCallerIdentity`).

## Non-goals

- ExternalId rotation mechanism
- Using ExternalId in AssumeRole calls (that's T2)
- Frontend display of ExternalId (that's T5)

## Constraints & Assumptions

- The `sts:GetCallerIdentity` result can be cached for the process lifetime (it doesn't change while the process runs).
- Alembic migration must be backwards-compatible (existing code should not break before T2/T3 are deployed).
- The workspace model already exists with a UUID primary key.

## Acceptance Criteria

1. `workspaces` table has a non-nullable `external_id` UUID column with auto-generation.
2. Existing workspaces have `external_id` populated after migration.
3. `GET /api/v1/workspace/info` returns `{ external_id: "<uuid>", numio_principal_arn: "<arn>" }`.
4. `numio_principal_arn` reflects the actual IAM identity of the running process (works for IAM user, EC2 instance role, ECS task role).
5. Endpoint requires authentication (any role).
6. Tests cover: migration, endpoint response, principal ARN discovery.

## Validation Steps

1. Run `alembic upgrade head` — migration applies without error.
2. Query `SELECT external_id FROM workspaces` — all rows have non-null UUIDs.
3. `GET /api/v1/workspace/info` returns valid JSON with both fields populated.
4. Verify `numio_principal_arn` matches the output of `aws sts get-caller-identity`.

## Risks & Rollback

- Low risk. Additive migration. Rollback: `alembic downgrade` drops the column.
- If `sts:GetCallerIdentity` fails (e.g., no AWS credentials configured), the endpoint should return the ExternalId but indicate the principal ARN is unavailable (not crash).
