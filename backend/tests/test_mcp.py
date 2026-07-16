"""Tests for MCP server — tool registration, parameter passing, and workspace scoping."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.aws_org_tag_policy_repository import AwsOrgTagPolicyRepository
from numio.db.finding_repository import FindingRepository
from numio.db.recommendation_repository import RecommendationRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.aws_account import AwsAccount
from numio.models.cloud_resource import CloudResource
from numio.schemas.aws_account import RegisterAccountRequest
from numio.schemas.finding import CreateFindingRequest
from numio.schemas.tag_policy import TagPolicyCreate, TagPolicyRuleCreate, ValueType

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def finding_repo(db_session, default_workspace_id):
    return FindingRepository(db_session, default_workspace_id)


@pytest.fixture
def rec_repo(db_session, default_workspace_id):
    return RecommendationRepository(db_session, default_workspace_id)


@pytest.fixture
def account_repo(db_session, default_workspace_id):
    return AwsAccountRepository(db_session, default_workspace_id)


# ---------------------------------------------------------------------------
# MCP tool registration
# ---------------------------------------------------------------------------


class TestMCPToolRegistration:
    def test_expected_tools_registered(self):
        from numio.mcp.server import mcp

        tool_names = {t.name for t in mcp._tool_manager.list_tools()}
        expected = {
            "get_cost_summary",
            "get_cost_by_dimension",
            "list_findings",
            "list_recommendations",
            "get_account_status",
        }
        assert expected.issubset(tool_names)

    def test_no_placeholder_tools_remain(self):
        from numio.mcp.server import mcp

        tool_names = {t.name for t in mcp._tool_manager.list_tools()}
        assert "get_cost_by_service" not in tool_names
        assert "get_cost_trends" not in tool_names

    def test_tag_tools_registered(self):
        from numio.mcp.server import mcp

        tool_names = {t.name for t in mcp._tool_manager.list_tools()}
        expected = {
            "list_tag_keys",
            "get_resource_tags",
            "apply_tags",
            "list_tag_conflicts",
            "get_tag_coverage",
        }
        assert expected.issubset(tool_names)


# ---------------------------------------------------------------------------
# MCP tools — integration tests (call executors against the real DB)
# ---------------------------------------------------------------------------


class TestMCPTools:
    """Test MCP tool functions directly by mocking AsyncSessionLocal to use
    the test DB session (which rolls back after each test)."""

    @pytest.fixture(autouse=True)
    def _patch_session(self, db_session):
        """Replace AsyncSessionLocal context manager with the test session."""
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=db_session)
        cm.__aexit__ = AsyncMock(return_value=False)

        with patch("numio.mcp.server.AsyncSessionLocal", return_value=cm):
            yield

    async def test_get_cost_summary(self):
        from numio.mcp.server import get_cost_summary

        result = await get_cost_summary()
        assert "total" in result
        assert "currency" in result
        assert result["currency"] == "USD"

    async def test_get_cost_summary_with_dates(self):
        from numio.mcp.server import get_cost_summary

        result = await get_cost_summary(start_date="2026-01-01", end_date="2026-01-31")
        assert "total" in result
        assert result["start_date"] == "2026-01-01"
        assert result["end_date"] == "2026-01-31"

    async def test_get_cost_by_dimension(self):
        from numio.mcp.server import get_cost_by_dimension

        result = await get_cost_by_dimension(dimension="service")
        assert result["dimension"] == "service"
        assert "total" in result
        assert "items" in result
        assert isinstance(result["items"], list)

    async def test_list_findings_empty(self):
        from numio.mcp.server import list_findings

        result = await list_findings()
        assert result["total"] == 0
        assert result["findings"] == []

    async def test_list_findings_with_data(self, finding_repo):
        from numio.mcp.server import list_findings

        await finding_repo.create_or_update(
            CreateFindingRequest(
                type="zombie",
                severity="high",
                title="Unattached EBS volume",
                resource_id="vol-mcp-test",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("10.00"),
            )
        )

        result = await list_findings(type="zombie", severity="high")
        assert result["total"] >= 1
        assert result["findings"][0]["type"] == "zombie"
        assert result["findings"][0]["severity"] == "high"

    async def test_list_findings_status_filter(self, finding_repo):
        from numio.mcp.server import list_findings

        await finding_repo.create_or_update(
            CreateFindingRequest(
                type="idle",
                severity="medium",
                title="Idle EC2 instance",
                resource_id="i-mcp-idle",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("5.00"),
            )
        )

        result = await list_findings(status="open")
        assert result["total"] >= 1

        result_resolved = await list_findings(status="resolved")
        finding_ids = {f["resource_id"] for f in result_resolved["findings"]}
        assert "i-mcp-idle" not in finding_ids

    async def test_list_recommendations_empty(self):
        from numio.mcp.server import list_recommendations

        result = await list_recommendations()
        assert result["total"] == 0
        assert result["recommendations"] == []

    async def test_list_recommendations_with_data(self, finding_repo, rec_repo):
        from numio.mcp.server import list_recommendations

        finding, _ = await finding_repo.create_or_update(
            CreateFindingRequest(
                type="zombie",
                severity="medium",
                title="Unattached volume",
                resource_id="vol-mcp-rec",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("7.50"),
            )
        )
        await rec_repo.create(
            finding_id=finding.id,
            category="zombie_cleanup",
            confidence="high",
            title="Delete unattached volume",
            description="Clean up vol-mcp-rec",
            resource_id="vol-mcp-rec",
            remediation_commands="aws ec2 delete-volume --volume-id vol-mcp-rec",
            estimated_monthly_savings=Decimal("7.50"),
        )

        result = await list_recommendations(category="zombie_cleanup")
        assert result["total"] >= 1
        assert result["recommendations"][0]["category"] == "zombie_cleanup"

    async def test_get_account_status_empty(self):
        from numio.mcp.server import get_account_status

        result = await get_account_status()
        assert result["total"] == 0
        assert result["accounts"] == []

    async def test_get_account_status_with_data(self, account_repo):
        from numio.mcp.server import get_account_status

        await account_repo.create(
            RegisterAccountRequest(
                aws_account_id="123456789012",
                alias="Test Account",
                role_arn="arn:aws:iam::123456789012:role/NumioReadRole",
                aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
                aws_secret_access_key="wJalrXUtnFEMI/EXAMPLE",
                external_id="test-external-id",
            )
        )

        result = await get_account_status()
        assert result["total"] >= 1
        acct = result["accounts"][0]
        assert acct["aws_account_id"] == "123456789012"
        assert acct["alias"] == "Test Account"
        assert acct["status"] == "disconnected"

    async def test_all_tools_return_structured_data(self):
        """Acceptance criteria #8: all tools return structured data (dicts)."""
        from numio.mcp.server import (
            get_account_status,
            get_cost_by_dimension,
            get_cost_summary,
            list_findings,
            list_recommendations,
        )

        results = [
            await get_cost_summary(),
            await get_cost_by_dimension(dimension="service"),
            await list_findings(),
            await list_recommendations(),
            await get_account_status(),
        ]
        for result in results:
            assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# Workspace scoping — no cross-workspace data leakage (AC #10)
# ---------------------------------------------------------------------------


class TestMCPWorkspaceScoping:
    @pytest.fixture(autouse=True)
    def _patch_session(self, db_session):
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=db_session)
        cm.__aexit__ = AsyncMock(return_value=False)
        with patch("numio.mcp.server.AsyncSessionLocal", return_value=cm):
            yield

    async def test_findings_scoped_to_default_workspace(self, db_session):
        """Findings in a different workspace must not appear in MCP results."""
        from numio.mcp.server import list_findings

        other_ws = "other-workspace"
        other_repo = FindingRepository(db_session, other_ws)
        await other_repo.create_or_update(
            CreateFindingRequest(
                type="zombie",
                severity="critical",
                title="Other workspace finding",
                resource_id="vol-other-ws",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("100.00"),
            )
        )

        result = await list_findings(type="zombie")
        resource_ids = {f["resource_id"] for f in result["findings"]}
        assert "vol-other-ws" not in resource_ids

    async def test_accounts_scoped_to_default_workspace(self, db_session):
        """Accounts in a different workspace must not appear in MCP results."""
        from numio.mcp.server import get_account_status

        other_ws = "other-workspace"
        other_repo = AwsAccountRepository(db_session, other_ws)
        await other_repo.create(
            RegisterAccountRequest(
                aws_account_id="999999999999",
                alias="Other WS Account",
                role_arn="arn:aws:iam::999999999999:role/NumioReadRole",
                aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
                aws_secret_access_key="wJalrXUtnFEMI/EXAMPLE",
                external_id="test-external-id",
            )
        )

        result = await get_account_status()
        acct_ids = {a["aws_account_id"] for a in result["accounts"]}
        assert "999999999999" not in acct_ids


# ---------------------------------------------------------------------------
# MCP endpoint mounting
# ---------------------------------------------------------------------------


class TestMCPEndpointMounting:
    def test_register_mcp_endpoints(self):
        from fastapi import FastAPI

        from numio.mcp.server import register_mcp_endpoints

        test_app = FastAPI()
        register_mcp_endpoints(test_app)

        mount_paths = {route.path for route in test_app.routes}
        assert "/mcp" in mount_paths
        assert "/mcp/sse" in mount_paths


# ---------------------------------------------------------------------------
# Tag management tools (task 8)
# ---------------------------------------------------------------------------

ACCT = "555555555555"


async def _seed_account(db_session, ws):
    db_session.add(
        AwsAccount(
            workspace_id=ws,
            aws_account_id=ACCT,
            alias="acct",
            role_arn=f"arn:aws:iam::{ACCT}:role/NumioCurReaderRole",
            tag_writer_role_arn=f"arn:aws:iam::{ACCT}:role/NumioTagWriterRole",
            aws_access_key_id="AKIA",
            aws_secret_access_key="secret",
            external_id="ext",
            status="connected",
        )
    )
    await db_session.flush()


async def _seed_resource(db_session, ws, *, arn, tags):
    db_session.add(
        CloudResource(
            workspace_id=ws,
            account_id=ACCT,
            region="us-east-1",
            service="ec2",
            resource_type="instance",
            resource_id=arn.split("/")[-1],
            arn=arn,
            tags=tags,
        )
    )
    await db_session.flush()


def _rgta_patch():
    """Patch tag_write_service's boto3 + assume_role_for_account for a success write."""
    client = MagicMock()
    resp = {"FailedResourcesMap": {}, "ResponseMetadata": {"RequestId": "req-mcp"}}
    client.tag_resources.return_value = resp
    client.untag_resources.return_value = resp
    p_session = patch("numio.core.tag_write_service.boto3.Session")
    creds = {"AccessKeyId": "a", "SecretAccessKey": "s", "SessionToken": "t"}
    p_assume = patch(
        "numio.core.tag_write_service.assume_role_for_account",
        return_value=(True, None, creds),
    )
    return client, p_session, p_assume


class TestMCPTagTools:
    @pytest.fixture(autouse=True)
    def _patch_session(self, db_session):
        cm = AsyncMock()
        cm.__aenter__ = AsyncMock(return_value=db_session)
        cm.__aexit__ = AsyncMock(return_value=False)
        with patch("numio.mcp.server.AsyncSessionLocal", return_value=cm):
            yield

    async def test_list_tag_keys_merges_sources(self, db_session, default_workspace_id):
        from numio.mcp.server import list_tag_keys

        await TagPolicyRepository(db_session, default_workspace_id).create(
            TagPolicyCreate(
                name="P", rules=[TagPolicyRuleCreate(tag_name="env", value_type=ValueType.string)]
            )
        )
        await AwsOrgTagPolicyRepository(db_session, default_workspace_id).upsert(
            tag_key="costcenter",
            required=True,
            allowed_values=None,
            case_sensitive=True,
            source_policy_id="p",
            source_policy_arn="arn",
            raw={},
        )
        await db_session.flush()

        result = await list_tag_keys()
        by_key = {k["tag_key"]: k for k in result["keys"]}
        assert by_key["env"]["source"] == "numio"
        assert by_key["env"]["required"] is True
        assert by_key["costcenter"]["source"] == "aws-org"
        assert by_key["costcenter"]["required"] is True

    async def test_get_resource_tags(self, db_session, default_workspace_id):
        from numio.mcp.server import get_resource_tags

        arn = f"arn:aws:ec2:us-east-1:{ACCT}:instance/i-tags"
        await _seed_resource(
            db_session, default_workspace_id, arn=arn, tags={"team": "eng", "env": "dev"}
        )

        result = await get_resource_tags(resource_arn=arn)
        assert result["found"] is True
        assert result["tags"]["team"] == "eng"

        missing = await get_resource_tags(resource_arn="arn:aws:ec2:us-east-1:x:instance/i-nope")
        assert missing["found"] is False
        assert missing["tags"] == {}

    async def test_apply_tags_risky_rejected_with_preview(self, db_session, default_workspace_id):
        from numio.mcp.server import apply_tags

        arn = f"arn:aws:ec2:us-east-1:{ACCT}:instance/i-prod"
        await _seed_resource(db_session, default_workspace_id, arn=arn, tags={"env": "production"})

        result = await apply_tags(resource_arn=arn, tags={"team": "payments"})
        assert result["status"] == "rejected"
        assert result["reason"] == "risky_write_not_confirmed"
        assert result["preview"]["risky"] is True
        assert any("production" in r for r in result["preview"]["reasons"])

    async def test_apply_tags_non_risky_writes(self, db_session, default_workspace_id):
        from numio.mcp.server import apply_tags

        await _seed_account(db_session, default_workspace_id)
        arn = f"arn:aws:ec2:us-east-1:{ACCT}:instance/i-dev"
        await _seed_resource(db_session, default_workspace_id, arn=arn, tags={"env": "dev"})

        client, p_session, p_assume = _rgta_patch()
        p_session.start().return_value.client.return_value = client
        p_assume.start()
        try:
            result = await apply_tags(resource_arn=arn, tags={"team": "payments"})
        finally:
            p_session.stop()
            p_assume.stop()

        assert result["status"] == "success"
        assert "event_id" in result
        assert result["summary"]["success_count"] == 1

    async def test_apply_tags_risky_confirmed_proceeds(self, db_session, default_workspace_id):
        from numio.mcp.server import apply_tags

        await _seed_account(db_session, default_workspace_id)
        arn = f"arn:aws:ec2:us-east-1:{ACCT}:instance/i-prod2"
        await _seed_resource(db_session, default_workspace_id, arn=arn, tags={"env": "production"})

        client, p_session, p_assume = _rgta_patch()
        p_session.start().return_value.client.return_value = client
        p_assume.start()
        try:
            result = await apply_tags(
                resource_arn=arn, tags={"team": "payments"}, confirm_risky=True
            )
        finally:
            p_session.stop()
            p_assume.stop()

        assert result["status"] == "success"

    async def test_apply_tags_unknown_resource_rejected(self, db_session, default_workspace_id):
        from numio.mcp.server import apply_tags

        result = await apply_tags(resource_arn="arn:aws:ec2:::instance/i-ghost", tags={"team": "x"})
        assert result["status"] == "rejected"
        assert result["reason"] == "resource_not_found"

    async def test_list_tag_conflicts(self, db_session, default_workspace_id):
        from numio.mcp.server import list_tag_conflicts

        await TagPolicyRepository(db_session, default_workspace_id).create(
            TagPolicyCreate(
                name="P", rules=[TagPolicyRuleCreate(tag_name="env", value_type=ValueType.string)]
            )
        )
        await AwsOrgTagPolicyRepository(db_session, default_workspace_id).upsert(
            tag_key="env",
            required=False,
            allowed_values=None,
            case_sensitive=True,
            source_policy_id="p",
            source_policy_arn="arn",
            raw={},
        )
        await db_session.flush()

        result = await list_tag_conflicts()
        assert result["count"] >= 1
        assert any(c["conflict_type"] == "required_mismatch" for c in result["conflicts"])

    async def test_get_tag_coverage_empty(self, db_session, default_workspace_id):
        from numio.mcp.server import get_tag_coverage

        result = await get_tag_coverage()
        assert result["overall"] is None
        assert result["total_resources"] == 0

    async def test_get_tag_coverage_populated(self, db_session, default_workspace_id):
        import uuid as _uuid
        from datetime import datetime, timezone
        from decimal import Decimal

        from numio.mcp.server import get_tag_coverage
        from numio.models.compliance import ComplianceSnapshot
        from numio.models.job import JobRun

        run = JobRun(
            id=_uuid.uuid4(),
            workspace_id=default_workspace_id,
            job_type="compliance_audit",
            status="success",
            started_at=datetime.now(timezone.utc),
        )
        db_session.add(run)
        await db_session.flush()
        db_session.add(
            ComplianceSnapshot(
                id=_uuid.uuid4(),
                workspace_id=default_workspace_id,
                audit_run_id=run.id,
                dimension="overall",
                dimension_value=None,
                cost_weighted_score=Decimal("73.4000"),
                total_cost=Decimal("1000"),
                compliant_cost=Decimal("734"),
                total_resources=10,
                compliant_resources=7,
            )
        )
        await db_session.flush()

        result = await get_tag_coverage()
        # Same top-level keys as the empty branch — `overall` is present in both.
        assert set(result["overall"].keys()) >= {"cost_weighted_score", "total_cost"}
        assert result["overall"]["cost_weighted_score"] == 73.4
        assert result["total_resources"] == 10
        assert result["non_compliant_resources"] == 3
        assert result["untagged_spend"] == 266.0

    async def test_tag_tools_return_structured_data(self, db_session, default_workspace_id):
        from numio.mcp.server import get_tag_coverage, list_tag_conflicts, list_tag_keys

        for result in [await list_tag_keys(), await list_tag_conflicts(), await get_tag_coverage()]:
            assert isinstance(result, dict)
