"""Sync the effective AWS Organizations tag policy for the management account.

Two entry points:
  - ``sync(session, workspace_id)`` — on-demand: iterates connected accounts,
    finds the Org management account (spec §6.4), and syncs its effective tag
    policy. Used by ``POST /aws-org-tag-policy/sync``.
  - ``sync_for_account(session, workspace_id, aws_account_id)`` — per-account:
    the daily worker job fans out across connected accounts; each invocation
    syncs only when its account is the management account. This avoids N×
    redundant detection while reusing the worker's per-account isolation.

Org API permissions (`organizations:DescribeOrganization`,
`DescribeEffectivePolicy`, `ListPolicies`) live on the NumioTagWriterRole inline
policy (spec §6.1), so org calls assume ``tag_writer_role_arn``; accounts
without it are not eligible for Org sync.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.aws_service import assume_role_for_account
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.aws_org_tag_policy_repository import AwsOrgTagPolicyRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.aws_account import AwsAccount
from numio.schemas.aws_org_tag_policy import ConflictDescriptor

logger = logging.getLogger(__name__)

# Organizations is reachable from its home region; the API is global but boto3
# wants a region.
ORG_REGION = "us-east-1"

# Account states that make an account eligible for Org detection, mirroring the
# job runner's eligibility set.
_ELIGIBLE_STATUSES = ("connected", "incomplete")


@dataclass
class ParsedOrgRule:
    tag_key: str
    required: bool
    allowed_values: list[str] | None
    case_sensitive: bool
    raw: dict


@dataclass
class AccountSyncOutcome:
    # synced | not_management | not_in_use | not_eligible | error
    status: str
    rows_upserted: int = 0
    management_account_id: str | None = None
    error: str | None = None


def _err(e: ClientError) -> str:
    error = e.response.get("Error", {})
    return f"{error.get('Code', 'Unknown')}: {error.get('Message', str(e))}"


def _assign(node):
    """Unwrap an AWS tag-policy node: ``{"@@assign": X}`` -> ``X``, else the node."""
    if isinstance(node, dict) and "@@assign" in node:
        return node["@@assign"]
    return node


def _parse_effective_policy(content: str) -> list[ParsedOrgRule]:
    """Parse a ``DescribeEffectivePolicy`` PolicyContent JSON string.

    Unknown keys (``@@operators_allowed_for_child_policies`` etc.) are not
    normalized but are preserved verbatim in each rule's ``raw`` fragment so a
    later version can use them without re-fetching (spec §13).
    """
    try:
        doc = json.loads(content)
    except (TypeError, ValueError) as e:
        logger.warning("Could not parse AWS Org tag policy content: %s", e)
        return []

    tags = doc.get("tags") if isinstance(doc, dict) else None
    if not isinstance(tags, dict):
        return []

    rules: list[ParsedOrgRule] = []
    for outer_key, fragment in tags.items():
        if not isinstance(fragment, dict):
            continue
        tag_key = _assign(fragment.get("tag_key")) or outer_key
        if not isinstance(tag_key, str):
            tag_key = str(tag_key)

        allowed = _assign(fragment.get("tag_value"))
        if allowed is not None and not isinstance(allowed, list):
            allowed = [allowed]

        enforced = _assign(fragment.get("enforced_for"))

        rules.append(
            ParsedOrgRule(
                tag_key=tag_key,
                required=bool(enforced),
                allowed_values=[str(v) for v in allowed] if allowed else None,
                case_sensitive=True,
                raw=fragment,
            )
        )
    return rules


def _org_client(account: AwsAccount):
    """Assume the account's tag-writer role and return an organizations client.

    Returns ``(client, None)`` on success or ``(None, error_message)``.
    """
    if not account.tag_writer_role_arn:
        return None, "no tag-writer role (organizations permissions unavailable)"
    ok, err, creds = assume_role_for_account(
        account, role_arn=account.tag_writer_role_arn, session_name="numio-org-sync"
    )
    if not ok:
        return None, err
    client = boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    ).client("organizations", region_name=ORG_REGION)
    return client, None


async def _sync_from_account(
    session: AsyncSession, workspace_id: str, account: AwsAccount
) -> AccountSyncOutcome:
    """Detect whether ``account`` is the Org management account and, if so, sync."""
    if not account.tag_writer_role_arn:
        return AccountSyncOutcome(status="not_eligible")

    client, err = _org_client(account)
    if client is None:
        return AccountSyncOutcome(status="error", error=err)

    try:
        org = client.describe_organization()["Organization"]
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "AWSOrganizationsNotInUseException":
            return AccountSyncOutcome(status="not_in_use")
        return AccountSyncOutcome(status="error", error=_err(e))

    master_id = org.get("MasterAccountId")
    if master_id != account.aws_account_id:
        return AccountSyncOutcome(status="not_management", management_account_id=master_id)

    rows = await _sync_management_policy(session, workspace_id, client, master_id)
    return AccountSyncOutcome(
        status="synced", rows_upserted=rows, management_account_id=master_id
    )


async def _sync_management_policy(
    session: AsyncSession, workspace_id: str, client, master_id: str
) -> int:
    """Read and upsert the effective TAG_POLICY for the management account."""
    # The effective policy is a merge of all attached TAG_POLICY documents.
    # Attribute synced rows to the first source policy for traceability.
    source_id = source_arn = None
    try:
        policies = client.list_policies(Filter="TAG_POLICY").get("Policies", [])
        if policies:
            source_id = policies[0].get("Id")
            source_arn = policies[0].get("Arn")
    except ClientError as e:
        logger.warning("list_policies(TAG_POLICY) failed: %s", _err(e))

    content = client.describe_effective_policy(
        PolicyType="TAG_POLICY", TargetId=master_id
    )["EffectivePolicy"]["PolicyContent"]

    parsed = _parse_effective_policy(content)
    repo = AwsOrgTagPolicyRepository(session, workspace_id)
    for rule in parsed:
        await repo.upsert(
            tag_key=rule.tag_key,
            required=rule.required,
            allowed_values=rule.allowed_values,
            case_sensitive=rule.case_sensitive,
            source_policy_id=source_id,
            source_policy_arn=source_arn,
            raw=rule.raw,
        )
    await repo.delete_keys_not_in({r.tag_key for r in parsed})
    return len(parsed)


async def _eligible_accounts(session: AsyncSession, workspace_id: str) -> list[AwsAccount]:
    result = await session.execute(
        select(AwsAccount).where(
            AwsAccount.workspace_id == workspace_id,
            AwsAccount.status.in_(_ELIGIBLE_STATUSES),
        )
    )
    return list(result.scalars().all())


async def sync(session: AsyncSession, workspace_id: str) -> int:
    """Find the management account and sync its effective tag policy.

    Iterates connected accounts (spec §6.4) and syncs the first account that is
    the Org management account. Returns rows upserted (0 when the workspace is
    not on AWS Organizations, or no management account is connected with tag
    writes enabled). Commits its own session.
    """
    rows = 0
    for account in await _eligible_accounts(session, workspace_id):
        outcome = await _sync_from_account(session, workspace_id, account)
        if outcome.status == "synced":
            rows = outcome.rows_upserted
            break
        if outcome.status == "not_in_use":
            logger.info("Workspace %s is not on AWS Organizations.", workspace_id)
            break
        if outcome.status == "error":
            logger.warning(
                "AWS Org sync skipped account %s: %s",
                account.aws_account_id,
                outcome.error,
            )
    await session.commit()
    return rows


async def sync_for_account(
    session: AsyncSession, workspace_id: str, aws_account_id: str
) -> int:
    """Per-account daily-job entry point. Syncs only when this account is the
    Org management account; a no-op (returns 0) otherwise. Raises on AWS error
    so the job runner records a per-account failure. Commits its own session.
    """
    account = await AwsAccountRepository(session, workspace_id).get_by_aws_account_id(
        aws_account_id
    )
    if account is None:
        return 0
    outcome = await _sync_from_account(session, workspace_id, account)
    await session.commit()
    if outcome.status == "error":
        raise RuntimeError(outcome.error or "AWS Org tag policy sync failed")
    return outcome.rows_upserted


async def detect_schema_conflicts(
    session: AsyncSession, workspace_id: str
) -> list[ConflictDescriptor]:
    """Compare Numio's active tag-policy rules against the synced AWS Org policy.

    A Numio rule's existence means the tag is required (absence -> ``missing_tag``),
    so Numio ``required`` is always True (spec §7.4).
    """
    policies = await TagPolicyRepository(session, workspace_id).list_active()
    numio_rules: dict[str, object] = {}
    for policy in policies:
        for rule in policy.rules:
            numio_rules.setdefault(rule.tag_name, rule)

    org_rows = {
        row.tag_key: row
        for row in await AwsOrgTagPolicyRepository(session, workspace_id).list_by_workspace()
    }

    conflicts: list[ConflictDescriptor] = []

    for tag_key, rule in numio_rules.items():
        org = org_rows.get(tag_key)
        if org is None:
            continue

        if not org.required:
            conflicts.append(
                ConflictDescriptor(
                    tag_key=tag_key,
                    conflict_type="required_mismatch",
                    detail=f"Numio enforces '{tag_key}' as required; AWS Org does not.",
                    numio_required=True,
                    aws_required=False,
                )
            )

        if rule.allowed_values and org.allowed_values:
            numio_vals = set(rule.allowed_values)
            aws_vals = set(org.allowed_values)
            if numio_vals != aws_vals:
                bits = []
                only_numio = sorted(numio_vals - aws_vals)
                only_aws = sorted(aws_vals - numio_vals)
                if only_numio:
                    bits.append(f"only in Numio: {', '.join(only_numio)}")
                if only_aws:
                    bits.append(f"only in AWS Org: {', '.join(only_aws)}")
                conflicts.append(
                    ConflictDescriptor(
                        tag_key=tag_key,
                        conflict_type="allowed_values_diff",
                        detail=f"Allowed values for '{tag_key}' differ ({'; '.join(bits)}).",
                        numio_allowed_values=sorted(numio_vals),
                        aws_allowed_values=sorted(aws_vals),
                    )
                )

        if org.case_sensitive and rule.allowed_values:
            lowered = [v.lower() for v in rule.allowed_values]
            if len(lowered) != len(set(lowered)):
                conflicts.append(
                    ConflictDescriptor(
                        tag_key=tag_key,
                        conflict_type="case_sensitivity",
                        detail=(
                            f"AWS Org treats '{tag_key}' as case-sensitive, but Numio's "
                            "allowed values include case variants of the same token."
                        ),
                    )
                )

    for tag_key, org in org_rows.items():
        if tag_key not in numio_rules:
            conflicts.append(
                ConflictDescriptor(
                    tag_key=tag_key,
                    conflict_type="missing_in_numio",
                    detail=f"AWS Org defines tag '{tag_key}' but Numio has no matching rule.",
                    aws_required=org.required,
                    aws_allowed_values=org.allowed_values,
                )
            )

    return conflicts
