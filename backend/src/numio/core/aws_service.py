"""AWS connectivity and permission validation service.

Implements the 4-step validation flow from the design doc:
  1. verify_credentials — STS GetCallerIdentity with provided access key + secret
  2. assume_role — STS AssumeRole into customer's read-only role
  3. s3_list — ListObjectsV2 on CUR bucket/prefix (skip if CUR not configured)
  4. s3_read — HeadObject on first CUR file (skip if no objects found)
"""

import logging

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from numio.schemas.aws_account import ValidationResult, ValidationStepResult

logger = logging.getLogger(__name__)


_CUR_DELIVERY_HINT = (
    "First CUR delivery pending — AWS delivers within ~24 hours of "
    "stack creation. Revalidate tomorrow."
)


def validate_account(
    *,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    role_arn: str,
    external_id: str,
    cur_s3_bucket: str | None = None,
    cur_s3_prefix: str | None = None,
    cur_managed_by_numio: bool = False,
    tag_writer_role_arn: str | None = None,
) -> ValidationResult:
    """Run the reader-path validation, then the optional tag-writer check.

    The reader path (steps 1–4) determines ``overall_status`` exactly as
    before. The tag-writer check is appended as an additive step 5: it never
    changes ``overall_status`` because tag writes are an optional capability
    layered on top of a working read connection. When ``tag_writer_role_arn``
    is empty the step is a skip.
    """
    reader = _validate_reader_path(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        role_arn=role_arn,
        external_id=external_id,
        cur_s3_bucket=cur_s3_bucket,
        cur_s3_prefix=cur_s3_prefix,
        cur_managed_by_numio=cur_managed_by_numio,
    )
    creds_ok = bool(reader.steps) and reader.steps[0].status == "pass"
    step5 = _tag_writer_assume_role(
        aws_access_key_id, aws_secret_access_key, tag_writer_role_arn, external_id, creds_ok
    )
    return ValidationResult(
        steps=[*reader.steps, step5], overall_status=reader.overall_status
    )


def _validate_reader_path(
    *,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    role_arn: str,
    external_id: str,
    cur_s3_bucket: str | None = None,
    cur_s3_prefix: str | None = None,
    cur_managed_by_numio: bool = False,
) -> ValidationResult:
    """Run the full 4-step validation flow for an AWS account.

    Steps execute sequentially; if a step fails, subsequent steps are skipped.
    Returns structured results for every step.

    When ``cur_managed_by_numio`` is True (the Guided "Create new" flow has
    just provisioned the CUR export), a successful list returning zero
    objects is treated as a pass-with-hint rather than an incomplete state:
    AWS Billing delivers the first manifest asynchronously up to 24 h after
    stack creation, and the wizard must not block on that delay.
    """
    steps: list[ValidationStepResult] = []
    has_cur_config = bool(cur_s3_bucket)

    # Step 1: Verify credentials
    session, step1 = _verify_credentials(aws_access_key_id, aws_secret_access_key)
    steps.append(step1)
    if step1.status == "fail":
        steps.extend(_skip_remaining(["assume_role", "s3_list", "s3_read"], has_cur_config))
        return ValidationResult(steps=steps, overall_status="disconnected")

    # Step 2: Assume role
    assumed_session, step2 = _assume_role(session, role_arn, external_id)
    steps.append(step2)
    if step2.status == "fail":
        steps.extend(_skip_remaining(["s3_list", "s3_read"], has_cur_config))
        return ValidationResult(steps=steps, overall_status="disconnected")

    # Step 3: S3 list objects (skip if no CUR config)
    if not has_cur_config:
        steps.append(ValidationStepResult(
            name="s3_list",
            label="List CUR objects in S3",
            status="skip",
            detail="CUR configuration not provided — skipped",
        ))
        steps.append(ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="skip",
            detail="CUR configuration not provided — skipped",
        ))
        return ValidationResult(steps=steps, overall_status="incomplete")

    objects, step3 = _s3_list(assumed_session, cur_s3_bucket, cur_s3_prefix or "")
    steps.append(step3)
    if step3.status == "fail":
        steps.append(ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="skip",
            detail="Skipped — S3 list failed",
        ))
        return ValidationResult(steps=steps, overall_status="incomplete")

    # Step 4: S3 head object (skip if no objects found)
    if not objects:
        # In create_new mode, treat "0 objects" as a pass-with-hint:
        # AWS Billing delivers the first CUR export asynchronously, and the
        # wizard would otherwise stay stuck in `incomplete` for ~24 h.
        # Replace the s3_list row's detail in place so the user sees the
        # hint next to the step that produced it.
        if cur_managed_by_numio:
            steps[-1] = ValidationStepResult(
                name="s3_list",
                label="List CUR objects in S3",
                status="pass",
                detail=_CUR_DELIVERY_HINT,
            )
            steps.append(ValidationStepResult(
                name="s3_read",
                label="Read CUR file from S3",
                status="skip",
                detail=_CUR_DELIVERY_HINT,
            ))
            return ValidationResult(steps=steps, overall_status="connected")

        steps.append(ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="skip",
            detail="No objects found — CUR may not have been delivered yet (up to 24h)",
        ))
        return ValidationResult(steps=steps, overall_status="incomplete")

    step4 = _s3_read(assumed_session, cur_s3_bucket, objects[0]["Key"])
    steps.append(step4)

    if step4.status == "fail":
        return ValidationResult(steps=steps, overall_status="incomplete")

    return ValidationResult(steps=steps, overall_status="connected")


# ---------------------------------------------------------------------------
# Individual validation steps
# ---------------------------------------------------------------------------


def _verify_credentials(
    access_key_id: str, secret_access_key: str
) -> tuple[boto3.Session | None, ValidationStepResult]:
    """Step 1: Create a boto3 session and verify credentials via STS GetCallerIdentity."""
    try:
        session = boto3.Session(
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        caller_arn = identity["Arn"]
        logger.info("verify_credentials: authenticated as %s", caller_arn)
        return session, ValidationStepResult(
            name="verify_credentials",
            label="Verify AWS credentials",
            status="pass",
            detail=f"Authenticated as {caller_arn}",
        )
    except (ClientError, NoCredentialsError) as e:
        error_str = _format_client_error(e)
        logger.info("verify_credentials: failed — %s", error_str)
        return None, ValidationStepResult(
            name="verify_credentials",
            label="Verify AWS credentials",
            status="fail",
            error=error_str,
            remediation=(
                "Check that the Access Key ID and Secret Access Key match "
                "an active key on the numio-service IAM user."
            ),
        )
    except Exception as e:
        logger.info("verify_credentials: unexpected error — %s", str(e))
        return None, ValidationStepResult(
            name="verify_credentials",
            label="Verify AWS credentials",
            status="fail",
            error=f"Unexpected error: {e}",
            remediation="Check AWS credentials and network connectivity.",
        )


def _assume_role(
    session: boto3.Session, role_arn: str, external_id: str
) -> tuple[boto3.Session | None, ValidationStepResult]:
    """Step 2: AssumeRole into the customer's read-only role."""
    try:
        sts = session.client("sts")
        resp = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="numio-validation",
            ExternalId=external_id,
            DurationSeconds=900,
        )
        creds = resp["Credentials"]
        assumed_session = boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
        logger.info("assume_role: assumed %s", role_arn)
        return assumed_session, ValidationStepResult(
            name="assume_role",
            label="Assume customer role",
            status="pass",
            detail=f"Assumed role {role_arn}",
        )
    except ClientError as e:
        error_str = _format_client_error(e)
        error_code = e.response["Error"]["Code"]
        logger.info("assume_role: failed for %s — %s", role_arn, error_str)

        remediation = _assume_role_remediation(error_code)
        return None, ValidationStepResult(
            name="assume_role",
            label="Assume customer role",
            status="fail",
            error=error_str,
            remediation=remediation,
        )
    except Exception as e:
        logger.info("assume_role: unexpected error for %s — %s", role_arn, str(e))
        return None, ValidationStepResult(
            name="assume_role",
            label="Assume customer role",
            status="fail",
            error=f"Unexpected error: {e}",
            remediation="Check the Role ARN and ExternalId values.",
        )


def _tag_writer_assume_role(
    access_key_id: str,
    secret_access_key: str,
    tag_writer_role_arn: str | None,
    external_id: str,
    creds_ok: bool,
) -> ValidationStepResult:
    """Step 5: AssumeRole into the optional tag-writer role.

    Skipped (not failed) when no tag-writer ARN is configured, or when
    credential verification did not pass. A failure here does not change the
    account's overall status — tag writes are additive to the read path.
    """
    name = "tag_writer_assume_role"
    label = "Assume tag-writer role"
    if not tag_writer_role_arn:
        return ValidationStepResult(
            name=name,
            label=label,
            status="skip",
            detail="Tag writes not enabled for this account",
        )
    if not creds_ok:
        return ValidationStepResult(
            name=name,
            label=label,
            status="skip",
            detail="Skipped — credential verification failed",
        )
    try:
        session = boto3.Session(
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        sts = session.client("sts")
        sts.assume_role(
            RoleArn=tag_writer_role_arn,
            RoleSessionName="numio-tagwriter-validation",
            ExternalId=external_id,
            DurationSeconds=900,
        )
        logger.info("tag_writer_assume_role: assumed %s", tag_writer_role_arn)
        return ValidationStepResult(
            name=name,
            label=label,
            status="pass",
            detail=f"Assumed tag-writer role {tag_writer_role_arn}",
        )
    except ClientError as e:
        error_str = _format_client_error(e)
        logger.info("tag_writer_assume_role: failed for %s — %s", tag_writer_role_arn, error_str)
        return ValidationStepResult(
            name=name,
            label=label,
            status="fail",
            error=error_str,
            remediation=_assume_role_remediation(e.response["Error"]["Code"]),
        )
    except Exception as e:
        logger.info("tag_writer_assume_role: unexpected error — %s", str(e))
        return ValidationStepResult(
            name=name,
            label=label,
            status="fail",
            error=f"Unexpected error: {e}",
            remediation="Check the tag-writer Role ARN and ExternalId values.",
        )


def _s3_list(
    session: boto3.Session, bucket: str, prefix: str
) -> tuple[list[dict], ValidationStepResult]:
    """Step 3: List CUR objects in S3 using assumed-role credentials."""
    try:
        s3 = session.client("s3")
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=5)
        objects = resp.get("Contents", [])
        logger.info(
            "s3_list: %d object(s) at s3://%s/%s", len(objects), bucket, prefix
        )
        return objects, ValidationStepResult(
            name="s3_list",
            label="List CUR objects in S3",
            status="pass",
            detail=f"{len(objects)} object(s) at s3://{bucket}/{prefix}",
        )
    except ClientError as e:
        error_str = _format_client_error(e)
        error_code = e.response["Error"]["Code"]
        logger.info("s3_list: failed for s3://%s/%s — %s", bucket, prefix, error_str)

        if error_code in ("AccessDenied", "403"):
            remediation = (
                f"The assumed role needs s3:ListBucket permission on bucket '{bucket}'. "
                f"Add s3:ListBucket to the NumioCurReaderPolicy."
            )
        elif error_code == "NoSuchBucket":
            remediation = (
                f"S3 bucket '{bucket}' does not exist. "
                f"Verify the bucket name matches your CUR export configuration."
            )
        else:
            remediation = "Check S3 bucket configuration and IAM permissions."

        return [], ValidationStepResult(
            name="s3_list",
            label="List CUR objects in S3",
            status="fail",
            error=error_str,
            remediation=remediation,
        )
    except Exception as e:
        logger.info("s3_list: unexpected error for s3://%s/%s — %s", bucket, prefix, str(e))
        return [], ValidationStepResult(
            name="s3_list",
            label="List CUR objects in S3",
            status="fail",
            error=f"Unexpected error: {e}",
            remediation="Check S3 bucket name and network connectivity.",
        )


def _s3_read(session: boto3.Session, bucket: str, key: str) -> ValidationStepResult:
    """Step 4: Read (head) first CUR file to verify s3:GetObject permission."""
    try:
        s3 = session.client("s3")
        head = s3.head_object(Bucket=bucket, Key=key)
        size = head["ContentLength"]
        content_type = head.get("ContentType", "unknown")
        logger.info("s3_read: %s (%d bytes, %s)", key, size, content_type)
        return ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="pass",
            detail=f"{key} ({size:,} bytes, {content_type})",
        )
    except ClientError as e:
        error_str = _format_client_error(e)
        logger.info("s3_read: failed for s3://%s/%s — %s", bucket, key, error_str)
        return ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="fail",
            error=error_str,
            remediation=(
                f"The assumed role needs s3:GetObject permission on bucket '{bucket}'. "
                f"Add s3:GetObject to the NumioCurReaderPolicy."
            ),
        )
    except Exception as e:
        logger.info("s3_read: unexpected error for s3://%s/%s — %s", bucket, key, str(e))
        return ValidationStepResult(
            name="s3_read",
            label="Read CUR file from S3",
            status="fail",
            error=f"Unexpected error: {e}",
            remediation="Check S3 permissions and network connectivity.",
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _skip_remaining(step_names: list[str], has_cur_config: bool) -> list[ValidationStepResult]:
    """Generate 'skip' results for steps that were not executed."""
    labels = {
        "assume_role": "Assume customer role",
        "s3_list": "List CUR objects in S3",
        "s3_read": "Read CUR file from S3",
    }
    results = []
    for name in step_names:
        results.append(ValidationStepResult(
            name=name,
            label=labels.get(name, name),
            status="skip",
            detail="Skipped — a previous step failed",
        ))
    return results


def _assume_role_remediation(error_code: str) -> str:
    """Return error-specific remediation text for AssumeRole failures."""
    if error_code == "AccessDenied":
        return (
            "AssumeRole was denied. Common causes: "
            "(1) the trust policy Principal does not match the service user ARN; "
            "(2) the ExternalId does not match the value in the trust policy; "
            "(3) the service user lacks sts:AssumeRole permission."
        )
    if error_code == "MalformedPolicyDocument":
        return (
            "The Role ARN appears to be malformed. "
            "Verify it matches the format arn:aws:iam::ACCOUNT:role/NAME."
        )
    return (
        f"AssumeRole failed with error code '{error_code}'. "
        "Check the Role ARN, ExternalId, and trust policy."
    )


def _format_client_error(e: ClientError | NoCredentialsError) -> str:
    """Format a boto3 error into a diagnostic string with error code and request ID."""
    if isinstance(e, NoCredentialsError):
        return "NoCredentialsError: Unable to locate credentials"
    error = e.response.get("Error", {})
    code = error.get("Code", "Unknown")
    message = error.get("Message", str(e))
    request_id = e.response.get("ResponseMetadata", {}).get("RequestId", "n/a")
    return f"{code}: {message} (RequestId: {request_id})"


# ---------------------------------------------------------------------------
# Data-pipeline helper — used by cost_explorer_service, cur_service, etc.
# ---------------------------------------------------------------------------


def _get_session(credentials: dict) -> boto3.Session:
    """Create a boto3 session from assumed-role credentials.

    Deprecated: kept for backward compatibility with data-pipeline callers.
    """
    return boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )


def validate_connectivity(
    role_arn: str, external_id: str | None = None
) -> tuple[bool, str | None, dict | None]:
    """Assume the given IAM role using the default credential chain.

    Deprecated: data-pipeline callers still use this. New code should use
    assume_role_for_account() which takes per-account credentials.
    """
    try:
        sts_client = boto3.client("sts")
        assume_kwargs: dict = {
            "RoleArn": role_arn,
            "RoleSessionName": "numio-connectivity-check",
            "DurationSeconds": 900,
        }
        if external_id:
            assume_kwargs["ExternalId"] = external_id
        response = sts_client.assume_role(**assume_kwargs)
        credentials = response["Credentials"]
        return (
            True,
            None,
            {
                "AccessKeyId": credentials["AccessKeyId"],
                "SecretAccessKey": credentials["SecretAccessKey"],
                "SessionToken": credentials["SessionToken"],
            },
        )
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_msg = e.response["Error"]["Message"]
        logger.warning(
            "STS assume-role failed for %s: %s - %s",
            role_arn,
            error_code,
            error_msg,
        )
        return (
            False,
            f"AssumeRole failed: {error_code} - {error_msg}",
            None,
        )
    except Exception as e:
        logger.exception(
            "Unexpected error during STS assume-role for %s", role_arn
        )
        return False, f"Unexpected error: {str(e)}", None


def assume_role_for_account(
    account,
    *,
    role_arn: str | None = None,
    session_name: str = "numio-data-pipeline",
) -> tuple[bool, str | None, dict | None]:
    """Assume an IAM role for a given AwsAccount record.

    Uses the account's stored credentials to create a session, then assumes
    the target role. Defaults to the account's reader ``role_arn``; pass
    ``role_arn`` to assume a different role (e.g. the tag-writer role). Returns
    the same tuple shape as the old validate_connectivity().

    Returns:
        (True, None, credentials_dict) on success.
        (False, error_message, None) on failure.
    """
    target_role_arn = role_arn or account.role_arn
    try:
        session = boto3.Session(
            aws_access_key_id=account.aws_access_key_id,
            aws_secret_access_key=account.aws_secret_access_key,
        )
        sts = session.client("sts")
        kwargs: dict = {
            "RoleArn": target_role_arn,
            "RoleSessionName": session_name,
            "DurationSeconds": 900,
        }
        if account.external_id:
            kwargs["ExternalId"] = account.external_id
        resp = sts.assume_role(**kwargs)
        creds = resp["Credentials"]
        return (
            True,
            None,
            {
                "AccessKeyId": creds["AccessKeyId"],
                "SecretAccessKey": creds["SecretAccessKey"],
                "SessionToken": creds["SessionToken"],
            },
        )
    except (ClientError, NoCredentialsError) as e:
        error_str = _format_client_error(e)
        logger.warning(
            "assume_role_for_account failed for %s: %s",
            target_role_arn,
            error_str,
        )
        return False, error_str, None
    except Exception as e:
        logger.exception(
            "Unexpected error assuming role for %s", target_role_arn
        )
        return False, f"Unexpected error: {e}", None
