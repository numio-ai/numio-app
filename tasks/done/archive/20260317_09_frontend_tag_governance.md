---
status: done
phase: 3
task_id: P3.4
---

# Frontend: Tag Governance Dashboard, Policy Editor, and Campaign Management

## Prerequisites

- **P3.1 — Tag policy engine & compliance audit:** Provides all backend APIs consumed by this page: tag policy CRUD, policy preview (dry-run), compliance summary, compliance by dimension, non-compliant resource list, compliance trend data.
- **P3.2 — Tag remediation campaigns:** Provides campaign CRUD, per-resource status tracking, CLI command generation, and campaign progress APIs.

## Problem Statement

Tag governance is Numio's key differentiator and must be a prominent, first-class experience in the UI — not buried in settings. Customers need to see their tagging compliance at a glance, define and edit tag policies visually, and manage remediation campaigns to drive compliance improvement.

## Scope

**In scope:**
- **Tag governance dashboard** — a top-level page at `/tag-governance`, accessible from primary navigation. Supports incoming URL query parameters for pre-filtering (e.g., `?filter=missing-tag&tag=team`) so other pages (P3.6 Cloud Usage) can deep-link to a filtered view. Shows:
  - Overall cost-weighted compliance percentage
  - Compliance breakdown by tag (which tags have the worst compliance)
  - Compliance breakdown by account
  - Compliance trend chart over time
  - Top non-compliant resources ranked by cost impact
  - Active remediation campaigns with progress indicators
- **Tag policy editor:**
  - Create and edit tag policies
  - Visual editor for applicability rules (which resource types, which accounts/environments)
  - Preview which resources would be affected by a policy before activating it, using P3.1's dry-run endpoint (`POST /api/v1/tag-policies/preview`). The editor sends the current policy definition and displays the returned resource list and simulated compliance summary.
- **Campaign management:**
  - Create campaigns from sets of non-compliant resources
  - View campaign progress (resources fixed / pending / escalated)
  - Per-resource status view within a campaign
  - Copy AWS CLI remediation commands for individual resources

**Out of scope:**
- Backend tag policy engine (P3.1)
- Backend remediation campaign logic (P3.2)
- Automated email/notification to resource owners (Phase 8)
- Direct tag writing from the UI (MVP outputs CLI commands)

## Acceptance Criteria

1. Tag governance dashboard is accessible from primary navigation as a top-level page
2. Dashboard shows cost-weighted compliance % prominently
3. Compliance trend chart shows improvement over time after tags are applied
4. Non-compliant resources are ranked by cost impact (most expensive violations first)
5. Tag policy editor allows creating a policy with required tags, value types, and applicability rules
6. Editing an existing policy updates its rules and the dashboard reflects the changes after the next audit run
7. Policy preview shows which resources would be affected before activation, using the dry-run API endpoint
8. User can create a campaign by selecting non-compliant resources from the dashboard, and the new campaign appears in the active campaigns list
9. Campaign view shows per-resource remediation status and allows copying CLI commands
10. All data comes from the backend API (no mock data in production)
11. Pages handle loading, empty, and error states gracefully (e.g., no policies defined yet, no audit run yet, API errors)

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
