---
status: done
phase: 10
task_id: P10.1c
---

# Backend Hardening and Observability

## Prerequisites

- All backend tasks from Phases 1–9 must be complete.
- Parent task: P10.1

## Problem Statement

The backend needs a production-readiness pass: verifying security controls that should already be in place, adding rate limiting, configuring CORS, ensuring observability, and validating API performance.

## Scope

**In scope:**
- **Security verification:** Verify that input validation, CORS, and SQL injection prevention are correctly implemented across all endpoints. Fix any gaps found. This is a verification pass, not first implementation — these controls should already be present from earlier phases.
  - Input validation on all API endpoints (Pydantic schemas enforce this via FastAPI)
  - CORS configuration restricted to the production domain
  - SQL injection prevention verified (SQLAlchemy parameterized queries — spot-check, not rewrite)
  - XSS prevention verified by: (1) code review confirms no use of `dangerouslySetInnerHTML` without DOMPurify sanitization, and (2) manual testing of all user-input fields with XSS payloads
- **Rate limiting:** Rate limiting applies per-API-key (or per-session for web UI). Default: 100 requests/minute for read endpoints, 20 requests/minute for write endpoints. Configurable via environment variables.
- **Performance verification:** All API list endpoints support pagination and return under 500ms for typical data volumes. Typical = up to 10 AWS accounts, 5,000 resources, 12 months of daily cost records.
  - **Page load time:** Largest Contentful Paint (LCP) under 3 seconds on a desktop browser with a simulated "Fast 3G" network profile (Chrome DevTools). Measured on the Overview dashboard with typical data.
- **Observability:** Application metrics (request latency, error rates, job durations). Health check endpoints for all services (API, worker). Structured logs for debugging.
- **Pagination audit:** Verify all list endpoints across the application support pagination. Fix any that don't.

**Out of scope:**
- New feature development
- Performance optimization beyond the stated thresholds
- Automated penetration testing

## Acceptance Criteria

1. All API list endpoints support pagination and return under 500ms for typical data volumes
2. Rate limiting is applied per-API-key/session with configurable thresholds
3. CORS is configured for the production domain only
4. No XSS vulnerabilities found via code review and manual testing
5. SQL injection prevention verified via ORM parameterized queries (spot-check across endpoints)
6. Health check endpoints return accurate status for API and worker services
7. Structured logs include correlation IDs for request tracing
8. LCP under 3 seconds on Overview dashboard with Fast 3G simulation

## Quality Gates

- `cd backend && uv run pytest` passes all tests
- `cd backend && uv run ruff check .` passes
- Manual security review checklist completed
