---
status: done
phase: 4
task_id: P4.4
---

# Frontend: Feed, Anomaly Investigation, Zombie Hunter, and Resources Pages

## Prerequisites

- **P4.1 — Anomaly detection:** Provides anomaly findings with magnitude, affected dimensions, and likely cause.
- **P4.2 — Zombie hunter & idle detection:** Provides zombie/idle findings with estimated waste, cleanup actions, and CLI commands.
- **P4.3 — Findings management:** Provides the findings API for listing, filtering, acknowledging, resolving, and suppressing findings.
- **P2.5 — Resource inventory sync:** Provides the resource inventory API for the Resources page. Note: EBS snapshots and load balancers discovered by P4.2 are not in the P2.5 inventory — zombie findings may reference resources that do not appear in the Resources page. The Resources page shows inventory resources only; zombie findings for non-inventory resources are visible in the Feed and Zombie Hunter pages.

## Problem Statement

Customers need to see and act on the findings that Numio's detection systems produce. This requires a feed of all findings, detailed anomaly investigation views, a zombie resource cleanup page, and a full resource inventory.

## Scope

**In scope:**
- **Feed page:** Feed of findings, anomalies, and alerts (refreshed via polling, not real-time WebSocket). Filterable by type, severity, dimension, and account. Each item is expandable for details and suggested action. Items sorted by recency with severity indicators.
- **Anomaly investigation page:** Detail view for a specific anomaly showing: cost chart with the anomaly period highlighted, affected resources, probable cause explanation, magnitude ($ and %), and suggested remediation.
- **Zombie Hunter page:** List of detected zombie/orphaned resources grouped by type. Estimated monthly waste per resource. Suggested cleanup action with AWS CLI command (copyable). Total estimated waste summary.
- **Resources page:** Inventory of all discovered resources (from P2.5) with: tags, state, cost, account, region, and tag compliance status (from P3.1). Filterable by resource type, account, compliance status. Searchable by resource ID or name.
  - **Per-resource cost:** Shown when CUR data is available (matched by `resource_id` from `cost_records`). When only Cost Explorer data exists (no CUR), per-resource cost is shown as "N/A" since Cost Explorer provides service/account-level aggregates only, not resource-level costs.
- All pages consume data from backend APIs (findings API P4.3, resource inventory P2.5)

**Out of scope:**
- Backend detection logic and findings management (P4.1, P4.2, P4.3)
- Automated resource cleanup actions
- Real-time WebSocket updates for the feed (polling or refresh is acceptable for MVP)

## Acceptance Criteria

1. Feed page shows findings sorted by recency with correct severity indicators
2. Feed is filterable by type (anomaly, zombie, idle, policy) and severity
3. Anomaly detail page shows a cost chart with the anomaly period visually highlighted
4. Zombie Hunter page displays estimated monthly waste per resource and total waste summary
5. AWS CLI cleanup commands are copyable from the zombie hunter page
6. Resources page shows all discovered resources with their tags, state, and tag compliance status from P3.1 (compliant/non-compliant with violated policy details)
7. Resources page shows per-resource cost when CUR data is available; shows "N/A" when only Cost Explorer data exists
8. Resources page is searchable and filterable
9. All pages handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
