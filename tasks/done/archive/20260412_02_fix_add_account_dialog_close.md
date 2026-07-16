---
status: done
kind: bug
---

# Fix: Add Account dialog stays open after successful validation

Date: 2026-04-12

## Observed Problem

When a user fills in the "Add Account" form and clicks "Add Account", the account is created and appears in the list, but the dialog remains open. The user gets the impression that something is wrong or that fields need correction.

## Expected vs Actual

**Expected:** On successful validation (`connected` or `incomplete` status), the dialog closes automatically and the account list refreshes. The dialog should only stay open if validation failed (`disconnected`), with a visible error message explaining what needs correction.

**Actual:** The dialog stays open regardless of validation outcome. No clear visual distinction between success and failure states in the dialog.

## Reproduction Steps

1. Navigate to Settings > Integrations.
2. Click "+ Add Account".
3. Fill in valid credentials, role ARN, and external ID.
4. Click "Add Account".
5. Observe: account appears in the list below, but the dialog remains open with validation results shown.

## Environment & Context

- File: `frontend/src/pages/Settings/Integrations.jsx`, `handleAdd` function
- The current code always keeps the dialog open after submit to show validation results (by design during initial implementation).
- The fix: close dialog on success (`connected` or `incomplete`), keep open only on `disconnected` with error details visible.

## Risks & Impact

Low risk. UI-only change. No backend modifications needed.
