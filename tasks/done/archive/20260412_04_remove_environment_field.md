---
status: done
kind: bug
---

# Remove Environment field from Add/Edit Account dialog

Date: 2026-04-12

## Observed Problem

The Add/Edit Account dialog includes an "Environment" dropdown (production/staging/development) that is not needed for AWS account connectivity. It adds unnecessary complexity to the form without providing value at this stage.

## Expected vs Actual

**Expected:** The Environment field should not appear in the Add/Edit Account dialog.

**Actual:** The Environment field is present as a dropdown with production/staging/development options.

## Reproduction Steps

1. Navigate to Settings > Integrations > Add Account.
2. Observe the "Environment" dropdown in the Account Details section.

## Environment & Context

- Frontend: `frontend/src/pages/Settings/Integrations.jsx` — remove `environment_label` from `accountFields` array and `EMPTY_FORM`
- Backend: the `environment_label` column and schema field can remain (backward compatible). The field just won't be shown in the UI. The default value ("production") will be used.

## Risks & Impact

Low risk. UI-only removal. Backend field remains with its default value.
