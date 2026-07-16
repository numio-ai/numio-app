---
status: done
phase: 10
task_id: P10.1d
---

# Documentation

## Prerequisites

- All tasks from Phases 1–9 must be complete.
- Parent task: P10.1

## Problem Statement

Before production deployment, API documentation needs a final review for accuracy, MCP tools need documentation, and the deployment guide needs updating for production use.

## Scope

**In scope:**
- **API documentation review:** Verify auto-generated OpenAPI docs are accurate and complete for all endpoints. Fix any missing or incorrect descriptions, parameter types, or response schemas.
- **API usage guide:** Brief guide covering authentication, common query patterns, pagination, and error handling conventions.
- **MCP tool documentation:** Document each MCP tool's purpose, parameters, and example responses.
- **Deployment guide update:** Update the ops runbook (`docs/ops-runbook.md`) for production deployment: environment variables, database migrations, Cognito configuration, LMGate setup, health check URLs, and monitoring.

**Out of scope:**
- User-facing product documentation or help center
- Architecture documentation updates (handled continuously per cross-cutting concerns)
- Tutorial or onboarding content

## Acceptance Criteria

1. OpenAPI documentation is accessible at `/docs` and accurately reflects all API endpoints
2. API usage guide covers authentication, pagination, filtering, and error handling
3. Each MCP tool has documentation with parameters and example responses
4. Deployment guide covers production setup end-to-end (verified by following the guide on a clean environment)

## Quality Gates

- All documented API endpoints are reachable and return expected response schemas
- Deployment guide is reviewed by at least one person who did not write it
