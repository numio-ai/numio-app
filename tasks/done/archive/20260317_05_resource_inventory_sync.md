---
status: done
phase: 2
task_id: P2.5
---

# Resource Inventory Sync

## Problem Statement

Numio needs a complete inventory of cloud resources across all registered AWS accounts to support tag governance, zombie detection, idle resource identification, and resource-level cost attribution. Without resource metadata, Numio cannot evaluate tagging compliance, detect orphaned resources, or link costs to specific infrastructure.

## Scope

**In scope:**
- Pull resource metadata from AWS service APIs for each registered account
- Resource types to discover (minimum): EC2 instances, RDS instances, S3 buckets, EBS volumes, Elastic IPs, Lambda functions
- For each resource, store: resource ID, resource type, AWS service, account ID, region, state (running/stopped/etc.), creation date, tags (all key-value pairs), and any available cost association
- Integrate with the background worker framework (P2.2) as a scheduled daily job
- Accounts are synced independently — one account's failure does not block others
- Sync is idempotent: re-running updates existing records rather than creating duplicates
- Track resources that disappear between syncs (resource was present in previous sync but not in current one) — mark as terminated/deleted rather than removing the record
- Ingestion status tracking per account: last sync time, success/failure, resource count by type

**Out of scope:**
- CloudWatch metrics collection (Phase 4, idle detection)
- Tag compliance evaluation (Phase 3)
- Resource cost calculation (costs come from CUR/Cost Explorer data; this task collects metadata only)
- Frontend resource inventory page (Phase 4)
- Real-time resource change detection (daily sync is sufficient for MVP)

## Acceptance Criteria

1. Resource inventory sync discovers and stores resources from at least 6 AWS service types (EC2, RDS, S3, EBS, EIP, Lambda) across multiple accounts
2. Each resource record includes all tags present on the resource
3. Resources that no longer exist in AWS are marked as terminated, not deleted from the database
4. Re-running sync for the same account updates existing records without creating duplicates
5. One account failing sync logs the error and does not block other accounts
6. Ingestion status API shows per-account resource count by type and last sync time

## Quality Gates

- Integration tests verify resource discovery and storage
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
