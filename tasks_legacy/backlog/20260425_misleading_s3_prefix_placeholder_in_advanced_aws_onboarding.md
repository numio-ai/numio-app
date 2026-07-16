---
status: backlog
kind: bug
feature: bugfixes
title: Misleading S3 Prefix placeholder in Advanced AWS onboarding form
---

# Misleading S3 Prefix placeholder in Advanced AWS onboarding form

## Problem statement

The **S3 Prefix** field on the Advanced AWS onboarding form ([frontend/src/pages/Settings/Integrations.jsx:127](frontend/src/pages/Settings/Integrations.jsx#L127)) shows the placeholder `daily/MyCostExport/data`. This hint is wrong for the modern AWS Data Exports / CUR v2 layout (and confusing for the legacy CUR layout too):

- The Numio schema splits the CUR location across three fields: `cur_s3_bucket`, `cur_s3_prefix`, and `cur_report_name`. The backend manifest discovery in `_list_latest_manifests` then scans `{prefix}/metadata/...` (legacy) or `{prefix}/{report_name}/metadata/...` (Data Exports / v2).
- The placeholder embeds the report name and a `/data` suffix into the prefix. Following it as a literal hint produces values like `daily/MyCostExport/data`, which yields a scan path of `daily/MyCostExport/data/MyCostExport/metadata/...` — a folder that does not exist. Ingestion silently records `record_count = 0`.
- Observed on 2026-04-25 while configuring the numio-admin CUR (`s3://example-cur-bucket/cur/example-cur-export/{metadata,data}/...`): the correct values are `cur_s3_prefix = "cur"` and `cur_report_name = "example-cur-export"`. The placeholder steered me toward the wrong shape and I had to inspect the bucket layout and the discovery code to recover.

The placeholder should match the field's actual semantics: the S3 prefix above the report folder, not including the report name or a `/data` suffix. The Report Name field already has its own placeholder `MyCostExport`.

## Scope

In scope:
- `cur_s3_prefix` placeholder text in `Integrations.jsx` (Advanced and Edit dialogs share the same `curFields` definition).
- A short helper line under the CUR fieldset that names the layout assumption (e.g. "Numio scans `{prefix}/{report-name}/metadata/...`"). One sentence, no new fields, no schema change.

Out of scope:
- Changing the schema or the field split.
- Backend manifest discovery logic.
- The Guided / Chat flows (they collect the same fields differently and are tracked elsewhere).

## Acceptance criteria

1. The S3 Prefix placeholder no longer suggests including the report name or a `/data` suffix. A neutral example such as `cur` (or empty) is acceptable.
2. The helper text under the CUR fieldset (or directly under the Prefix label) states the path layout the backend expects, in one short sentence, so an operator can self-check their values without reading code.
3. The Edit dialog inherits the same placeholder and helper (no copy-paste drift).
4. Manual test: filling Advanced with `cur_s3_prefix = "cur"` and `cur_report_name = "example-cur-export"` against account 123456789012 still succeeds at validation and ingestion (regression check, since this is a copy-only change).

## Quality gates

- `npm run build` and `npm test` pass.
- Existing Integrations.jsx tests still pass.
- Visual check on the Advanced and Edit dialogs.
