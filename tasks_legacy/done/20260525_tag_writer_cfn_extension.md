---
status: done
kind: task
feature: tag_management
title: CFN EnableTagWrites parameter, NumioTagWriterRole, tag_writer_role_arn, verify step
---

# CFN EnableTagWrites parameter, NumioTagWriterRole, tag_writer_role_arn, verify step

## Problem statement

Numio cannot write tags because connected accounts grant only read (`NumioCurReaderRole`). Feature `tag_management` needs an opt-in writer role provisioned through the existing Guided CFN flow, plus a column to store its ARN and a verify check. Spec §5.5, §6.1, §6.2.

## Scope

In scope:
- Alembic: add `aws_accounts.tag_writer_role_arn` (string, nullable). Null = tag writes disabled.
- `backend/src/numio/onboarding/cfn_template.py`: add `EnableTagWrites` parameter (default `"false"`); conditional `NumioTagWriterRole` block with inline `NumioTagWriter` policy (Sids per spec §6.1, Resource `*`); trust policy reuses the `NumioServiceUser-Cfn-<label>` principal + ExternalId; conditional stack output `TagWriterRoleArn`.
- Wizard customize step (`frontend/src/components/onboarding/GuidedOnboarding.jsx`): "Enable tag writes" checkbox, default unchecked, tooltip on the extra IAM scope.
- Verify step gains check #5 `tag_writer_assume_role` (`sts:AssumeRole` against `TagWriterRoleArn`), skipped when `EnableTagWrites=false`. On pass, persist `TagWriterRoleArn` to `aws_accounts.tag_writer_role_arn`.

Out of scope:
- Using the role to write tags (task `tag_write_service`).
- Per-service IAM narrowing (deferred per spec §3).

## Acceptance criteria

A1 (=feature A1). After a Guided CFN run with the checkbox enabled and Verify pass, `aws_accounts.tag_writer_role_arn` is populated for that account; TagGovernance shows the account as tag-write-enabled.
A2. With `EnableTagWrites=false`, the template emits no writer role and no `TagWriterRoleArn` output; verify step 5 is skipped.
A3. Generated template validates (CFN lint / `validate-template` or equivalent unit assertion on the rendered JSON).

## Quality gates

- `cd backend && uv run pytest` green; tests cover template rendering both ways + verify-step persistence.
- `cd frontend && npm test` + `npm run build` green.
- Alembic upgrade/downgrade verified.
- Docs: AWS onboarding spec / user guide updated for the new checkbox and role.

## Summary

**Steps completed** (phased internally, shipped as one unit)
1. **CFN template** (`onboarding/cfn_template.py`): added `EnableTagWrites` parameter (AllowedValues true/false, default false), a `TagWritesEnabled` condition, the conditional `NumioTagWriterRole` (same `NumioServiceUser`+`ExternalId` trust as the reader; inline `NumioTagWriter` policy with spec §6.1 Sids, Resource `*`, MaxSessionDuration 3600), and the conditional `TagWriterRoleArn` output. `enable_tag_writes` added to `TemplateParameters`; `param_EnableTagWrites` added to the quick-create URL.
2. **Schema**: migration `e3f4a5b6c7d8` adds `aws_accounts.tag_writer_role_arn` (nullable); model + `RegisterAccountRequest`/`UpdateAccountRequest`/`AccountResponse` carry it.
3. **Validator** (`core/aws_service.py`): extracted the reader path to `_validate_reader_path`; `validate_account` appends step 5 `tag_writer_assume_role` (skip when no ARN or creds failed; pass/fail otherwise) which never changes `overall_status`. `api/accounts.py` persists `tag_writer_role_arn` only when step 5 passes (clears otherwise) via `_validate_and_persist`; the step-5 skip is excluded from a healthy account's status message.
4. **Onboarding API**: `enable_tag_writes` threaded through `get_cfn_template`, `download_cfn_template`, `_build_template_params`, `_public_template_url`.
5. **Frontend**: `getCfnTemplate`/`getCfnTemplateDownloadUrl` carry `enable_tag_writes`; wizard Customize step has an "Enable tag writes" checkbox; Verify step shows a conditional `TagWriterRoleArn` paste field; register payload sends `tag_writer_role_arn`.

**Verification**
- Backend: 674 passed (incl. 9 new CFN tag-writer tests, 3 validator step-5 tests). Ruff clean on all changed files (70 pre-existing errors in unrelated `ia_v2_*`/`cur_service.py` left untouched). Migration round-trips.
- Frontend: 358 passed (+1 new), `npm run build` clean.
- Live endpoint: `cfn-template?enable_tag_writes=true` renders `NumioTagWriterRole` + `TagWriterRoleArn` output; browser smoke confirmed the Customize-step checkbox.

**Notable decisions**
- `tag_writer_role_arn` provenance: user pastes the `TagWriterRoleArn` stack output; the column is populated iff the verify step assumes it successfully (spec §6.2). Recovery from a failed verify is via the Edit-account form re-supplying the ARN.
- Tag-writer failures are additive (never downgrade `overall_status`); A1 full E2E (live stack apply) is not machine-verifiable here — covered by unit tests + live template-render + browser checkbox smoke.

**Links**: feature `tag_management`. Follow-on note for `tag_write_service` (task 4): it needs a writer-role variant of `assume_role_for_account` (which currently assumes only the reader `role_arn`).
