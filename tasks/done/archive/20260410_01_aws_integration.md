---
Date: 2026-04-10
status: done
kind: task
---

# Numio AWS Identity Setup

Design: [aws-integration.md](../../docs/design/aws-integration.md)

## Problem

Numio uses `sts:AssumeRole` to access customer AWS accounts. For this to work, Numio must have its own AWS identity, and customers must know that identity's ARN to put in their trust policies. Today this is broken: `NUMIO_PRINCIPAL_ARN` defaults to empty, auto-discovery returns session ARNs that are invalid in trust policies, and the ops-runbook tells operators to paste temporary credentials into `.env` files.

## Changes

### C1. Fix `get_numio_principal_arn()` in `aws_service.py`

The function currently returns the raw `sts:GetCallerIdentity` response. For assumed-role sessions this looks like `arn:aws:sts::123:assumed-role/MyRole/session-name` — not valid in trust policies. Fix: parse the ARN and convert assumed-role session ARNs to the underlying role ARN (`arn:aws:iam::123:role/MyRole`). If `NUMIO_PRINCIPAL_ARN` is set in config, use that instead of calling STS.

### C2. Rewrite ops-runbook AWS section

Replace the current "create a NumioService role, assume it, paste creds into .env" instructions with:

- **Production (ECS/EKS):** Identity comes from the platform (task role / service account). No credentials to configure. Document the required `sts:AssumeRole` permission on the task role.
- **Development (local/Docker):** Use AWS SSO. `~/.aws` is mounted read-only into the container. Document the `aws sso login` workflow.
- **`NUMIO_PRINCIPAL_ARN`:** Explain what it is, that auto-discovery works as fallback, and how to set it explicitly if needed.
- **Verification command:** `docker compose exec backend python -c "import boto3; print(boto3.client('sts').get_caller_identity()['Arn'])"`

### C3. Improve IAM Setup Guide warning

When `numio_principal_arn` is not available, the warning should explain that Numio cannot detect its AWS identity — the operator needs to either configure AWS credentials on the host (SSO, instance profile) or set `NUMIO_PRINCIPAL_ARN` explicitly.

### C4. Add `~/.aws` volume mount to docker-compose.yml

Mount `~/.aws` read-only into backend and worker containers so boto3 can resolve SSO credentials in Docker.

## Acceptance Criteria

1. `get_numio_principal_arn()` returns a trust-policy-compatible ARN (converts `arn:aws:sts::*:assumed-role/X/Y` to `arn:aws:iam::*:role/X`). Uses `NUMIO_PRINCIPAL_ARN` config when set.
2. Ops-runbook AWS section documents SSO for dev and task role for production. No more "paste temporary creds into .env" as primary path.
3. IAM Setup Guide warning is actionable when ARN is missing.
4. `docker-compose.yml` mounts `~/.aws` for dev SSO support.
