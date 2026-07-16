---
status: backlog
kind: bug
title: CloudFormation onboarding template fails: AWS::IAM::AccessKey not supported
---

# CloudFormation onboarding template fails: AWS::IAM::AccessKey not supported

## Observed problem

When a user downloads `numio-onboarding.yaml` from the Numio onboarding wizard and uploads it to AWS CloudFormation, the stack creation fails immediately with:

> "The following resource types are not supported for resource import: AWS::IAM::AccessKey"

No stack is created. The onboarding flow is fully blocked for new users.

## Expected vs actual

**Expected:** CloudFormation accepts the template and creates the stack (IAM role, policy, and service user) without errors.

**Actual:** CloudFormation rejects the template during the upload/create step because it contains `AWS::IAM::AccessKey`, a resource type AWS has deprecated and removed from CloudFormation support.

## Reproduction steps

1. Start the Numio onboarding wizard (Settings → Integrations → Add Account → Guided setup).
2. Reach the CloudFormation step and click **Download numio-onboarding.yaml**.
3. Open the AWS Console → CloudFormation → Create stack → With new resources.
4. Upload the downloaded YAML file.
5. Observe the error: "The following resource types are not supported for resource import: AWS::IAM::AccessKey".

## Environment & context

- File generating the template: `backend/src/numio/onboarding/cfn_template.py`, lines 111–115 (`NumioServiceUserAccessKey` resource of type `AWS::IAM::AccessKey`)
- The template outputs `AccessKeyId` and `SecretAccessKey` via CloudFormation Outputs (lines 213–224), which the onboarding UI reads back to pre-fill credentials.
- AWS deprecated `AWS::IAM::AccessKey` in CloudFormation — it can no longer be used to create or manage IAM access keys via stacks.
- Alternative: IAM access keys must now be created outside CloudFormation (via console, CLI, or SDK) and entered manually.

## Risks & impact

- **Severity: high** — blocks 100% of new users attempting guided onboarding via CloudFormation.
- The fix requires changing both the template (remove `AWS::IAM::AccessKey` and its outputs) and the onboarding UI (remove the step that reads back credentials; user enters them manually).
