---
status: done
phase: 8
task_id: P8.1
---

# Notification Engine and Audit Trail

## Prerequisites

- **P4.3 — Findings management:** Provides the findings system that generates events triggering notifications (anomalies, zombies, policy violations).
- **P5.1 — Budget management:** Provides budget alert events that trigger notifications.

## Problem Statement

Findings, alerts, and recommendations are only useful if they reach the right people at the right time. Numio needs a notification system that delivers in-app notifications and a comprehensive audit trail that logs all significant actions for accountability and compliance.

## Scope

**In scope:**
- **Notification engine:** Central service that routes alerts from various sources (budget alerts, findings, anomalies, policy violations) to users. Each notification includes an `entity_type` and `entity_id` field that the frontend (P8.2) uses to construct navigation links to the relevant detail page. MVP delivery channel: in-app notifications only.
- **Notification preferences:** Per-user preferences for which event types to receive. Global defaults with per-user overrides. Event types: budget_alert, anomaly_detected, zombie_found, policy_violation, recommendation_generated.
- **Notification API:** REST API endpoints for: list notifications (with unread filter), mark as read, mark all as read, get unread count. Real-time delivery via SSE (Server-Sent Events) for in-app notification updates. SSE is preferred over WebSocket for simplicity and alignment with the existing MCP server's SSE transport.
- **Audit trail:** Log all significant actions: account registration/removal, policy creation/modification/deletion, budget creation/modification/deletion, recommendation acceptance/dismissal/implementation, finding state changes (acknowledge, resolve, suppress), user management changes. Each entry includes: who (user), what (action), when (timestamp), and context (affected entity, before/after values where applicable). Before/after values are captured for: policy modifications, budget modifications, and workspace setting changes. Other audit events log only the action and affected entity without a before/after diff, to limit implementation cost.
- **Audit trail instrumentation:** Audit logging is implemented as a reusable decorator/middleware that captures the authenticated user, action type, affected entity, and before/after state (where applicable). The decorator is applied to existing endpoints from prior phases as part of P8.1 implementation. Existing endpoint code changes are limited to adding the decorator — no business logic modifications.
- **Action logging:** Every recommendation and action is logged with context, decision rationale, and measured outcome to support the continuous improvement loop described in the core spec.
- REST API endpoints for audit trail: list audit events with filtering by user, event type, date range, and affected entity
- All data is workspace-scoped

**Out of scope:**
- Email, Slack, PagerDuty, or other external notification channels (post-MVP)
- Notification digest or batching
- Frontend notification and audit UI (separate task P8.2)

## Acceptance Criteria

1. Budget alert notification is created within 60 seconds of a budget evaluation job detecting a threshold crossing (not from the actual moment of crossing)
2. Notification preferences correctly suppress unwanted event types per user
3. Unread notification count is accurate
4. Mark as read and mark all as read work correctly
5. Audit log captures account registration and policy change events with correct user attribution
6. Audit log entries include before/after values for policy, budget, and workspace setting modifications
7. Real-time notification delivery via SSE works (new notifications appear without page refresh on connected clients)
8. Audit trail decorator can be applied to existing endpoints without modifying their business logic

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
