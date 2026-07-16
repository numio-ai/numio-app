---
status: done
phase: 6
task_id: P6.2
---

# Frontend: Recommendations and Savings Timeline Pages

## Prerequisites

- **P6.1 — Recommendations engine & savings tracking:** Provides all backend APIs for recommendations listing, lifecycle management, and savings data.

## Problem Statement

Customers need a clear interface to review, prioritize, and act on cost-saving recommendations, and to track the cumulative impact of optimizations over time.

## Scope

**In scope:**
- **Recommendations page:**
  - List of all recommendations sortable by: estimated savings, priority, category
  - Filterable by: category (right-sizing, zombie, idle), confidence level, status, dimension
  - Detail view for each recommendation: explanation of the issue, affected resources, estimated monthly savings, confidence level, and AWS CLI commands (copyable)
  - Accept and dismiss actions per recommendation
  - Mark as implemented action
- **Savings timeline page:**
  - Chart showing cumulative savings over time
  - Breakdown by recommendation category
  - Actual vs projected savings comparison
  - Total savings summary (estimated, actual)
- All data sourced from backend API (P6.1)

**Out of scope:**
- Backend recommendations engine (P6.1)
- Automated execution of commands from the UI
- Recommendation sharing or export

## Acceptance Criteria

1. Recommendations page correctly sorts by estimated savings (highest first by default)
2. Detail view shows AWS CLI commands that can be copied
3. Accepting a recommendation moves it to "accepted" state; dismissed recommendations are filtered out of the default active list but remain accessible via a 'dismissed' status filter
4. User can mark an accepted recommendation as 'implemented,' and the savings timeline reflects the implementation
5. Savings timeline chart shows cumulative savings over time with category breakdown
6. Actual vs estimated comparison is visible for implemented recommendations
7. Savings timeline shows "No savings data yet" when no recommendations have been implemented
8. All pages handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
