"""Tests for core/tag_write_service.py — batched RGTA writes + action-event audit."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from numio.core.tag_write_service import (
    MAX_CHANGES,
    BulkLimitExceeded,
    TagChange,
    apply_single_tag,
    apply_tag_changes,
)
from numio.models.audit_action_event import AuditActionEvent, AuditActionEventItem
from numio.models.aws_account import AwsAccount
from numio.models.cloud_resource import CloudResource

WS = "ws-tagwrite"
ACCT = "555555555555"


async def _seed_account(db_session, *, tag_writer=True):
    acct = AwsAccount(
        workspace_id=WS,
        aws_account_id=ACCT,
        alias="acct",
        role_arn=f"arn:aws:iam::{ACCT}:role/NumioCurReaderRole",
        tag_writer_role_arn=(
            f"arn:aws:iam::{ACCT}:role/NumioTagWriterRole-Cfn-x" if tag_writer else None
        ),
        aws_access_key_id="AKIA",
        aws_secret_access_key="secret",
        external_id="ext",
        status="connected",
    )
    db_session.add(acct)
    await db_session.flush()
    return acct


async def _seed_resource(db_session, n: int, *, tags=None, arn=None):
    r = CloudResource(
        workspace_id=WS,
        account_id=ACCT,
        region="us-east-1",
        service="ec2",
        resource_type="instance",
        resource_id=f"i-{n:04d}",
        arn=arn if arn is not None else f"arn:aws:ec2:us-east-1:{ACCT}:instance/i-{n:04d}",
        tags=tags or {},
    )
    db_session.add(r)
    await db_session.flush()
    return r


def _rgta_mock(failed_map=None):
    """Return (patch ctx for boto3.Session, mock client) wired for success."""
    client = MagicMock()
    resp = {"FailedResourcesMap": failed_map or {}, "ResponseMetadata": {"RequestId": "req-1"}}
    client.tag_resources.return_value = resp
    client.untag_resources.return_value = resp
    return client


class _patched:
    """Context manager patching boto3.Session + assume_role_for_account."""

    def __init__(self, client, assume_ok=True, assume_err=None):
        self.client = client
        self.assume = (
            (True, None, {"AccessKeyId": "a", "SecretAccessKey": "s", "SessionToken": "t"})
            if assume_ok
            else (False, assume_err or "AssumeRole failed", None)
        )

    def __enter__(self):
        self._p1 = patch("numio.core.tag_write_service.boto3.Session")
        self._p2 = patch(
            "numio.core.tag_write_service.assume_role_for_account", return_value=self.assume
        )
        mock_session = self._p1.start()
        mock_session.return_value.client.return_value = self.client
        self._p2.start()
        return self

    def __exit__(self, *a):
        self._p1.stop()
        self._p2.stop()


async def _items(db_session, event_id):
    return (
        (
            await db_session.execute(
                select(AuditActionEventItem).where(AuditActionEventItem.event_id == event_id)
            )
        )
        .scalars()
        .all()
    )


@pytest.mark.asyncio
async def test_single_set_success(db_session):
    await _seed_account(db_session)
    r = await _seed_resource(db_session, 1, tags={})
    client = _rgta_mock()
    with _patched(client):
        result = await apply_tag_changes(
            db_session, WS, [TagChange(r.id, "env", "production")], actor="admin@test"
        )
    assert result.status == "success"
    assert result.summary == {"item_count": 1, "success_count": 1, "failure_count": 0}
    items = await _items(db_session, result.event_id)
    assert len(items) == 1
    assert items[0].status == "success"
    assert items[0].after_value == "production"
    assert items[0].aws_request_id == "req-1"
    client.tag_resources.assert_called_once()


@pytest.mark.asyncio
async def test_bulk_50_batches_into_three_calls(db_session):
    await _seed_account(db_session)
    resources = [await _seed_resource(db_session, n) for n in range(50)]
    changes = [TagChange(r.id, "env", "prod") for r in resources]
    client = _rgta_mock()
    with _patched(client):
        result = await apply_tag_changes(db_session, WS, changes, actor="admin@test")
    assert result.status == "success"
    assert result.summary["item_count"] == 50
    assert result.summary["success_count"] == 50
    # 50 ARNs, same (key,value) → ceil(50/20) = 3 RGTA calls.
    assert client.tag_resources.call_count == 3
    items = await _items(db_session, result.event_id)
    assert len(items) == 50


@pytest.mark.asyncio
async def test_partial_failure(db_session):
    await _seed_account(db_session)
    r1 = await _seed_resource(db_session, 1)
    r2 = await _seed_resource(db_session, 2)
    failed = {r2.arn: {"ErrorCode": "InvalidParameterException", "ErrorMessage": "nope"}}
    client = _rgta_mock(failed_map=failed)
    with _patched(client):
        result = await apply_tag_changes(
            db_session,
            WS,
            [TagChange(r1.id, "env", "prod"), TagChange(r2.id, "env", "prod")],
            actor="admin@test",
        )
    assert result.status == "partial_failure"
    assert result.summary == {"item_count": 2, "success_count": 1, "failure_count": 1}
    items = {i.target_id: i for i in await _items(db_session, result.event_id)}
    assert items[r1.arn].status == "success"
    assert items[r2.arn].status == "failure"
    assert items[r2.arn].error_code == "InvalidParameterException"


@pytest.mark.asyncio
async def test_bulk_limit_exceeded_makes_no_aws_calls(db_session):
    await _seed_account(db_session)
    r = await _seed_resource(db_session, 1)
    changes = [TagChange(r.id, f"k{i}", "v") for i in range(MAX_CHANGES + 1)]
    client = _rgta_mock()
    with _patched(client):
        with pytest.raises(BulkLimitExceeded):
            await apply_tag_changes(db_session, WS, changes, actor="admin@test")
    client.tag_resources.assert_not_called()
    # No audit event created.
    events = (await db_session.execute(select(AuditActionEvent))).scalars().all()
    assert events == []


@pytest.mark.asyncio
async def test_account_without_writer_role_fails_all(db_session):
    await _seed_account(db_session, tag_writer=False)
    r = await _seed_resource(db_session, 1)
    client = _rgta_mock()
    with _patched(client):
        result = await apply_tag_changes(
            db_session, WS, [TagChange(r.id, "env", "prod")], actor="admin@test"
        )
    assert result.status == "failure"
    items = await _items(db_session, result.event_id)
    assert len(items) == 1
    assert items[0].status == "failure"
    assert items[0].error_code == "TagWritesNotEnabled"
    client.tag_resources.assert_not_called()


@pytest.mark.asyncio
async def test_assume_role_failure_fails_all(db_session):
    await _seed_account(db_session)
    r = await _seed_resource(db_session, 1)
    client = _rgta_mock()
    with _patched(client, assume_ok=False, assume_err="AccessDenied"):
        result = await apply_tag_changes(
            db_session, WS, [TagChange(r.id, "env", "prod")], actor="admin@test"
        )
    assert result.status == "failure"
    items = await _items(db_session, result.event_id)
    assert items[0].error_code == "AssumeRoleFailed"


@pytest.mark.asyncio
async def test_missing_resource_fails(db_session):
    await _seed_account(db_session)
    client = _rgta_mock()
    ghost = uuid.uuid4()
    with _patched(client):
        result = await apply_tag_changes(
            db_session, WS, [TagChange(ghost, "env", "prod")], actor="admin@test"
        )
    assert result.status == "failure"
    items = await _items(db_session, result.event_id)
    assert items[0].error_code == "ResourceNotTaggable"


@pytest.mark.asyncio
async def test_commits_its_own_session(db_session):
    # Regression lock: the service must commit explicitly (dev-runbook flags
    # the cost-records missing-commit bug). Spy on commit so a future refactor
    # that drops it fails here.
    await _seed_account(db_session)
    r = await _seed_resource(db_session, 1)
    client = _rgta_mock()
    with _patched(client):
        with patch.object(db_session, "commit", wraps=db_session.commit) as spy:
            await apply_tag_changes(
                db_session, WS, [TagChange(r.id, "env", "prod")], actor="admin@test"
            )
    spy.assert_called()


@pytest.mark.asyncio
async def test_remove_uses_untag(db_session):
    await _seed_account(db_session)
    r = await _seed_resource(db_session, 1, tags={"env": "prod"})
    client = _rgta_mock()
    with _patched(client):
        result = await apply_single_tag(
            db_session, WS, r.id, "env", None, actor="admin@test"
        )
    assert result.status == "success"
    client.untag_resources.assert_called_once()
    items = await _items(db_session, result.event_id)
    assert items[0].before_value == "prod"
    assert items[0].after_value is None
