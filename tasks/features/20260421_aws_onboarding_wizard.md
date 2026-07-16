---
status: backlog
slug: aws_onboarding_wizard
title: AWS onboarding wizard — per-resource create-or-reuse modes
---

# AWS onboarding wizard — per-resource create-or-reuse modes

## Problem statement

Numio's Guided CloudFormation onboarding generates one fixed-shape template that hard-codes IAM resource names (`NumioServiceUser`, `NumioCurReaderRole`). Any pre-existing resource with the same name in the target account causes stack creation to fail with `EntityAlreadyExists`.

The generator does not support reusing pre-existing IAM user, role, or access key. Customers with Terraform or manual Numio setups cannot run the Guided flow. The generator also does not support creating a new CUR export (bucket + report) — it only emits IAM resources, so the customer must set up CUR separately. Two independent Guided stacks in the same AWS account cannot coexist.

## Objective

The Configure step (renamed from Customize) of the Guided wizard lets the customer choose, per resource group, whether Numio creates fresh resources or reuses existing ones. The generator emits only the resources that need creating. Resource names are unique per stack without customer action. The Advanced setup form mirrors the Configure step's field order, labels, and control placement.

## Scope

**In scope**
- Backend generator at `backend/src/numio/onboarding/cfn_template.py`.
- Onboarding API at `backend/src/numio/api/onboarding.py`.
- Frontend Configure step in the Guided wizard.
- Frontend Advanced setup form alignment with the Configure step.
- Backend tests under `backend/tests/`.

**Out of scope**
- Chat onboarding method.
- Migration of existing account records in the database.

## Tasks

Execution order. Detailed contracts live in [aws-onboarding-spec.md](../../docs/settings/integration/aws-onboarding-spec.md).

1. Define the onboarding API contract document.
2. Refactor the onboarding generator to mode-based emit.
3. Update the onboarding API endpoint for the new payload.
4. Rebuild the Configure step UI.
5. Add the existing-only skip path in the wizard.
6. Align the Advanced setup form with the Configure step.
7. QA validation in a real AWS account.

## Acceptance criteria

A1. A customer with no pre-existing Numio resources completes the Guided flow end to end, reaching `CREATE_COMPLETE`, on a clean AWS account.

A2. A customer with pre-existing IAM resources (Terraform or manual) completes the Guided flow by selecting "Use existing" on the IAM section.

A3. Two independent Guided stacks in the same AWS account, both with "Numio creates" selected, reach `CREATE_COMPLETE` without collision.

A4. A customer with both IAM and CUR set to "Use existing" reaches Done without going through Apply, Waiting, or Verify.

A5. The wizard's Customize step is renamed to Configure on the step list and the screen heading.

A6. The Advanced setup form's field order, labels, and control placement match the Configure step.

A7. Backend tests cover all four mode combinations (IAM × CUR) and pass.

A8. Zero Guided-flow abandonments due to IAM name collisions are observed in production telemetry in the month after rollout.
