---
status: backlog
slug: aws_resource_discovery_v2
title: AWS resource discovery v2 — universe scan + 14-service enrichment
---

# AWS resource discovery v2 — universe scan + 14-service enrichment

# AWS resource discovery v2 — universe scan + 14-service enrichment

## Problem statement

The existing `resource_inventory_sync` job (`backend/src/numio/core/resource_inventory_service.py`) discovers resources from six services (EC2, RDS, S3, EBS, EIP, Lambda) across nine hardcoded regions. Anything outside that intersection is invisible — Numio cannot recommend, tag, or report on it. The IA v2 Inventory page consequently shows a 5-row fixture (`backend/src/numio/api/ia_v2_inventory.py:48-93`) rather than real data, and tag-coverage reports under-count because resources that exist in AWS but aren't discovered get scored as "no tags" against zero.

Two specific gaps:

1. **No universe scan.** Even taggable resources outside the six service-specific enrichers (e.g. DynamoDB tables, EKS clusters, Bedrock agents, CloudFront distributions) are invisible to Numio. AWS Resource Groups Tagging API (`tag:GetResources`) returns every taggable resource in one paginated call sequence; nothing in the codebase uses it.

2. **Narrow per-service coverage.** The user-validated list of services that need first-class metadata in Numio is 14: Lambda, EC2, ECS, EKS, SageMaker, Bedrock, DynamoDB, RDS, ElastiCache (Redis/Valkey), ELB, EBS, S3, CloudFront, EIP. Existing code covers 6 of these (Lambda, EC2, EBS, EIP, S3, RDS). 8 are new.

## Objective

After the daily discovery job, `cloud_resources` contains every taggable AWS resource the assumed role can see (universe scan), and rows for the 14 first-class services carry useful `resource_metadata` fields (instance_type, engine, cluster size, etc.) populated by per-service enrichers. The IA v2 Inventory page reads from this table directly — its task (`ia_v2_persist_resources_inventory_cursor_pagination_bulk_export_jo`) is the consumer, owned by `ia_v2_persistence`.

## Scope

In scope:
- New first-pass: `resourcegroupstaggingapi.GetResources` paginated across enabled regions, upserts `cloud_resources` keyed on `(account_id, service, resource_id)` with `arn`, `region`, `tags`. Resources that the existing enrichers also see merge cleanly (enricher fills `resource_metadata`).
- 8 new service enrichers: ECS, EKS, SageMaker, Bedrock, DynamoDB, ElastiCache, ELB, CloudFront. Each follows the existing pattern in `resource_inventory_service.py` (paginator, ClientError handling per region, batch upsert).
- IAM permission expansion documented in onboarding: `tag:GetResources` + per-service `Describe*` / `List*` for the new 8.
- Regions remain the hardcoded `DEFAULT_REGIONS` list; broadening to all 30+ AWS regions is out of scope for this feature.

Out of scope:
- AWS Resource Explorer integration (newer service; RGTA is sufficient for v1).
- Multi-cloud (Azure / GCP) discovery.
- Inventory API rewrite (lives in `ia_v2_persistence` task `ia_v2_persist_resources_inventory_cursor_pagination_bulk_export_jo`).
- Bulk hibernate / stop / terminate operations (these are tag-write or future autopilot concerns).
- Per-region throttle backoff helpers — boto3 default retries + per-region serial execution are the current strategy.

## Acceptance criteria

A1. With a connected test AWS account that has at least one resource of every supported service type, `POST /api/v1/jobs/resource_inventory_sync/trigger` followed by a `SELECT service, COUNT(*) FROM cloud_resources GROUP BY 1;` returns non-zero rows for all 14 services (Lambda, EC2, ECS, EKS, SageMaker, Bedrock, DynamoDB, RDS, ElastiCache, ELB, EBS, S3, CloudFront, EIP) plus zero or more rows for other AWS service types under the catch-all universe scan.

A2. For every row in `cloud_resources` produced by the run in A1, `tags` is populated (possibly `{}` if the resource has none) and `arn` is set. The universe scan establishes the ARN; service-specific enrichers update `resource_metadata`.

A3. Per-service `resource_metadata` carries at least: ECS → service / cluster ARN; EKS → cluster status + node count; SageMaker → endpoint/notebook state; Bedrock → custom-model status; DynamoDB → table size + status; ElastiCache → engine (Redis/Valkey) + node type; ELB → load balancer type (alb/nlb/clb); CloudFront → distribution domain + price class.

A4. Re-running the job is idempotent: row count remains flat (modulo real resource churn); `last_seen_at` advances; resources that have disappeared since the previous run are marked `terminated_at`.

A5. IAM onboarding documentation lists the new permissions required and explains that the existing customer role must be extended (no separate role).

A6. `cd backend && VIRTUAL_ENV=.venv uv run --active pytest tests/test_resource_inventory.py -v` passes, including new test cases for the universe-scan first pass and each of the 8 new enrichers (mocked boto3, no real AWS).

## Tasks

In execution order. Tasks 1 and 2 are independent and parallelizable.

1. `resource_discovery_rgta_universe` — add the `_discover_resources_via_rgta` pass to `resource_inventory_service.py`; upsert to `cloud_resources`; integration tests with mocked RGTA.
2. `resource_discovery_service_enrichers` — add the 8 new enrichers (ECS, EKS, SageMaker, Bedrock, DynamoDB, ElastiCache, ELB, CloudFront), wire them into the per-region loop, extend tests. Update onboarding IAM docs.

## Linked spec

Conventions live in `docs/conventions/numio-patterns.md` §5 (AWS service pattern) and §6 (Job pattern). No separate spec file — the existing service module is the contract.
