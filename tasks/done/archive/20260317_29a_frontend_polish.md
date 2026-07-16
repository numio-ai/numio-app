---
status: done
phase: 10
task_id: P10.1a
---

# Frontend Polish

## Prerequisites

- All frontend tasks from Phases 3–9 must be complete.
- Parent task: P10.1

## Problem Statement

After all features are functional, the frontend needs a polish pass: removing mock data, ensuring consistent loading/error states, responsive design, and clear cost data labeling.

## Scope

**In scope:**
- **Remove mock data:** All pages serve real data from the API. Mock data modules are removed or isolated behind a dev-only flag that is never active in production builds.
- **Loading and error states:** All pages handle loading, empty, and error states gracefully. Retry mechanisms for failed API calls.
- **Skeleton loaders:** Required for the Overview dashboard, Findings feed, and Recommendations page — the three most common landing pages. Other pages use a generic loading spinner.
- **Responsive design:** UI works on desktop (primary) and tablet viewports. Mobile is not required for MVP.
- **Lazy loading:** Route-level code splitting so that each page's JavaScript is loaded on demand.
- **Cost data labeling:** UI clearly distinguishes estimated vs exact costs. Data sourced from Cost Explorer is labeled as "estimated." Data from CUR is labeled as "actual."

**Out of scope:**
- Frontend testing (P10.1b)
- Backend performance or security (P10.1c)
- New feature development
- Mobile-specific optimizations

## Acceptance Criteria

1. Zero pages rely on mock data in production build
2. Overview dashboard, Findings feed, and Recommendations page display skeleton loaders during initial load
3. All other pages display a generic loading spinner during load
4. All pages display graceful error messages on API failure with retry option
5. UI renders correctly on desktop and tablet viewports
6. Cost data from Cost Explorer is labeled "estimated"; CUR data is labeled "actual"
7. Route-level lazy loading is implemented (verified via network tab showing chunked JS loads)

## Quality Gates

- `cd frontend && npm run build` produces a production build with no warnings
- Manual review of all pages confirms no mock data in production build
