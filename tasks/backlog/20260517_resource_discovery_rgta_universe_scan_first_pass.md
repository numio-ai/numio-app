---
status: backlog
kind: task
feature: aws_resource_discovery_v2
title: Resource discovery — RGTA universe scan first pass
---

# Resource discovery — RGTA universe scan first pass

# Resource discovery — RGTA universe scan first pass

## Problem statement

`resource_inventory_service.py` only sees resources via per-service `Describe*` / `List*` calls for 6 services. Anything else AWS holds — and the account has tags on — is invisible to Numio, so tag-coverage reports under-count and the Inventory page misses entire service categories. AWS Resource Groups Tagging API (`tag:GetResources`) enumerates every taggable resource in one paginated call sequence; nothing in the codebase uses it yet.

## Scope

In scope:
- New function `_discover_resources_via_rgta(boto_session, account_id, region, session, now, workspace_id)` in `resource_inventory_service.py`.
- Calls `boto_session.client("resourcegroupstaggingapi", region_name=region).get_resources()` with the standard paginator. Reads `ResourceARN` and `Tags`, derives `service` from the ARN's service portion and `resource_id` from the ARN's resource portion.
- Upserts into `cloud_resources` using the same `pg_insert` + `on_conflict_do_update` pattern as existing enrichers, keyed on `(account_id, service, resource_id)`. Sets `arn`, `tags`, `region`, `last_seen_at`; does **not** overwrite `resource_metadata` (left for per-service enrichers).
- Wired into the main per-region loop of `_run_resource_inventory_sync` ahead of the existing service-specific enrichers, so RGTA establishes universe membership before enrichers overlay metadata.
- Tests in `backend/tests/test_resource_inventory.py` covering: (a) RGTA returns N resources → N rows upserted with tags populated; (b) RGTA + an existing EC2 enricher run together → one row per `(account, ec2, i-xxx)` with both `arn` (from RGTA) and `resource_metadata.instance_type` (from EC2 enricher); (c) re-running marks unseen resources `terminated_at`; (d) RGTA `ClientError` in a region is handled the same way as other enrichers (skip with log, do not abort the run).

Out of scope:
- `Backbone` / Resource Explorer.
- ARN parsing as a library — keep it inline in the function. A standalone ARN parser is its own refactor.
- 8 new enrichers — separate task.

## Acceptance criteria

A1. After RGTA scan against a mocked region returning 5 ARNs of mixed services, `cloud_resources` has 5 rows with `tags` populated, `arn` set, `region` set, and `resource_metadata = NULL` (or empty dict — match existing convention).

A2. Running RGTA and the EC2 enricher in the same job produces one row per EC2 instance with `arn` populated from RGTA (or the enricher if it has it) and `resource_metadata.instance_type` from the enricher. The ON CONFLICT path does not duplicate.

A3. RGTA `ClientError` with `Code='AccessDenied'` in one region logs a warning and does not abort the job; the other regions continue. Asserted via mock.

A4. New tests in `test_resource_inventory.py` pass: `uv run pytest tests/test_resource_inventory.py::TestRgtaUniverse -v`.

A5. ARN parsing handles at minimum: `arn:aws:ec2:us-east-1:111122223333:instance/i-xxx`, `arn:aws:s3:::bucket-name`, `arn:aws:dynamodb:us-east-1:111122223333:table/MyTable`, `arn:aws:lambda:us-east-1:111122223333:function:my-fn`. Tests assert correct `(service, resource_id)` extraction for each.

A6. IAM onboarding doc (`docs/settings/integration/...` or the CFN template) lists `tag:GetResources` as required.

## Quality gates

- `uv run ruff check backend/src/numio/core/resource_inventory_service.py backend/tests/test_resource_inventory.py` passes.
- All existing tests in `test_resource_inventory.py` continue to pass.
- Manual trigger against a real connected test account: `curl -fsS -X POST http://localhost:8000/api/v1/jobs/resource_inventory_sync/trigger` and visually inspect `SELECT service, COUNT(*) FROM cloud_resources GROUP BY 1;` for at least one new service that wasn't visible before (e.g. DynamoDB, CloudFront if present in the test account).

## Constraints and assumptions

- Reuses `assume_role_for_account` + `_get_session` per `docs/conventions/numio-patterns.md` §5.
- Pagination via `get_paginator("get_resources")` — RGTA returns max 100 resources per page; large accounts iterate.
- ARN format: `arn:partition:service:region:account-id:resource-type/resource-id` (or `:resource-id`); both shapes parsed.
- Workspace scoping handled via `workspace_id` passed through from caller, per existing enricher signatures.
