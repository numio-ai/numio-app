---
status: backlog
kind: bug
feature: bugfix_setup_wizard
title: Verify step shows generic error instead of specific failure details during AWS onboarding
draft: true
---

# Verify step shows generic error instead of specific failure details during AWS onboarding

## Problem statement

During the AWS account onboarding flow (Integrations → Connect AWS accounts → CloudFormation outputs form → Verify step), the app displays:

> An unexpected error occurred

This generic message gives the user no information about what actually failed. The backend and/or AWS likely return a specific error (e.g., AssumeRole failure, wrong ExternalId, missing CUR config), but it is swallowed and never surfaced in the UI.

**Expected:** The Verify step displays the specific error message returned by the backend — e.g., "STS AssumeRole failed: access denied", "ExternalId mismatch", or "CUR bucket not found".

**Actual:** The Verify step displays "An unexpected error occurred" regardless of the underlying cause.

**Reproduction steps:**
1. Navigate to Settings → Integrations.
2. Click "Connect your AWS accounts so Numio can read cost data from CUR exports in S3".
3. Complete the CloudFormation step and submit the form with the CloudFormation outputs (AwsAccountId, RoleArn, AccessKeyId, SecretAccessKey, ExternalId).
4. Proceed to the Verify step.
5. Observe: generic error message with no details.

**Environment:** Local dev, bypass auth mode.

## Scope

**In scope:**
- Surface the specific error message from the backend API response in the Verify step UI.
- Ensure any error returned from the account validation endpoint is displayed to the user in a human-readable form.

**Out of scope:**
- Changing backend validation logic or the errors it produces.
- Changing the CloudFormation template or onboarding flow steps.

## Acceptance criteria

- AC1: When account verification fails, the Verify step displays the specific error message returned by the backend API (not a generic fallback).
- AC2: When the error is an AWS-level failure (e.g., AssumeRole, ExternalId mismatch, S3 access denied), that error text is visible to the user.
- AC3: When verification succeeds, behaviour is unchanged.

## Quality gates

- Reproduce the error locally, confirm the specific message now appears.
- Manually test a successful verification path to confirm no regression.
- `cd frontend && npm run build` passes without errors.
