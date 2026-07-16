---
status: done
phase: 8
task_id: P8.2
---

# Frontend: Notifications and Audit Log

## Prerequisites

- **P8.1 — Notification engine & audit trail:** Provides notification API (list, mark read, unread count, SSE delivery) and audit trail API (list events with filtering).

## Problem Statement

Customers need to see notifications in real-time within the app and review a complete audit trail of all significant actions taken in the system.

## Scope

**In scope:**
- **Notification UI:**
  - Notification bell icon in the header with unread count badge
  - Dropdown or slide-out panel showing recent notifications
  - Each notification shows: event type icon, title, summary, timestamp, and read/unread status
  - Click on a notification navigates to the relevant detail page. The frontend maps `entity_type` + `entity_id` from the notification payload (P8.1) to route paths (e.g., budget_alert → `/budgets/{id}`, anomaly → `/findings/{id}`).
  - Mark individual notifications as read
  - Mark all as read action
  - Real-time updates via SSE: new notifications appear without page refresh.
- **Audit log page:**
  - Searchable, filterable list of audit events
  - Filters: user, event type, date range, affected entity type
  - Each entry shows: timestamp, user, action, affected entity, and summary of changes
  - Expandable detail view showing before/after values for modifications
- **Component reuse:** The audit log component built here is reused in P9.3 (Settings page, Audit Logs tab). Design the component for embedding in both standalone and tabbed layouts.
- All data sourced from backend APIs (P8.1)

**Out of scope:**
- Backend notification engine and audit trail (P8.1)
- Notification settings/preferences UI (included in Settings page, P9.3)
- External notification channels

## Acceptance Criteria

1. Notification bell shows accurate unread count
2. Notification dropdown shows recent notifications with correct type and timestamp
3. Clicking a notification navigates to the relevant detail page
4. New notifications appear without page refresh
5. Audit log is filterable by user, event type, and date range
6. Audit log entries show before/after context for modification events
7. All pages handle loading, empty, and error states gracefully

## Quality Gates

- Pages render correctly with data from backend API
- Frontend builds without errors: `cd frontend && npm run build`
