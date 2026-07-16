---
status: done
phase: 4
task_id: P4.2
---

# Zombie Hunter and Idle Resource Detection

## Prerequisites

- **P2.5 — Resource inventory sync:** Provides the resource inventory for EC2 instances, EBS volumes, Elastic IPs, and Lambda functions. The zombie hunter uses this data for resource types that are in the inventory.
- **P2.2 — Background worker framework:** Provides the job scheduling infrastructure for running zombie/idle detection as a recurring job.
- **P2.1 — AWS account registration:** Provides the IAM role ARNs used to assume-role into customer accounts for AWS API calls.
- **P4.3 — Findings management:** Provides the findings system where detected zombies/idle resources are created as findings. P4.3 owns deduplication — this task simply creates findings and P4.3 handles upsert logic.

**Note:** EBS snapshots and Elastic Load Balancers are not in the P2.5 resource inventory. This task performs its own AWS API discovery for these resource types during the zombie detection job (see scope below).

## Problem Statement

Organizations accumulate abandoned infrastructure over time — orphaned volumes, unused IPs, forgotten dev instances — that collectively waste thousands of dollars monthly. No single resource is large enough to notice individually. Numio needs to automatically identify these orphaned and idle resources, estimate their waste, and surface them for cleanup.

## Scope

**In scope:**
- **Zombie Hunter — orphaned resource detection:**
  - Unattached EBS volumes (not attached to any instance) — sourced from P2.5 resource inventory
  - Unused Elastic IPs (allocated but not associated) — sourced from P2.5 resource inventory
  - Stopped EC2 instances running longer than a configurable threshold (default: 7 days) — sourced from P2.5 resource inventory
  - EBS snapshots older than a configurable threshold (default: 90 days) — **discovered via direct AWS API call** (`ec2:DescribeSnapshots`) during the zombie job, since snapshots are not in the P2.5 resource inventory
  - Load balancers with no registered targets — **discovered via direct AWS API call** (`elasticloadbalancing:DescribeLoadBalancers`, `DescribeTargetGroups`) during the zombie job, since LBs are not in the P2.5 resource inventory
- **Idle resource detection (informational only in MVP):**
  - Pull CloudWatch metrics for compute resources: CPU utilization, network I/O, disk I/O. Requires `cloudwatch:GetMetricData` permission on the assumed IAM role. If the role lacks this permission, idle detection for that account is skipped with a logged warning — not a job failure.
  - Identify resources where utilization metrics are consistently below configurable thresholds over a configurable time window. Defaults: CPU < 5%, network I/O < 1 MB/day, evaluated over 7 days. All thresholds are configurable.
  - Report as informational findings (severity=`info`) — no automated action
- **Waste estimation methodology:** Each finding includes an estimated monthly waste in dollars, calculated as follows:
  - Stopped EC2 instances: on-demand hourly rate for the instance type × 730 hours/month (from AWS pricing or cost records)
  - Unattached EBS volumes: provisioned storage GB × per-GB monthly rate for the volume type
  - Unused Elastic IPs: fixed AWS charge (~$3.60/month per unused EIP)
  - Old EBS snapshots: snapshot size in GB × per-GB monthly storage rate
  - Empty load balancers: fixed hourly LB charge × 730 hours/month
  - Idle instances: full on-demand instance cost (since the instance is running)
  - If pricing data is unavailable for a resource, estimated waste is set to `null` with a note that cost could not be estimated
- **Threshold configuration:** All thresholds (stopped instance age, snapshot age, idle CPU/network, idle window) are persisted in the database with sensible defaults and managed via REST API. Endpoints: get thresholds (returns current overrides + defaults), set threshold.
- All detected issues are created as findings in P4.3 (type=`zombie` or `idle`). This task calls P4.3's create-finding API; P4.3 handles deduplication internally.
- Each finding includes: resource ID, resource type, account, estimated waste, and a suggested cleanup action (descriptive text + AWS CLI command)
- Runs as a scheduled background job (integrates with worker framework, P2.2)

**Out of scope:**
- Automated resource cleanup (MVP is detect and recommend only)
- Right-sizing recommendations (Phase 6)
- Resource types beyond those listed above
- Frontend zombie hunter page (separate task P4.4)

## Acceptance Criteria

1. Zombie Hunter detects at least 5 types of orphaned resources (unattached EBS, unused EIP, stopped instances, old snapshots, empty LBs)
2. EBS snapshots and load balancers are discovered via direct AWS API calls during the zombie job (not dependent on P2.5 inventory)
3. Idle resource detection identifies compute instances with consistently low utilization using CloudWatch metrics
4. If CloudWatch permissions are missing for an account, idle detection is skipped for that account with a warning (not a job failure)
5. Each finding includes estimated monthly waste in dollars using the specified methodology per resource type
6. Each finding includes a suggested cleanup action with an AWS CLI command
7. Thresholds (stopped instance age, snapshot age, idle CPU/network thresholds, idle window) are configurable via REST API with sensible defaults
8. Detection runs as a scheduled job and creates findings via P4.3 — deduplication is handled by P4.3

## Quality Gates

- Tests verify detection logic for each resource type
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
