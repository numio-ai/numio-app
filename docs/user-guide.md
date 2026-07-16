# Numio User Guide

This guide describes how to connect AWS accounts to Numio and view cost data.

For installation and server configuration, see the [Operations Runbook](ops-runbook.md). For a one-page quick start, see the [README](../README.md).

---

## Connecting an AWS Account

Numio reads cost data from your AWS account using a read-only IAM role. Setup has two parts: AWS-side preparation (done once per account in the AWS Console) and Numio-side registration (done in the Numio UI).

### Part A: AWS-Side Preparation

These steps are performed by an AWS administrator in the AWS Console. They create three resources: a CUR export, an IAM policy, and an IAM role.

#### A1. Enable the Cost and Usage Report (CUR)

1. Open **Billing and Cost Management** > **Data exports** > **Create**.
2. Complete the form:
   - Export type: **Standard data export**
   - Export name: choose a name (e.g., `MyCostExport`)
   - Data table: **CUR 2.0**, daily granularity, Parquet format
   - S3 bucket: choose or create a bucket (e.g., `acme-cur-exports`)
   - Path prefix: choose a prefix (e.g., `daily`)
3. Click **Create**. The first report appears within 24 hours.

Record these three values — you will enter them in Numio:
- **S3 bucket name** (e.g., `acme-cur-exports`)
- **S3 prefix** — the path prefix you entered on the export form (e.g., `daily`). Enter the same value in Numio; do not append the export name or `data/` segments. Numio auto-detects both the legacy `{prefix}/metadata/…` and Data Exports v2 `{prefix}/{report_name}/metadata/…` layouts.
- **Export name** (e.g., `MyCostExport`)

#### A2. Create the IAM policy

1. Open **IAM** > **Policies** > **Create policy** > JSON editor.
2. Paste the policy below, replacing `ACME-CUR-EXPORTS` with your bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadCurBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::ACME-CUR-EXPORTS",
        "arn:aws:s3:::ACME-CUR-EXPORTS/*"
      ]
    },
    {
      "Sid": "ResourceTaggingReadOnly",
      "Effect": "Allow",
      "Action": ["tag:GetResources", "tag:GetTagKeys", "tag:GetTagValues"],
      "Resource": "*"
    }
  ]
}
```

3. Name it `NumioCurReaderPolicy`.

#### A3. Create a service user for Numio

Numio needs an IAM user with static access keys to authenticate. Create this user in the AWS account where Numio operates (this can be the same account or a separate "Numio" account).

1. Open **IAM** > **Users** > **Create user**.
2. Name it `numio-service`. Do not enable console access.
3. Attach this inline policy (replace `CUSTOMER_ACCOUNT_ID` with the target account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeCustomerCurRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::CUSTOMER_ACCOUNT_ID:role/NumioCurReaderRole"
    }
  ]
}
```

4. Go to **Security credentials** > **Create access key** > select **Third-party service** > **Create**.
5. Save the **Access Key ID** and **Secret Access Key** — you will enter them in Numio.

#### A4. Create the IAM role

1. Open **IAM** > **Roles** > **Create role** > **Custom trust policy**.
2. Paste the trust policy below, replacing the placeholders:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowNumio",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::NUMIO_ACCOUNT_ID:user/numio-service"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "UNIQUE_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

- Replace `NUMIO_ACCOUNT_ID` with the 12-digit ID of the account where `numio-service` lives.
- Replace `UNIQUE_EXTERNAL_ID` with a unique string (e.g., a UUID). Record this value — you will enter it in Numio.

3. Attach `NumioCurReaderPolicy` from step A2.
4. Name the role `NumioCurReaderRole`.

### Part B: Register the Account in Numio

1. Open Numio and navigate to **Settings** > **Integrations**.
2. Click **Add Account**.
3. Fill in the form:

| Field | Value | Source |
|-------|-------|--------|
| AWS Access Key ID | `AKIA...` | Step A3 |
| AWS Secret Access Key | (secret) | Step A3 |
| AWS Account ID | 12-digit account ID | Your AWS account |
| Role ARN | `arn:aws:iam::...:role/NumioCurReaderRole` | Step A4 |
| External ID | The UUID you chose | Step A4 |
| Display Name | Friendly name (optional) | Your choice |

4. Click **Add Account**. Numio validates the connection:
   - **Verify credentials** — confirms the access key is valid
   - **Assume role** — confirms Numio can assume the IAM role
   - If both pass, the account is created. Status shows as **incomplete** (yellow) until CUR configuration is added.

5. To add CUR configuration: click **Edit** on the account, expand the **CUR Configuration** section, and enter the S3 bucket, prefix, and report name from step A1. Click **Save & Validate**. Numio checks S3 access. If all checks pass, status changes to **connected** (green).

### Optional: enable tag writes

By default Numio is read-only. To let Numio update tags on resources (for tag remediation), enable tag writes:

- **Guided onboarding:** tick **Enable tag writes** on the Customize step. The CloudFormation stack then also creates `NumioTagWriterRole` and emits a `TagWriterRoleArn` output; paste it into the **TagWriterRoleArn** field on the Verify step.
- **Advanced flow:** create a tag-writer role yourself (same trust policy as the reader role) and paste its ARN into the **TagWriterRoleArn** field.

Numio verifies it can assume the tag-writer role and only enables writes when that check passes. This check is additive — if it fails, the account still connects for reading; tag writes simply stay disabled.

---

## Managing Accounts

### Account Status

| Status | Color | Meaning |
|--------|-------|---------|
| Connected | Green | All checks pass. Numio can read cost data. |
| Incomplete | Yellow | Credentials and role are valid, but CUR configuration is missing or S3 access failed. |
| Disconnected | Red | Credentials or role assumption failed. Check error details. |
| Inactive | Gray | Account is deactivated. No data syncing. |

### Editing an Account

Click **Edit** on any account to update its credentials, role ARN, external ID, or CUR configuration. Changes are validated on save. Credentials appear as masked values; clear and retype to change them.

### Re-validating

Click **Validate** to re-run all connection checks without changing any fields. Useful after making changes on the AWS side (e.g., updating a trust policy or rotating keys).

### Deactivating and Removing

- **Deactivate** — stops data syncing but preserves the account and its data. The account can be reactivated by editing and re-validating.
- **Remove** — permanently deletes the account and all associated data. This action cannot be undone.

---

## Viewing Cost Data

After connecting an account with CUR configuration, return to the **Overview** page. Numio displays spend breakdowns, trends, and optimization recommendations.

The scheduled CUR ingestion job runs once per day, so data may take up to 24 hours to appear on its own. To pull data immediately, trigger the job manually.

### Verify data is flowing

1. Trigger the ingestion job (admin-only; in local dev with `AUTH_ENABLED=false` no header is required):

   ```bash
   curl -fsS -X POST "http://localhost:8000/api/v1/jobs/cur_ingestion/trigger" | python3 -m json.tool
   ```

   Expect `"status": "success"` and a `job_run_id`.

2. Confirm ingestion status:

   ```bash
   curl -fsS "http://localhost:8000/api/v1/jobs/ingestion-status" | python3 -m json.tool
   ```

   Look for `"last_status": "success"`, a recent `last_sync_at`, and a non-zero `record_count`.

3. Return to the **Overview** page — **Total Spend**, **Daily Spend**, and **Top Cost Drivers** should reflect the ingested billing period.

If something looks off (zero records, stale status, or errors), see [Worker appears healthy but no data lands in the database](dev-runbook.md#worker-appears-healthy-but-no-data-lands-in-the-database) in the Developer Runbook.

---

## Further Reading

- [Operations Runbook](ops-runbook.md) — Install, configure, restart, troubleshoot
- [AWS Integration Spec](app/settings/integrations/aws-integration-spec.md) — Functionality, design, and manual test procedure for the AWS connectivity model
