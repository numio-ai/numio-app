---
status: done
kind: task
---

# T2: Validation Service Overhaul

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)
Depends on: T1

## Problem

The current validation service (`aws_service.py`) has several issues:
- Checks `ce:GetCostAndUsage` which is out of scope.
- S3 check calls `list_buckets()` (tests `s3:ListAllMyBuckets`) instead of testing read access on the actual CUR bucket.
- Does not pass ExternalId in AssumeRole.
- Does not verify the CUR report name exists.

These gaps mean validation can pass while actual CUR access fails, or fail on irrelevant permissions.

## Goals

1. Pass workspace ExternalId in all `sts:AssumeRole` calls.
2. Remove the `ce:GetCostAndUsage` permission check.
3. Replace `list_buckets()` S3 check with bucket-scoped `list_objects_v2()` and `get_object()` targeting the customer's CUR S3 bucket/prefix.
4. After `cur:DescribeReportDefinitions`, cross-check whether the user-specified report name exists in the returned list. Produce a warning if not found.
5. Return structured per-check results with human-readable failure messages and remediation hints.

## Non-goals

- Changing the accounts API behavior (that's T3)
- Frontend validation display (that's T5)
- Scheduled re-validation

## Constraints & Assumptions

- `validate_account()` must accept the ExternalId and CUR S3 location parameters (expanded signature).
- The S3 check requires `cur_s3_bucket` and `cur_s3_prefix` — these must be passed to the validation function.
- CUR API (`cur:DescribeReportDefinitions`) requires `region_name="us-east-1"` (already the case).
- The function remains synchronous (boto3 calls are blocking); the async wrapper is at the API layer.

## Acceptance Criteria

1. `validate_connectivity()` includes ExternalId in the `AssumeRole` call.
2. No `ce:GetCostAndUsage` check exists in the validation flow.
3. S3 check calls `list_objects_v2(Bucket=<bucket>, Prefix=<prefix>, MaxKeys=1)` — tests `s3:ListBucket` scoped to the CUR bucket.
4. CUR report name check: if `cur_report_name` not found in `DescribeReportDefinitions` results, the check returns a warning (not failure).
5. Each check result includes: check name, status (pass/fail/warning), human-readable detail, and remediation hint on failure.
6. `REQUIRED_PERMISSIONS` list is updated to reflect the actual checks.
7. Tests cover: AssumeRole with ExternalId, CUR describe success/failure, S3 bucket check success/failure, report name found/not-found.

## Validation Steps

1. Unit tests pass for all check functions with mocked boto3.
2. With valid AWS credentials and a test role: `validate_account()` returns all-pass results.
3. With a role missing CUR permissions: returns failure on the CUR check with remediation hint.
4. With a nonexistent S3 bucket: returns failure on the S3 check.

## Risks & Rollback

- Changes are internal to the validation service. No database changes. Rollback: revert the file.
- Risk: S3 `list_objects_v2` on an empty prefix returns no objects but succeeds — this is correct behavior (the bucket is accessible, just empty).
