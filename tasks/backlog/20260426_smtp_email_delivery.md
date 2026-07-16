---
status: backlog
kind: task
feature: user_management_extensions
title: SMTP email delivery for invitations and resets
---

# SMTP email delivery for invitations and resets

## Problem statement

Phase 1 hands setup links to admins who paste them manually. Larger customers want emailed invitations and password resets.

## Scope

In scope:
- SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`).
- Send-email helper.
- Opt-in "send via email" option in the create-user and regenerate-link flows.

Out of scope:
- Templating service / rich HTML emails (start with plain text + the URL).

## Acceptance criteria

- Admin can choose "send via email" when creating a user or regenerating a link.
- A working SMTP config delivers the link to the recipient.
- SMTP failure surfaces a clear error and does NOT block the manual-copy path.

## Quality gates

- Integration test against a mock SMTP server (e.g. mailpit).
- Manual smoke against a real SMTP provider (documented).
