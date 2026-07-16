---
status: done
phase: 5
task_id: P5.3
---

# Frontend: Budgets and Policies Pages

## Prerequisites

- **P5.1 — Budget management & tracking:** Provides budget CRUD, spend tracking, projection, and alert APIs.
- **P5.2 — Infrastructure policy engine:** Provides policy CRUD, evaluation, compliance, and violation APIs.

## Problem Statement

Customers need a visual interface to create and monitor budgets, and to define and track infrastructure policy compliance. These pages provide the governance controls that make cost management proactive rather than reactive.

## Scope

**In scope:**
- **Budgets page:**
  - List all budgets with current status indicator: on track (green), at risk (yellow), exceeded (red)
  - Create/edit budget form: name, dimension selector, amount, period (monthly/quarterly), alert thresholds
  - Budget detail view: spend-vs-budget chart over the period, burn rate, projected end-of-period spend, top cost drivers, and alert history
- **Policies page:**
  - List all infrastructure policies with compliance status (% compliant)
  - Create/edit policy form: policy type selector, rule configuration, applicability (which accounts/environments)
  - Policy detail view: list of all current violations with affected resources, severity, and suggested remediation
  - Static navigation link: 'For tag compliance policies, see Tag Governance' linking to /tag-governance (P3.4). This page does not display or duplicate tag policy data.
- All data sourced from backend APIs (P5.1, P5.2)

**Out of scope:**
- Backend budget and policy engines (P5.1, P5.2)
- Budget approval workflows
- Policy-as-code editor

## Acceptance Criteria

1. Budgets page shows correct status indicators (on track / at risk / exceeded) based on current spend
2. Budget detail shows spend-vs-budget chart with projected end-of-period spend
3. Budget create/edit form validates input (amount > 0, at least one threshold, valid period)
4. Budget can be deleted from the UI
5. Policies page shows compliance percentage per policy
6. Policy detail lists all current violations with affected resources
7. Policy page shows a navigation link to tag governance for tag-related policies (does not duplicate tag policy data)
8. All pages handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
