---
status: done
kind: task
---

# T6: IAM Setup Guide

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)
Depends on: T1

## Problem

There is no actionable guide for customers to create the IAM role in their AWS account. The user guide says "allow Numio to assume the role" without providing the principal ARN, ExternalId, or step-by-step instructions. Customers cannot self-serve.

## Goals

1. Create a single-page IAM Setup Guide accessible from the Integrations page.
2. The guide dynamically fetches workspace info (`GET /workspace/info`) and renders the trust policy JSON with the actual Numio principal ARN and ExternalId.
3. Content covers all 5 steps from the spec §5.1: create role, trust policy, permissions policy, locate CUR S3 details, ensure CUR is configured.
4. The guide is linked from the Integrations page header (per R3.1).

## Non-goals

- CloudFormation template (P2, deferred)
- Integrations page form changes (that's T5)
- Making the guide available outside the authenticated app (public docs)

## Constraints & Assumptions

- `GET /api/v1/workspace/info` is available (T1).
- If the principal ARN is unavailable (no AWS credentials), the guide should show a placeholder with an explanation ("Configure AWS credentials for your Numio instance to see the principal ARN here").
- The permissions listed must match what the validation service (T2) actually checks.
- Implementation can be a React component, a dedicated route, or an expandable section on the Integrations page — developer's choice based on content length.

## Acceptance Criteria

1. Guide is reachable from the Integrations page via a visible link or button.
2. Trust policy JSON includes the actual Numio principal ARN and ExternalId (not placeholders).
3. Permissions policy JSON lists: `cur:DescribeReportDefinitions`, `s3:GetObject`, `s3:ListBucket`.
4. Step-by-step numbered instructions for AWS Console role creation.
5. Section explaining where to find CUR S3 bucket, prefix, and report name in AWS Billing.
6. Note for AWS Organizations: management account CUR covers all member accounts.
7. If principal ARN is unavailable, a helpful message is shown instead of blank/error.

## Validation Steps

1. Navigate to Integrations page. Click the IAM Setup Guide link. Guide renders.
2. Trust policy JSON contains the workspace's ExternalId (matches what the Integrations page shows).
3. Principal ARN in the trust policy matches `aws sts get-caller-identity`.
4. Permissions list matches the validation checks from T2.
5. Instructions are followable (create role in AWS Console, copy trust policy, attach permissions).

## Risks & Rollback

- Low risk. Static content with one dynamic fetch. Rollback: remove the component/route.
- If the guide's permission list diverges from the validation checks (T2), customers will get confusing validation failures. Ensure alignment during implementation.
