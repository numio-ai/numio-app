"""Tests for remediation campaigns."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.campaign_service import (
    create_campaign,
    generate_tag_commands,
    infer_owner,
    validate_status_transition,
)
from numio.core.compliance_service import run_compliance_audit
from numio.db.campaign_repository import CampaignRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord
from numio.schemas.campaign import CampaignCreate, ResourceFilter
from numio.schemas.tag_policy import (
    TagPolicyCreate,
    TagPolicyRuleCreate,
    ValueType,
)

WORKSPACE_ID = "test-workspace"


# ---------------------------------------------------------------------------
# Fixtures — shared test data
# ---------------------------------------------------------------------------


@pytest.fixture
async def setup_compliance_data(db_session):
    """Create resources, policy, cost records, and run compliance audit.

    Returns dict with resource objects, policy, and audit_run_id.
    """
    # Create resources
    resources = []
    configs = [
        {
            "resource_id": "i-camp-001",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": {"team": "platform", "environment": "prod"},
            "name": "compliant-instance",
            "arn": "arn:aws:ec2:us-east-1:111111111111:instance/i-camp-001",
        },
        {
            "resource_id": "i-camp-002",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": {"team": "platform", "aws:createdBy": "alice@co.com"},
            "name": "missing-env",
            "arn": "arn:aws:ec2:us-east-1:111111111111:instance/i-camp-002",
        },
        {
            "resource_id": "i-camp-003",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "222222222222",
            "tags": None,
            "name": "no-tags",
            "arn": "arn:aws:ec2:us-east-1:222222222222:instance/i-camp-003",
        },
        {
            "resource_id": "db-camp-001",
            "service": "rds",
            "resource_type": "db-instance",
            "account_id": "111111111111",
            "tags": {"owner": "bob@co.com"},
            "name": "missing-both",
            "arn": "arn:aws:rds:us-east-1:111111111111:db:db-camp-001",
        },
        {
            "resource_id": "bucket-camp-001",
            "service": "s3",
            "resource_type": "bucket",
            "account_id": "111111111111",
            "tags": None,
            "name": "test-bucket",
            "arn": "arn:aws:s3:::bucket-camp-001",
        },
        {
            "resource_id": "vol-camp-001",
            "service": "ebs",
            "resource_type": "volume",
            "account_id": "111111111111",
            "tags": None,
            "name": "test-volume",
            "arn": "arn:aws:ec2:us-east-1:111111111111:volume/vol-camp-001",
        },
        {
            "resource_id": "eipalloc-camp-001",
            "service": "eip",
            "resource_type": "elastic-ip",
            "account_id": "111111111111",
            "tags": None,
            "name": "test-eip",
            "arn": ("arn:aws:ec2:us-east-1:111111111111:elastic-ip/eipalloc-camp-001"),
        },
        {
            "resource_id": "my-func",
            "service": "lambda",
            "resource_type": "function",
            "account_id": "111111111111",
            "tags": None,
            "name": "test-lambda",
            "arn": ("arn:aws:lambda:us-east-1:111111111111:function:my-func"),
        },
    ]

    for cfg in configs:
        r = CloudResource(
            id=uuid.uuid4(),
            workspace_id=WORKSPACE_ID,
            account_id=cfg["account_id"],
            region="us-east-1",
            service=cfg["service"],
            resource_type=cfg["resource_type"],
            resource_id=cfg["resource_id"],
            arn=cfg.get("arn"),
            name=cfg["name"],
            tags=cfg["tags"],
        )
        db_session.add(r)
        resources.append(r)

    await db_session.flush()

    # Create cost records
    from datetime import date

    for r in resources[:4]:  # First 4 have costs
        cr = CostRecord(
            id=uuid.uuid4(),
            workspace_id=WORKSPACE_ID,
            provider="aws",
            data_source="cur",
            line_item_id=f"line-{r.resource_id}",
            billing_period=date(2026, 3, 1),
            usage_account_id=r.account_id,
            usage_start=datetime(2026, 3, 1, tzinfo=timezone.utc),
            usage_end=datetime(2026, 3, 31, tzinfo=timezone.utc),
            service="AmazonEC2",
            resource_id=r.arn or r.resource_id,
            line_item_type="Usage",
            unblended_cost=Decimal("500.00"),
            currency="USD",
        )
        db_session.add(cr)

    await db_session.flush()

    # Create policy
    policy_repo = TagPolicyRepository(db_session, WORKSPACE_ID)
    policy = await policy_repo.create(
        TagPolicyCreate(
            name="Campaign Test Policy",
            rules=[
                TagPolicyRuleCreate(
                    tag_name="team",
                    value_type=ValueType.string,
                    applicable_resource_types=["ec2", "rds"],
                ),
                TagPolicyRuleCreate(
                    tag_name="environment",
                    value_type=ValueType.enum,
                    allowed_values=["prod", "staging", "dev"],
                    default_value="dev",
                    applicable_resource_types=["ec2", "rds"],
                ),
            ],
        )
    )

    # Run compliance audit
    audit_run_id, _ = await run_compliance_audit(
        db_session,
        WORKSPACE_ID,
    )

    return {
        "resources": resources,
        "policy": policy,
        "audit_run_id": audit_run_id,
    }


# ---------------------------------------------------------------------------
# Status transition validation (unit tests)
# ---------------------------------------------------------------------------


class TestStatusTransitions:
    def test_pending_to_notified(self):
        assert validate_status_transition("pending", "notified") is None

    def test_pending_to_fixed(self):
        assert validate_status_transition("pending", "fixed") is None

    def test_pending_to_excluded(self):
        assert validate_status_transition("pending", "excluded") is None

    def test_notified_to_fixed(self):
        assert validate_status_transition("notified", "fixed") is None

    def test_notified_to_escalated(self):
        assert validate_status_transition("notified", "escalated") is None

    def test_escalated_to_fixed(self):
        assert validate_status_transition("escalated", "fixed") is None

    def test_fixed_to_excluded(self):
        assert validate_status_transition("fixed", "excluded") is None

    def test_excluded_is_terminal(self):
        error = validate_status_transition("excluded", "pending")
        assert error is not None
        assert "terminal" in error

    def test_backward_fixed_to_pending(self):
        error = validate_status_transition("fixed", "pending")
        assert error is not None
        assert "Invalid transition" in error

    def test_backward_notified_to_pending(self):
        error = validate_status_transition("notified", "pending")
        assert error is not None

    def test_pending_to_escalated_not_allowed(self):
        error = validate_status_transition("pending", "escalated")
        assert error is not None


# ---------------------------------------------------------------------------
# Owner inference (unit tests)
# ---------------------------------------------------------------------------


class TestOwnerInference:
    def _make_resource(self, tags=None):
        return SimpleNamespace(tags=tags)

    def test_infer_from_owner_tag(self):
        r = self._make_resource({"owner": "alice@co.com"})
        assert infer_owner(r) == "alice@co.com"

    def test_infer_from_team_tag(self):
        r = self._make_resource({"team": "platform"})
        assert infer_owner(r) == "platform"

    def test_infer_from_created_by(self):
        r = self._make_resource({"aws:createdBy": "bob@co.com"})
        assert infer_owner(r) == "bob@co.com"

    def test_no_tags_returns_none(self):
        r = self._make_resource(None)
        assert infer_owner(r) is None

    def test_empty_tags_returns_none(self):
        r = self._make_resource({})
        assert infer_owner(r) is None

    def test_unrelated_tags_returns_none(self):
        r = self._make_resource({"purpose": "cache", "tier": "premium"})
        assert infer_owner(r) is None


# ---------------------------------------------------------------------------
# CLI command generation (unit tests)
# ---------------------------------------------------------------------------


class TestCliCommandGeneration:
    def _make_resource(self, service, resource_id, arn=None, **kwargs):
        defaults = {
            "service": service,
            "resource_id": resource_id,
            "arn": arn,
            "region": "us-east-1",
            "account_id": "123456789012",
        }
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def _violation(self, tag_name, status="missing_tag", **kwargs):
        defaults = {
            "tag_name": tag_name,
            "status": status,
            "default_value": None,
            "allowed_values": None,
        }
        defaults.update(kwargs)
        return defaults

    def test_ec2_with_arn_uses_tagging_api(self):
        r = self._make_resource(
            "ec2",
            "i-123",
            arn="arn:aws:ec2:us-east-1:123456789012:instance/i-123",
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]
        assert "tag-resources" in cmds[0]
        assert "team=FILL_IN" in cmds[0]

    def test_ec2_fallback_without_arn(self):
        r = self._make_resource("ec2", "i-123", arn=None)
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "ec2 create-tags" in cmds[0]
        assert "i-123" in cmds[0]

    def test_rds_with_arn(self):
        r = self._make_resource(
            "rds",
            "mydb",
            arn="arn:aws:rds:us-east-1:123456789012:db:mydb",
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("env")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]

    def test_s3_with_arn(self):
        r = self._make_resource(
            "s3",
            "my-bucket",
            arn="arn:aws:s3:::my-bucket",
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("env")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]

    def test_ebs_with_arn(self):
        r = self._make_resource(
            "ebs",
            "vol-123",
            arn="arn:aws:ec2:us-east-1:123456789012:volume/vol-123",
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]

    def test_eip_with_arn(self):
        r = self._make_resource(
            "eip",
            "eipalloc-123",
            arn=("arn:aws:ec2:us-east-1:123456789012:elastic-ip/eipalloc-123"),
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("owner")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]

    def test_lambda_with_arn(self):
        r = self._make_resource(
            "lambda",
            "my-func",
            arn=("arn:aws:lambda:us-east-1:123456789012:function:my-func"),
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "resourcegroupstaggingapi" in cmds[0]

    def test_default_value_used(self):
        r = self._make_resource(
            "ec2",
            "i-123",
            arn="arn:aws:ec2:us-east-1:123456789012:instance/i-123",
        )
        cmds = generate_tag_commands(
            r,
            [self._violation("env", default_value="dev")],
        )
        assert "env=dev" in cmds[0]

    def test_invalid_value_uses_allowed(self):
        r = self._make_resource(
            "ec2",
            "i-123",
            arn="arn:aws:ec2:us-east-1:123456789012:instance/i-123",
        )
        cmds = generate_tag_commands(
            r,
            [
                self._violation(
                    "env",
                    status="invalid_value",
                    allowed_values=["prod", "staging"],
                ),
            ],
        )
        assert "env=prod" in cmds[0]

    def test_no_violations_returns_empty(self):
        r = self._make_resource("ec2", "i-123")
        cmds = generate_tag_commands(r, [])
        assert cmds == []

    def test_lambda_fallback_without_arn(self):
        r = self._make_resource("lambda", "my-func", arn=None)
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "lambda tag-resource" in cmds[0]

    def test_rds_fallback_without_arn(self):
        r = self._make_resource("rds", "mydb", arn=None)
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "rds add-tags-to-resource" in cmds[0]

    def test_s3_fallback_without_arn(self):
        r = self._make_resource("s3", "my-bucket", arn=None)
        cmds = generate_tag_commands(
            r,
            [self._violation("team")],
        )
        assert len(cmds) == 1
        assert "s3api put-bucket-tagging" in cmds[0]


# ---------------------------------------------------------------------------
# Campaign creation integration tests
# ---------------------------------------------------------------------------


class TestCampaignCreation:
    async def test_create_from_explicit_ids(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        # Resources 1-3 (index 1,2,3) are non-compliant EC2/RDS
        non_compliant_ids = [
            data["resources"][1].id,
            data["resources"][2].id,
        ]

        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Fix EC2 tags",
                resource_ids=non_compliant_ids,
            ),
        )

        assert campaign.name == "Fix EC2 tags"
        assert campaign.resource_count == 2
        assert campaign.status == "active"
        assert len(campaign.resources) == 2

    async def test_create_from_filters(
        self,
        db_session,
        setup_compliance_data,
    ):
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Fix account 111 tags",
                filters=ResourceFilter(
                    account_id="111111111111",
                    status="missing_tag",
                ),
            ),
        )

        assert campaign.status == "active"
        assert campaign.resource_count > 0

    async def test_create_with_deadline_and_goal(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        deadline = datetime(2026, 4, 30, tzinfo=timezone.utc)

        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Q2 Tag Push",
                deadline=deadline,
                target_compliance_goal=Decimal("80.00"),
                resource_ids=[data["resources"][2].id],
            ),
        )

        assert campaign.deadline == deadline
        assert campaign.target_compliance_goal == Decimal("80.00")

    async def test_campaign_captures_violations(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        # Resource index 2 has no tags at all
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Violations test",
                resource_ids=[data["resources"][2].id],
            ),
        )

        cr = campaign.resources[0]
        assert cr.violated_rules is not None
        assert len(cr.violated_rules) > 0

    async def test_campaign_infers_owner(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        # Resource index 1 has aws:createdBy tag
        # Resource index 3 has owner tag
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Owner test",
                resource_ids=[
                    data["resources"][1].id,
                    data["resources"][3].id,
                ],
            ),
        )

        owners = {cr.resource_id: cr.inferred_owner for cr in campaign.resources}
        # resource[1] has aws:createdBy = alice@co.com,
        # but team tag comes first
        assert owners[data["resources"][1].id] is not None
        # resource[3] has owner = bob@co.com
        assert owners[data["resources"][3].id] == "bob@co.com"

    async def test_campaign_generates_commands(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Commands test",
                resource_ids=[data["resources"][2].id],
            ),
        )

        cr = campaign.resources[0]
        assert cr.tag_commands is not None
        assert len(cr.tag_commands) > 0
        # Should use resourcegroupstaggingapi since resource has ARN
        assert "resourcegroupstaggingapi" in cr.tag_commands[0]

    async def test_create_no_matching_resources_raises(
        self,
        db_session,
        setup_compliance_data,
    ):
        with pytest.raises(ValueError, match="No matching"):
            await create_campaign(
                db_session,
                WORKSPACE_ID,
                CampaignCreate(
                    name="Empty",
                    resource_ids=[uuid.uuid4()],
                ),
            )

    async def test_before_compliance_score_captured(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Score test",
                resource_ids=[
                    data["resources"][1].id,
                    data["resources"][2].id,
                ],
            ),
        )

        # Both resources are non-compliant, score should be low
        assert campaign.before_compliance_score is not None


# ---------------------------------------------------------------------------
# Campaign repository tests
# ---------------------------------------------------------------------------


class TestCampaignRepository:
    async def test_list_campaigns(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        repo = CampaignRepository(db_session, WORKSPACE_ID)

        # Create two campaigns
        await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Camp 1",
                resource_ids=[data["resources"][1].id],
            ),
        )
        await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Camp 2",
                resource_ids=[data["resources"][2].id],
            ),
        )

        campaigns, total = await repo.list_all()
        assert total >= 2

    async def test_get_progress(
        self,
        db_session,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        campaign = await create_campaign(
            db_session,
            WORKSPACE_ID,
            CampaignCreate(
                name="Progress test",
                resource_ids=[
                    data["resources"][1].id,
                    data["resources"][2].id,
                ],
            ),
        )

        repo = CampaignRepository(db_session, WORKSPACE_ID)
        progress = await repo.get_progress(campaign.id)
        assert progress.get("pending", 0) == 2


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(db_session):
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


class TestCampaignAPI:
    async def test_create_campaign(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "API Campaign",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "API Campaign"
        assert body["resource_count"] == 1
        assert len(body["resources"]) == 1

    async def test_create_campaign_no_ids_or_filters(self, client):
        resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Empty",
            },
        )
        assert resp.status_code == 400

    async def test_list_campaigns(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        await client.post(
            "/api/v1/campaigns",
            json={
                "name": "List test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )

        resp = await client.get("/api/v1/campaigns")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] >= 1

    async def test_get_campaign_detail(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Detail test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        campaign_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/campaigns/{campaign_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Detail test"
        assert len(body["resources"]) == 1

    async def test_get_campaign_not_found(self, client):
        resp = await client.get(f"/api/v1/campaigns/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_update_resource_status(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Status test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        campaign_id = create_resp.json()["id"]
        resource_id = str(data["resources"][2].id)

        # pending → notified
        resp = await client.patch(
            f"/api/v1/campaigns/{campaign_id}/resources/{resource_id}/status",
            json={"status": "notified"},
        )
        assert resp.status_code == 200
        assert resp.json()["remediation_status"] == "notified"

        # notified → fixed
        resp = await client.patch(
            f"/api/v1/campaigns/{campaign_id}/resources/{resource_id}/status",
            json={"status": "fixed"},
        )
        assert resp.status_code == 200
        assert resp.json()["remediation_status"] == "fixed"

    async def test_reject_backward_transition(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Backward test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        campaign_id = create_resp.json()["id"]
        resource_id = str(data["resources"][2].id)

        # pending → notified
        await client.patch(
            f"/api/v1/campaigns/{campaign_id}/resources/{resource_id}/status",
            json={"status": "notified"},
        )

        # notified → pending (backward, should fail)
        resp = await client.patch(
            f"/api/v1/campaigns/{campaign_id}/resources/{resource_id}/status",
            json={"status": "pending"},
        )
        assert resp.status_code == 400

    async def test_get_progress(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Progress test",
                "resource_ids": [
                    str(data["resources"][1].id),
                    str(data["resources"][2].id),
                ],
            },
        )
        campaign_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/campaigns/{campaign_id}/progress")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_resources"] == 2
        pending = next(s for s in body["status_breakdown"] if s["status"] == "pending")
        assert pending["count"] == 2

    async def test_get_resource_commands(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Commands test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        campaign_id = create_resp.json()["id"]
        resource_id = str(data["resources"][2].id)

        resp = await client.get(f"/api/v1/campaigns/{campaign_id}/resources/{resource_id}/commands")
        assert resp.status_code == 200
        body = resp.json()
        assert "commands" in body
        assert isinstance(body["commands"], list)

    async def test_update_campaign_metadata(
        self,
        client,
        setup_compliance_data,
    ):
        data = setup_compliance_data
        create_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Update test",
                "resource_ids": [str(data["resources"][2].id)],
            },
        )
        campaign_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/campaigns/{campaign_id}",
            json={"name": "Updated name", "status": "completed"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated name"
        assert resp.json()["status"] == "completed"
