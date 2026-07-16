---
status: done
phase: 10
task_id: P10.1b
---

# Frontend Testing

## Prerequisites

- All frontend tasks from Phases 3–9 must be complete.
- Parent task: P10.1

## Problem Statement

The frontend has no testing framework. Before production deployment, critical UI components and utility functions need automated test coverage to catch regressions.

## Scope

**In scope:**
- Add testing framework (Vitest or equivalent)
- Unit tests for utility functions (date formatting, cost formatting, dimension mapping, URL construction)
- Component tests for critical UI components: overview dashboard widgets, findings feed, budget status indicators, recommendation cards, notification bell
- Test coverage report generation

**Out of scope:**
- Automated E2E / integration testing (manual testing is sufficient for MVP)
- Visual regression testing
- Performance testing (covered by P10.1c backend hardening)

## Acceptance Criteria

1. Vitest (or equivalent) is configured and runs via `npm test`
2. Unit tests cover utility functions used across the application
3. Component tests cover the overview dashboard, findings feed, and budget status components
4. Test suite passes in CI

## Quality Gates

- `cd frontend && npm test` passes all tests
- `cd frontend && npm run build` succeeds
