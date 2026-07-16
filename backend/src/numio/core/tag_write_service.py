"""Write AWS resource tags via the Resource Groups Tagging API.

One public entry point — ``apply_tag_changes`` — applies up to 100 tag
set/remove changes across resources in one or more connected accounts, records
every leaf change in the action-event audit, and never lets one resource's
failure block the others. The single code path is ``resourcegroupstaggingapi``
(`tag_resources` / `untag_resources`), batched to AWS's 20-ARN-per-call limit;
using RGTA rather than per-service tagging APIs is deliberate so callers do not
have to special-case replace-vs-merge semantics (e.g. S3 PutBucketTagging).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

import boto3
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.aws_service import assume_role_for_account
from numio.db.audit_action_event_repository import AuditActionEventRepository
from numio.db.aws_account_repository import AwsAccountRepository
from numio.models.cloud_resource import CloudResource

logger = logging.getLogger(__name__)

MAX_CHANGES = 100
RGTA_BATCH_SIZE = 20


@dataclass(frozen=True)
class TagChange:
    """One tag mutation. ``value=None`` means remove the tag key."""

    resource_id: UUID
    tag_key: str
    value: str | None


@dataclass(frozen=True)
class ActionEventResult:
    event_id: UUID
    status: str
    summary: dict


class BulkLimitExceeded(ValueError):
    """Raised when an operation exceeds ``MAX_CHANGES``. Mapped to HTTP 400."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _chunks(seq: list, size: int):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


async def apply_tag_changes(
    session: AsyncSession,
    workspace_id: str,
    changes: list[TagChange],
    actor: str,
    rationale: str | None = None,
    *,
    operation_type: str = "tag_apply",
) -> ActionEventResult:
    """Apply tag set/remove changes to AWS, recording an action-event audit.

    Raises ``BulkLimitExceeded`` (before any AWS call) when more than
    ``MAX_CHANGES`` changes are supplied. Per-resource failures are recorded as
    child items and never raise; the parent status reflects the aggregate.
    """
    if len(changes) > MAX_CHANGES:
        raise BulkLimitExceeded(
            f"{len(changes)} changes exceeds the {MAX_CHANGES}-per-operation limit"
        )

    resource_ids = list({c.resource_id for c in changes})
    rows = (
        await session.execute(
            select(CloudResource).where(
                CloudResource.workspace_id == workspace_id,
                CloudResource.id.in_(resource_ids),
            )
        )
    ).scalars().all()
    resource_by_id = {r.id: r for r in rows}

    account_repo = AwsAccountRepository(session, workspace_id)
    audit = AuditActionEventRepository(session, workspace_id)
    event = await audit.create_event(
        actor=actor,
        operation_type=operation_type,
        status="in_progress",
        rationale=rationale,
    )

    success = 0
    failure = 0

    # Partition changes by the resource's owning AWS account. Changes whose
    # resource is missing or has no ARN cannot be written and fail immediately.
    by_account: dict[str, list[tuple[TagChange, CloudResource]]] = defaultdict(list)
    for change in changes:
        resource = resource_by_id.get(change.resource_id)
        if resource is None or not resource.arn:
            audit.add_item(
                event_id=event.id,
                target_type="aws_resource",
                target_id=resource.arn if resource and resource.arn else str(change.resource_id),
                change_key=change.tag_key,
                before_value=(resource.tags or {}).get(change.tag_key) if resource else None,
                after_value=change.value,
                status="failure",
                error_code="ResourceNotTaggable",
                error_message=(
                    "Resource not found in inventory"
                    if resource is None
                    else "Resource has no ARN"
                ),
                completed_at=_now(),
            )
            failure += 1
            continue
        by_account[resource.account_id].append((change, resource))

    for aws_account_id, items in by_account.items():
        account = await account_repo.get_by_aws_account_id(aws_account_id)
        if account is None or not account.tag_writer_role_arn:
            for change, resource in items:
                audit.add_item(
                    event_id=event.id,
                    target_type="aws_resource",
                    target_id=resource.arn,
                    change_key=change.tag_key,
                    before_value=(resource.tags or {}).get(change.tag_key),
                    after_value=change.value,
                    status="failure",
                    error_code="TagWritesNotEnabled",
                    error_message="No verified tag-writer role for this account",
                    completed_at=_now(),
                )
                failure += 1
            continue

        ok, error, creds = assume_role_for_account(
            account, role_arn=account.tag_writer_role_arn, session_name="numio-tag-writer"
        )
        if not ok:
            for change, resource in items:
                audit.add_item(
                    event_id=event.id,
                    target_type="aws_resource",
                    target_id=resource.arn,
                    change_key=change.tag_key,
                    before_value=(resource.tags or {}).get(change.tag_key),
                    after_value=change.value,
                    status="failure",
                    error_code="AssumeRoleFailed",
                    error_message=error,
                    completed_at=_now(),
                )
                failure += 1
            continue

        client = boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        ).client("resourcegroupstaggingapi")

        s, f = _apply_for_account(client, items, audit, event.id)
        success += s
        failure += f

    if failure == 0:
        status = "success"
    elif success == 0:
        status = "failure"
    else:
        status = "partial_failure"

    summary = {
        "item_count": len(changes),
        "success_count": success,
        "failure_count": failure,
    }
    await audit.finalize_event(event, status=status, summary=summary, completed_at=_now())
    # The job-runner pattern: a service that owns its session must commit
    # explicitly — only this commit persists the audit rows.
    await session.commit()
    return ActionEventResult(event_id=event.id, status=status, summary=summary)


def _apply_for_account(client, items, audit, event_id) -> tuple[int, int]:
    """Issue batched RGTA calls for one account's changes; write child items."""
    success = 0
    failure = 0
    resource_by_arn = {resource.arn: resource for _, resource in items}

    # tag_resources applies one Tags map to a batch of ARNs, so set changes are
    # grouped by (key, value); removals are grouped by key for untag_resources.
    sets: dict[tuple[str, str], list[str]] = defaultdict(list)
    removes: dict[str, list[str]] = defaultdict(list)
    for change, resource in items:
        if change.value is None:
            removes[change.tag_key].append(resource.arn)
        else:
            sets[(change.tag_key, change.value)].append(resource.arn)

    for (key, value), arns in sets.items():
        for batch in _chunks(arns, RGTA_BATCH_SIZE):
            s, f = _run_batch(
                audit, event_id, resource_by_arn, key, value, batch,
                lambda b: client.tag_resources(ResourceARNList=b, Tags={key: value}),
            )
            success += s
            failure += f

    for key, arns in removes.items():
        for batch in _chunks(arns, RGTA_BATCH_SIZE):
            s, f = _run_batch(
                audit, event_id, resource_by_arn, key, None, batch,
                lambda b: client.untag_resources(ResourceARNList=b, TagKeys=[key]),
            )
            success += s
            failure += f

    return success, failure


def _run_batch(audit, event_id, resource_by_arn, key, value, batch, call) -> tuple[int, int]:
    """Execute one RGTA call and record one child item per ARN in the batch."""
    success = 0
    failure = 0
    try:
        resp = call(batch)
    except Exception as e:  # noqa: BLE001 — record, never propagate
        logger.warning("RGTA call failed for %d ARN(s): %s", len(batch), e)
        for arn in batch:
            audit.add_item(
                event_id=event_id,
                target_type="aws_resource",
                target_id=arn,
                change_key=key,
                before_value=(resource_by_arn[arn].tags or {}).get(key),
                after_value=value,
                status="failure",
                error_code="TaggingApiError",
                error_message=str(e),
                completed_at=_now(),
            )
        return 0, len(batch)

    request_id = resp.get("ResponseMetadata", {}).get("RequestId")
    failed_map = resp.get("FailedResourcesMap", {}) or {}
    for arn in batch:
        before = (resource_by_arn[arn].tags or {}).get(key)
        if arn in failed_map:
            info = failed_map[arn]
            audit.add_item(
                event_id=event_id,
                target_type="aws_resource",
                target_id=arn,
                change_key=key,
                before_value=before,
                after_value=value,
                status="failure",
                error_code=info.get("ErrorCode"),
                error_message=info.get("ErrorMessage"),
                aws_request_id=request_id,
                completed_at=_now(),
            )
            failure += 1
        else:
            audit.add_item(
                event_id=event_id,
                target_type="aws_resource",
                target_id=arn,
                change_key=key,
                before_value=before,
                after_value=value,
                status="success",
                aws_request_id=request_id,
                completed_at=_now(),
            )
            success += 1
    return success, failure


async def apply_single_tag(
    session: AsyncSession,
    workspace_id: str,
    resource_id: UUID,
    tag_key: str,
    value: str | None,
    actor: str,
    rationale: str | None = None,
) -> ActionEventResult:
    """Single-resource convenience wrapper (used by the MCP tool)."""
    return await apply_tag_changes(
        session,
        workspace_id,
        [TagChange(resource_id=resource_id, tag_key=tag_key, value=value)],
        actor,
        rationale,
        operation_type="tag_remove" if value is None else "tag_apply",
    )
