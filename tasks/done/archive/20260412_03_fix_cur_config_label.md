---
status: done
kind: bug
---

# Fix: CUR Configuration labeled "optional" but is required for connected status

Date: 2026-04-12

## Observed Problem

The "CUR Configuration" section in the Add/Edit Account dialog is labeled "(optional)" and has helper text saying "You can add this later." This is misleading — without CUR details the account stays in `incomplete` (yellow) status and Numio cannot read cost data. CUR configuration is required for a fully functional account.

## Expected vs Actual

**Expected:** The label should communicate that CUR configuration is required for the account to become fully connected, but can be provided at a later time. Something like "CUR Configuration (required for data access)" or "CUR Configuration — enter now or later to complete setup."

**Actual:** Label says "(optional)" which implies the account works without it.

## Reproduction Steps

1. Navigate to Settings > Integrations > Add Account.
2. Observe the CUR Configuration section label says "(optional)".

## Environment & Context

- File: `frontend/src/pages/Settings/Integrations.jsx`, `AccountFormDialog` component
- The collapsible section legend and helper text need rewording.

## Risks & Impact

Low risk. Label/text change only. No backend modifications needed.
