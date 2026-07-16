---
status: backlog
kind: bug
title: Verify CFN onboarding label end-to-end against live AWS
---

# Verify CFN onboarding label end-to-end against live AWS

## Problem statement

The Guided CloudFormation (CFN) onboarding flow was reworked so every CFN-managed IAM resource carries a per-instance label (commit `cd04694`, originally tracked as `20260425_distinguish_cfn_managed_aws_onboarding_iam_resources_from_ma`). The code, unit tests, and docs landed and were verified locally. Live-AWS verification was deferred because three Guided-onboarding wizard bugs blocked a clean end-to-end run.

Those three blockers (`bugfix_guided_verify_button_no_feedback`, `bugfix_guided_wizard_state_persistence`, `bugfix_guided_create_cur_and_bucket_option`) all closed by 2026-04-27. The label rework itself is still unverified against real AWS, so the original acceptance criteria #10–#12 remain open.

This task captures only the remaining live-AWS verification. Implementation of the label rework is not in scope — it has shipped.

## Scope

**In scope:**

- Drive the Guided CFN onboarding wizard end-to-end against AWS test account `123456789012` using two distinct labels.
- Confirm CFN-managed IAM resources coexist with manually-created `NumioServiceUser` / `NumioCurReaderRole` from the Advanced flow in the same AWS account.
- Confirm Numio's role validation and CUR ingestion succeed for both CFN-onboarded accounts.
- After verification, append a `## Summary` to this task and move it to `done/` via `taskman.sh move`.
- If verification surfaces defects, file each as its own ad-hoc bug; do not expand this task's scope.

**Out of scope:**

- Any change to the CFN template, `cfn_template.py`, the wizard UI, or the label validation logic. If a defect is found, this task is the verification record; the fix lives in a separate task.
- Backend / frontend unit-test work — already green at park time.
- Documentation updates — `docs/app/settings/integrations/aws-integration-spec.md` was updated alongside the original implementation.

## Acceptance criteria

1. Two CFN templates rendered with distinct labels (e.g. timestamp `A` and timestamp `B`) deployed via CloudFormation quick-create against AWS account `123456789012`. Both stacks reach `CREATE_COMPLETE`.
2. IAM console for `123456789012` shows four CFN-managed resources side by side: `NumioServiceUser-Cfn-A`, `NumioServiceUser-Cfn-B`, `NumioCurReaderRole-Cfn-A`, `NumioCurReaderRole-Cfn-B`. Each carries the four ownership tags (`ManagedBy=Numio`, `numio:managed-by=CloudFormation`, `numio:stack=<stack-name>`, `numio:instance-label=<A or B>`).
3. With the two CFN stacks present, manually-created `NumioServiceUser` and `NumioCurReaderRole` (Advanced setup) added to the same account do not collide with CFN-managed resources. CFN stacks remain in healthy state after the manual resources are added.
4. Both CFN-onboarded accounts connected in Numio (in two separate Numio instances if needed): `POST /api/v1/accounts/{id}/validate` returns success for each, and a triggered `cur_ingestion` job populates `cost_records` for each.
5. Verification evidence captured in the `## Summary` section: stack ARNs, IAM resource names, validation responses, and `cost_records` row counts per account.

## Quality gates

- Manual end-to-end run completed against `123456789012`; outcome of each acceptance criterion recorded in the Summary.
- No regression in the existing automated suites: `cd backend && VIRTUAL_ENV=.venv uv run --active pytest tests/test_onboarding_cfn.py` and `cd frontend && npm test` still green at verification time.

## Constraints and assumptions

- AWS test account `123456789012` is the documented Numio test account (see `reference_aws_test_accounts` memory). No production accounts are touched.
- Verification is a one-shot manual exercise. If repeat coverage is desired later, it belongs in a dedicated automated e2e harness, not in this task.
- The CFN template, label validation, and wizard behaviour are treated as fixed inputs. Defects discovered during verification are filed separately and re-tested only after they close.
