"""Tests for AWS Organizations tag policy sync, conflicts, and endpoints (task 6)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
from httpx import ASGITransport, AsyncClient

from numio.core.aws_org_tag_policy_service import (
    _parse_effective_policy,
    detect_schema_conflicts,
    sync,
    sync_for_account,
)
from numio.db.aws_org_tag_policy_repository import AwsOrgTagPolicyRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.aws_account import AwsAccount
from numio.schemas.tag_policy import TagPolicyCreate, TagPolicyRuleCreate, ValueType

WS = "ws-orgsync"
MGMT = "111111111111"
MEMBER = "222222222222"

EFFECTIVE_POLICY = json.dumps(
    {
        "tags": {
            "costcenter": {
                "tag_key": {"@@assign": "CostCenter"},
                "tag_value": {"@@assign": ["CC-100", "CC-200"]},
                "enforced_for": {"@@assign": ["ec2:instance"]},
            },
            "environment": {
                "tag_key": {"@@assign": "Environment"},
            },
        }
    }
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


async def _seed_account(db_session, aws_account_id, *, tag_writer=True, status="connected"):
    acct = AwsAccount(
        workspace_id=WS,
        aws_account_id=aws_account_id,
        alias=aws_account_id,
        role_arn=f"arn:aws:iam::{aws_account_id}:role/NumioCurReaderRole",
        tag_writer_role_arn=(
            f"arn:aws:iam::{aws_account_id}:role/NumioTagWriterRole" if tag_writer else None
        ),
        aws_access_key_id="AKIA",
        aws_secret_access_key="secret",
        external_id="ext",
        status=status,
    )
    db_session.add(acct)
    await db_session.flush()
    return acct


def _org_client(*, master_id=MGMT, policy_content=EFFECTIVE_POLICY, not_in_use=False):
    client = MagicMock()
    if not_in_use:
        client.describe_organization.side_effect = ClientError(
            {"Error": {"Code": "AWSOrganizationsNotInUseException", "Message": "no org"}},
            "DescribeOrganization",
        )
    else:
        client.describe_organization.return_value = {
            "Organization": {"MasterAccountId": master_id}
        }
    client.list_policies.return_value = {
        "Policies": [
            {"Id": "p-123", "Arn": "arn:aws:organizations::aws:policy/tag_policy/p-123"}
        ]
    }
    client.describe_effective_policy.return_value = {
        "EffectivePolicy": {"PolicyContent": policy_content}
    }
    return client


class _patched:
    """Patch boto3.Session + assume_role_for_account in the service module."""

    def __init__(self, client, assume_ok=True):
        self.client = client
        self.assume = (
            (True, None, {"AccessKeyId": "a", "SecretAccessKey": "s", "SessionToken": "t"})
            if assume_ok
            else (False, "AssumeRole failed", None)
        )

    def __enter__(self):
        self._p1 = patch("numio.core.aws_org_tag_policy_service.boto3.Session")
        self._p2 = patch(
            "numio.core.aws_org_tag_policy_service.assume_role_for_account",
            return_value=self.assume,
        )
        mock_session = self._p1.start()
        mock_session.return_value.client.return_value = self.client
        self._p2.start()
        return self

    def __exit__(self, *a):
        self._p1.stop()
        self._p2.stop()


# ---------------------------------------------------------------------------
# Policy parsing (no DB, no AWS)
# ---------------------------------------------------------------------------


class TestParseEffectivePolicy:
    def test_parses_keys_values_required(self):
        by_key = {r.tag_key: r for r in _parse_effective_policy(EFFECTIVE_POLICY)}
        assert set(by_key) == {"CostCenter", "Environment"}
        assert by_key["CostCenter"].required is True
        assert by_key["CostCenter"].allowed_values == ["CC-100", "CC-200"]
        assert by_key["Environment"].required is False
        assert by_key["Environment"].allowed_values is None

    def test_malformed_content_returns_empty(self):
        assert _parse_effective_policy("not json") == []

    def test_missing_tags_returns_empty(self):
        assert _parse_effective_policy(json.dumps({"foo": 1})) == []

    def test_scalar_tag_value_coerced_to_list(self):
        content = json.dumps(
            {"tags": {"team": {"tag_key": {"@@assign": "team"}, "tag_value": {"@@assign": "pay"}}}}
        )
        assert _parse_effective_policy(content)[0].allowed_values == ["pay"]

    def test_raw_fragment_preserved(self):
        rules = _parse_effective_policy(EFFECTIVE_POLICY)
        cc = next(r for r in rules if r.tag_key == "CostCenter")
        assert cc.raw["enforced_for"] == {"@@assign": ["ec2:instance"]}


# ---------------------------------------------------------------------------
# sync() — on-demand management-account detection (§6.4)
# ---------------------------------------------------------------------------


class TestSync:
    async def test_management_account_upserts_rows(self, db_session):
        await _seed_account(db_session, MGMT)
        with _patched(_org_client(master_id=MGMT)):
            rows = await sync(db_session, WS)
        assert rows == 2
        keys = {
            r.tag_key for r in await AwsOrgTagPolicyRepository(db_session, WS).list_by_workspace()
        }
        assert keys == {"CostCenter", "Environment"}

    async def test_not_in_use_syncs_nothing(self, db_session):
        await _seed_account(db_session, MGMT)
        with _patched(_org_client(not_in_use=True)):
            rows = await sync(db_session, WS)
        assert rows == 0
        assert await AwsOrgTagPolicyRepository(db_session, WS).list_by_workspace() == []

    async def test_member_account_is_not_management(self, db_session):
        await _seed_account(db_session, MEMBER)
        with _patched(_org_client(master_id=MGMT)):  # master != connected account
            rows = await sync(db_session, WS)
        assert rows == 0

    async def test_account_without_writer_role_skipped(self, db_session):
        await _seed_account(db_session, MGMT, tag_writer=False)
        client = _org_client(master_id=MGMT)
        with _patched(client):
            rows = await sync(db_session, WS)
        assert rows == 0
        client.describe_organization.assert_not_called()

    async def test_sync_idempotent_and_removes_stale_keys(self, db_session):
        await _seed_account(db_session, MGMT)
        with _patched(_org_client(master_id=MGMT)):
            await sync(db_session, WS)
        smaller = json.dumps({"tags": {"costcenter": {"tag_key": {"@@assign": "CostCenter"}}}})
        with _patched(_org_client(master_id=MGMT, policy_content=smaller)):
            rows = await sync(db_session, WS)
        assert rows == 1
        keys = {
            r.tag_key for r in await AwsOrgTagPolicyRepository(db_session, WS).list_by_workspace()
        }
        assert keys == {"CostCenter"}


# ---------------------------------------------------------------------------
# sync_for_account() — per-account daily-job entry point
# ---------------------------------------------------------------------------


class TestSyncForAccount:
    async def test_management_account_syncs(self, db_session):
        await _seed_account(db_session, MGMT)
        with _patched(_org_client(master_id=MGMT)):
            assert await sync_for_account(db_session, WS, MGMT) == 2

    async def test_member_account_is_noop(self, db_session):
        await _seed_account(db_session, MEMBER)
        with _patched(_org_client(master_id=MGMT)):
            assert await sync_for_account(db_session, WS, MEMBER) == 0

    async def test_unknown_account_is_noop(self, db_session):
        with _patched(_org_client(master_id=MGMT)):
            assert await sync_for_account(db_session, WS, "999999999999") == 0

    async def test_assume_failure_raises(self, db_session):
        await _seed_account(db_session, MGMT)
        with _patched(_org_client(master_id=MGMT), assume_ok=False):
            with pytest.raises(RuntimeError):
                await sync_for_account(db_session, WS, MGMT)


# ---------------------------------------------------------------------------
# detect_schema_conflicts() (§7.4)
# ---------------------------------------------------------------------------


class TestConflicts:
    async def _numio(self, db_session, **rule):
        await TagPolicyRepository(db_session, WS).create(
            TagPolicyCreate(name=f"N-{rule['tag_name']}", rules=[TagPolicyRuleCreate(**rule)])
        )

    async def _org(
        self, db_session, *, tag_key, required=True, allowed_values=None, case_sensitive=True
    ):
        await AwsOrgTagPolicyRepository(db_session, WS).upsert(
            tag_key=tag_key,
            required=required,
            allowed_values=allowed_values,
            case_sensitive=case_sensitive,
            source_policy_id="p",
            source_policy_arn="arn",
            raw={},
        )
        await db_session.flush()

    async def test_required_mismatch(self, db_session):
        await self._numio(db_session, tag_name="env", value_type=ValueType.string)
        await self._org(db_session, tag_key="env", required=False)
        types = {c.conflict_type for c in await detect_schema_conflicts(db_session, WS)}
        assert "required_mismatch" in types

    async def test_allowed_values_diff(self, db_session):
        await self._numio(
            db_session, tag_name="env", value_type=ValueType.enum, allowed_values=["prod", "dev"]
        )
        await self._org(db_session, tag_key="env", allowed_values=["prod", "staging"])
        c = next(
            c
            for c in await detect_schema_conflicts(db_session, WS)
            if c.conflict_type == "allowed_values_diff"
        )
        assert "staging" in c.detail and "dev" in c.detail

    async def test_missing_in_numio(self, db_session):
        await self._org(db_session, tag_key="costcenter", required=True)
        conflicts = await detect_schema_conflicts(db_session, WS)
        assert any(
            c.conflict_type == "missing_in_numio" and c.tag_key == "costcenter" for c in conflicts
        )

    async def test_no_conflict_when_aligned(self, db_session):
        await self._numio(
            db_session,
            tag_name="env",
            value_type=ValueType.enum,
            allowed_values=["prod", "staging"],
        )
        await self._org(db_session, tag_key="env", allowed_values=["prod", "staging"])
        assert await detect_schema_conflicts(db_session, WS) == []


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(db_session):
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


class TestApi:
    async def test_list_empty(self, client):
        resp = await client.get("/api/v1/aws-org-tag-policy")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    async def test_conflicts_empty(self, client):
        resp = await client.get("/api/v1/tags/schema/conflicts")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    async def test_sync_endpoint_no_accounts(self, client):
        resp = await client.post("/api/v1/aws-org-tag-policy/sync")
        assert resp.status_code == 200
        assert resp.json()["rows_upserted"] == 0
