"""Tests for tag policy engine and compliance audit."""

import uuid
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.compliance_service import (
    _evaluate_rule,
    _rule_applies_to_resource,
    run_compliance_audit,
)
from numio.db.compliance_repository import ComplianceRepository
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord
from numio.schemas.tag_policy import (
    TagPolicyCreate,
    TagPolicyRuleCreate,
    TagPolicyUpdate,
    ValueType,
)

WORKSPACE_ID = "test-workspace"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def policy_repo(db_session):
    return TagPolicyRepository(db_session, WORKSPACE_ID)


@pytest.fixture
def compliance_repo(db_session):
    return ComplianceRepository(db_session, WORKSPACE_ID)


@pytest.fixture
async def sample_policy(policy_repo):
    """Create a policy requiring 'team' and 'environment' tags on EC2 and RDS."""
    data = TagPolicyCreate(
        name="Company Standard",
        description="Requires team and environment tags",
        priority=1,
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
                applicable_resource_types=["ec2", "rds"],
            ),
        ],
    )
    return await policy_repo.create(data)


@pytest.fixture
async def sample_resources(db_session):
    """Create test cloud resources with varying tags."""
    resources = []
    configs = [
        {
            "resource_id": "i-001",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": {"team": "platform", "environment": "prod"},
            "name": "compliant-instance",
        },
        {
            "resource_id": "i-002",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": {"team": "platform"},
            "name": "missing-env-instance",
        },
        {
            "resource_id": "i-003",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": {"team": "platform", "environment": "invalid-env"},
            "name": "invalid-env-instance",
        },
        {
            "resource_id": "i-004",
            "service": "ec2",
            "resource_type": "instance",
            "account_id": "111111111111",
            "tags": None,
            "name": "no-tags-instance",
        },
        {
            "resource_id": "bucket-001",
            "service": "s3",
            "resource_type": "bucket",
            "account_id": "111111111111",
            "tags": None,
            "name": "s3-bucket",
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
            name=cfg["name"],
            tags=cfg["tags"],
        )
        db_session.add(r)
        resources.append(r)

    await db_session.flush()
    return resources


@pytest.fixture
async def sample_cost_records(db_session, sample_resources):
    """Create cost records for some resources."""
    from datetime import date, datetime, timezone

    cost_data = [
        (sample_resources[0], Decimal("1000.00")),  # compliant: $1000
        (sample_resources[1], Decimal("500.00")),  # missing env: $500
        (sample_resources[2], Decimal("200.00")),  # invalid env: $200
        (sample_resources[3], Decimal("50.00")),  # no tags: $50
        # sample_resources[4] (S3) has no cost — treated as $0
    ]

    records = []
    for resource, cost in cost_data:
        r = CostRecord(
            id=uuid.uuid4(),
            workspace_id=WORKSPACE_ID,
            provider="aws",
            data_source="cur",
            line_item_id=f"line-{resource.resource_id}",
            billing_period=date(2026, 3, 1),
            usage_account_id=resource.account_id,
            usage_start=datetime(2026, 3, 1, tzinfo=timezone.utc),
            usage_end=datetime(2026, 3, 31, tzinfo=timezone.utc),
            service="AmazonEC2",
            resource_id=resource.arn or resource.resource_id,
            line_item_type="Usage",
            unblended_cost=cost,
            currency="USD",
        )
        db_session.add(r)
        records.append(r)

    await db_session.flush()
    return records


# ---------------------------------------------------------------------------
# Policy Repository Tests
# ---------------------------------------------------------------------------


class TestTagPolicyRepository:
    async def test_create_policy(self, policy_repo):
        data = TagPolicyCreate(
            name="Test Policy",
            rules=[
                TagPolicyRuleCreate(tag_name="owner", value_type=ValueType.email),
            ],
        )
        policy = await policy_repo.create(data)

        assert policy.id is not None
        assert policy.name == "Test Policy"
        assert policy.workspace_id == WORKSPACE_ID
        assert policy.is_active is True
        assert len(policy.rules) == 1
        assert policy.rules[0].tag_name == "owner"
        assert policy.rules[0].value_type == "email"

    async def test_list_active_policies(self, policy_repo):
        await policy_repo.create(
            TagPolicyCreate(
                name="Active",
                is_active=True,
                rules=[TagPolicyRuleCreate(tag_name="t1")],
            )
        )
        await policy_repo.create(
            TagPolicyCreate(
                name="Inactive",
                is_active=False,
                rules=[TagPolicyRuleCreate(tag_name="t2")],
            )
        )

        active = await policy_repo.list_active()
        assert len(active) == 1
        assert active[0].name == "Active"

    async def test_list_all_policies(self, policy_repo):
        await policy_repo.create(
            TagPolicyCreate(name="P1", rules=[TagPolicyRuleCreate(tag_name="t1")])
        )
        await policy_repo.create(
            TagPolicyCreate(name="P2", is_active=False, rules=[TagPolicyRuleCreate(tag_name="t2")])
        )

        all_policies = await policy_repo.list_all()
        assert len(all_policies) == 2

    async def test_get_by_id(self, policy_repo):
        created = await policy_repo.create(
            TagPolicyCreate(name="Lookup", rules=[TagPolicyRuleCreate(tag_name="t")])
        )
        found = await policy_repo.get_by_id(created.id)
        assert found is not None
        assert found.name == "Lookup"

    async def test_get_by_id_not_found(self, policy_repo):
        result = await policy_repo.get_by_id(uuid.uuid4())
        assert result is None

    async def test_update_policy_metadata(self, policy_repo):
        created = await policy_repo.create(
            TagPolicyCreate(name="Original", rules=[TagPolicyRuleCreate(tag_name="t")])
        )
        updated = await policy_repo.update(
            created.id,
            TagPolicyUpdate(name="Updated", description="New desc"),
        )
        assert updated.name == "Updated"
        assert updated.description == "New desc"

    async def test_update_replaces_rules(self, policy_repo):
        created = await policy_repo.create(
            TagPolicyCreate(
                name="RuleUpdate",
                rules=[TagPolicyRuleCreate(tag_name="old_tag")],
            )
        )
        assert len(created.rules) == 1
        assert created.rules[0].tag_name == "old_tag"

        updated = await policy_repo.update(
            created.id,
            TagPolicyUpdate(
                rules=[
                    TagPolicyRuleCreate(tag_name="new_tag_1"),
                    TagPolicyRuleCreate(tag_name="new_tag_2"),
                ]
            ),
        )
        assert len(updated.rules) == 2
        tag_names = {r.tag_name for r in updated.rules}
        assert tag_names == {"new_tag_1", "new_tag_2"}

    async def test_delete_policy(self, policy_repo):
        created = await policy_repo.create(
            TagPolicyCreate(name="ToDelete", rules=[TagPolicyRuleCreate(tag_name="t")])
        )
        deleted = await policy_repo.delete(created.id)
        assert deleted is True

        found = await policy_repo.get_by_id(created.id)
        assert found is None

    async def test_delete_nonexistent(self, policy_repo):
        deleted = await policy_repo.delete(uuid.uuid4())
        assert deleted is False


# ---------------------------------------------------------------------------
# Rule Evaluation Tests (unit tests — no DB)
# ---------------------------------------------------------------------------


class TestRuleEvaluation:
    def _make_rule(self, **kwargs):
        from types import SimpleNamespace

        defaults = {
            "id": uuid.uuid4(),
            "policy_id": uuid.uuid4(),
            "tag_name": "team",
            "value_type": "string",
            "allowed_values": None,
            "equivalence_groups": None,
            "default_value": None,
            "applicable_resource_types": None,
            "applicable_accounts": None,
        }
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def _make_resource(self, **kwargs):
        from types import SimpleNamespace

        defaults = {
            "id": uuid.uuid4(),
            "workspace_id": WORKSPACE_ID,
            "account_id": "111111111111",
            "region": "us-east-1",
            "service": "ec2",
            "resource_type": "instance",
            "resource_id": "i-test",
            "arn": None,
            "name": "test",
            "state": "running",
            "tags": {},
        }
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def test_rule_applies_no_filters(self):
        rule = self._make_rule()
        resource = self._make_resource()
        assert _rule_applies_to_resource(rule, resource) is True

    def test_rule_applies_matching_service(self):
        rule = self._make_rule(applicable_resource_types=["ec2"])
        resource = self._make_resource(service="ec2")
        assert _rule_applies_to_resource(rule, resource) is True

    def test_rule_does_not_apply_different_service(self):
        rule = self._make_rule(applicable_resource_types=["rds"])
        resource = self._make_resource(service="ec2")
        assert _rule_applies_to_resource(rule, resource) is False

    def test_rule_applies_matching_account(self):
        rule = self._make_rule(applicable_accounts=["111111111111"])
        resource = self._make_resource(account_id="111111111111")
        assert _rule_applies_to_resource(rule, resource) is True

    def test_rule_does_not_apply_different_account(self):
        rule = self._make_rule(applicable_accounts=["222222222222"])
        resource = self._make_resource(account_id="111111111111")
        assert _rule_applies_to_resource(rule, resource) is False

    def test_evaluate_compliant(self):
        rule = self._make_rule(tag_name="team")
        resource = self._make_resource(tags={"team": "platform"})
        status, value = _evaluate_rule(rule, resource)
        assert status == "compliant"
        assert value == "platform"

    def test_evaluate_missing_tag(self):
        rule = self._make_rule(tag_name="team")
        resource = self._make_resource(tags={})
        status, value = _evaluate_rule(rule, resource)
        assert status == "missing_tag"
        assert value is None

    def test_evaluate_missing_tag_no_tags(self):
        rule = self._make_rule(tag_name="team")
        resource = self._make_resource(tags=None)
        status, value = _evaluate_rule(rule, resource)
        assert status == "missing_tag"
        assert value is None

    def test_evaluate_enum_valid(self):
        rule = self._make_rule(
            tag_name="env", value_type="enum", allowed_values=["prod", "staging"]
        )
        resource = self._make_resource(tags={"env": "prod"})
        status, value = _evaluate_rule(rule, resource)
        assert status == "compliant"

    def test_evaluate_enum_invalid(self):
        rule = self._make_rule(
            tag_name="env", value_type="enum", allowed_values=["prod", "staging"]
        )
        resource = self._make_resource(tags={"env": "development"})
        status, value = _evaluate_rule(rule, resource)
        assert status == "invalid_value"
        assert value == "development"

    def test_evaluate_email_valid(self):
        rule = self._make_rule(tag_name="owner", value_type="email")
        resource = self._make_resource(tags={"owner": "user@example.com"})
        status, _ = _evaluate_rule(rule, resource)
        assert status == "compliant"

    def test_evaluate_email_invalid(self):
        rule = self._make_rule(tag_name="owner", value_type="email")
        resource = self._make_resource(tags={"owner": "not-an-email"})
        status, value = _evaluate_rule(rule, resource)
        assert status == "invalid_value"

    def test_evaluate_numeric_valid(self):
        rule = self._make_rule(tag_name="cost_center", value_type="numeric")
        resource = self._make_resource(tags={"cost_center": "12345"})
        status, _ = _evaluate_rule(rule, resource)
        assert status == "compliant"

    def test_evaluate_numeric_invalid(self):
        rule = self._make_rule(tag_name="cost_center", value_type="numeric")
        resource = self._make_resource(tags={"cost_center": "abc"})
        status, _ = _evaluate_rule(rule, resource)
        assert status == "invalid_value"

    def test_evaluate_date_valid(self):
        rule = self._make_rule(tag_name="created", value_type="date")
        resource = self._make_resource(tags={"created": "2026-03-25"})
        status, _ = _evaluate_rule(rule, resource)
        assert status == "compliant"

    def test_evaluate_date_invalid(self):
        rule = self._make_rule(tag_name="created", value_type="date")
        resource = self._make_resource(tags={"created": "March 25, 2026"})
        status, _ = _evaluate_rule(rule, resource)
        assert status == "invalid_value"

    def test_rule_applies_service_resource_type_combo(self):
        rule = self._make_rule(applicable_resource_types=["ec2/instance"])
        resource = self._make_resource(service="ec2", resource_type="instance")
        assert _rule_applies_to_resource(rule, resource) is True

    def test_rule_does_not_apply_wrong_combo(self):
        rule = self._make_rule(applicable_resource_types=["ec2/instance"])
        resource = self._make_resource(service="ebs", resource_type="volume")
        assert _rule_applies_to_resource(rule, resource) is False


class TestEquivalenceGroupDrift:
    """Drift detection via per-rule equivalence groups (spec §5.6, §7.3)."""

    def _make_rule(self, **kwargs):
        from types import SimpleNamespace

        defaults = {
            "id": uuid.uuid4(),
            "policy_id": uuid.uuid4(),
            "tag_name": "env",
            "value_type": "enum",
            "allowed_values": ["production", "staging"],
            "equivalence_groups": [["production", "prod"]],
            "default_value": None,
            "applicable_resource_types": None,
            "applicable_accounts": None,
        }
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def _make_resource(self, tags):
        from types import SimpleNamespace

        return SimpleNamespace(
            id=uuid.uuid4(),
            workspace_id=WORKSPACE_ID,
            account_id="111111111111",
            region="us-east-1",
            service="ec2",
            resource_type="instance",
            resource_id="i-test",
            arn=None,
            name="test",
            state="running",
            tags=tags,
        )

    def test_canonical_value_is_compliant(self):
        rule = self._make_rule()
        status, value = _evaluate_rule(rule, self._make_resource({"env": "production"}))
        assert status == "compliant"
        assert value == "production"

    def test_non_canonical_member_is_drift_and_records_value(self):
        rule = self._make_rule()
        status, value = _evaluate_rule(rule, self._make_resource({"env": "prod"}))
        assert status == "drift"
        assert value == "prod"

    def test_value_absent_from_groups_under_enum_is_invalid(self):
        rule = self._make_rule()
        status, value = _evaluate_rule(rule, self._make_resource({"env": "qa"}))
        assert status == "invalid_value"
        assert value == "qa"

    def test_second_group_member_is_drift(self):
        rule = self._make_rule(
            allowed_values=None,
            value_type="string",
            equivalence_groups=[["production", "prod"], ["ml-platform", "ml"]],
        )
        status, value = _evaluate_rule(rule, self._make_resource({"env": "ml"}))
        assert status == "drift"
        assert value == "ml"

    def test_no_equivalence_groups_falls_back_to_invalid(self):
        rule = self._make_rule(equivalence_groups=None)
        status, value = _evaluate_rule(rule, self._make_resource({"env": "prod"}))
        assert status == "invalid_value"

    def test_missing_tag_is_unaffected_by_groups(self):
        rule = self._make_rule()
        status, value = _evaluate_rule(rule, self._make_resource({}))
        assert status == "missing_tag"
        assert value is None


# ---------------------------------------------------------------------------
# Compliance Audit Integration Tests
# ---------------------------------------------------------------------------


class TestComplianceAudit:
    async def test_audit_with_policy_and_resources(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Full audit: 4 EC2 instances, 1 S3 bucket, policy applies to EC2 only."""
        audit_run_id, result_count = await run_compliance_audit(db_session, WORKSPACE_ID)
        assert audit_run_id is not None
        # 4 EC2 resources × 2 rules = 8 evaluations (S3 excluded by resource type filter)
        assert result_count == 8

    async def test_audit_cost_weighted_scoring(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Verify cost-weighted compliance score reflects dollar impact."""
        audit_run_id, _ = await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        overall = await repo.get_latest_snapshot("overall")
        assert overall is not None

        # Only resource i-001 ($1000) is fully compliant (both team and env tags present+valid)
        # Total applicable cost: $1000 + $500 + $200 + $50 = $1750
        # Score: $1000 / $1750 * 100 ≈ 57.1429%
        assert overall.compliant_cost == Decimal("1000.0000000000")
        assert overall.total_cost == Decimal("1750.0000000000")
        assert overall.cost_weighted_score == Decimal("57.1429")

    async def test_audit_resource_counts(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Verify resource counts in overall snapshot."""
        await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        overall = await repo.get_latest_snapshot("overall")

        # 4 EC2 resources are applicable, 1 is fully compliant
        assert overall.total_resources == 4
        assert overall.compliant_resources == 1

    async def test_audit_per_tag_scores(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Verify per-tag compliance scores."""
        await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        tag_scores = await repo.get_latest_snapshots_by_dimension("per_tag")
        tag_map = {s.dimension_value: s for s in tag_scores}

        # "team" tag: i-001 ($1000), i-002 ($500), i-003 ($200) have it; i-004 ($50) doesn't
        # team compliance cost: $1700 / $1750 * 100
        team = tag_map["team"]
        assert team.compliant_resources == 3
        assert team.total_resources == 4

        # "environment" tag: only i-001 ($1000) has valid value (prod)
        # i-002 missing, i-003 has invalid value, i-004 missing
        env = tag_map["environment"]
        assert env.compliant_resources == 1
        assert env.total_resources == 4

    async def test_audit_no_policies(self, db_session, sample_resources):
        """Audit with no active policies produces 0 results."""
        _, count = await run_compliance_audit(db_session, WORKSPACE_ID)
        assert count == 0

    async def test_audit_no_resources(self, db_session, sample_policy):
        """Audit with no resources produces 0 results."""
        _, count = await run_compliance_audit(db_session, WORKSPACE_ID)
        assert count == 0

    async def test_audit_idempotent(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Re-running audit with same run ID produces same results."""
        run_id = uuid.uuid4()
        _, count1 = await run_compliance_audit(db_session, WORKSPACE_ID, run_id)
        _, count2 = await run_compliance_audit(db_session, WORKSPACE_ID, run_id)
        assert count1 == count2

    async def test_audit_zero_cost_resources(
        self,
        db_session,
        sample_policy,
        sample_resources,
    ):
        """Resources with no cost record are evaluated but have $0 weight."""
        # No cost records created — all resources have $0 cost
        await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        overall = await repo.get_latest_snapshot("overall")
        assert overall is not None
        assert overall.total_cost == Decimal("0")
        # With zero cost, score falls back to resource count ratio
        # 1 compliant / 4 applicable = 25%
        assert overall.cost_weighted_score == Decimal("25.0000")

    async def test_audit_per_account_snapshot(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Verify per-account snapshots are produced."""
        await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        account_scores = await repo.get_latest_snapshots_by_dimension("per_account")
        assert len(account_scores) == 1
        assert account_scores[0].dimension_value == "111111111111"

    async def test_audit_per_resource_type_snapshot(
        self,
        db_session,
        sample_policy,
        sample_resources,
        sample_cost_records,
    ):
        """Verify per-resource-type snapshots are produced."""
        await run_compliance_audit(db_session, WORKSPACE_ID)

        repo = ComplianceRepository(db_session, WORKSPACE_ID)
        rt_scores = await repo.get_latest_snapshots_by_dimension("per_resource_type")
        # Only ec2/instance should have results (s3/bucket excluded by policy)
        assert len(rt_scores) == 1
        assert rt_scores[0].dimension_value == "ec2/instance"

    async def test_drift_surfaces_in_non_compliant(self, db_session, policy_repo):
        """A non-canonical equivalence value is recorded as drift and listed
        among non-compliant results (spec §5.6, §7.3; task A1/A7)."""
        await policy_repo.create(
            TagPolicyCreate(
                name="Env Equivalence",
                rules=[
                    TagPolicyRuleCreate(
                        tag_name="env",
                        value_type=ValueType.enum,
                        allowed_values=["production", "staging"],
                        equivalence_groups=[["production", "prod"]],
                        applicable_resource_types=["ec2"],
                    )
                ],
            )
        )
        for rid, env in [("i-canon", "production"), ("i-drift", "prod")]:
            db_session.add(
                CloudResource(
                    id=uuid.uuid4(),
                    workspace_id=WORKSPACE_ID,
                    account_id="111111111111",
                    region="us-east-1",
                    service="ec2",
                    resource_type="instance",
                    resource_id=rid,
                    name=rid,
                    tags={"env": env},
                )
            )
        await db_session.flush()

        await run_compliance_audit(db_session, WORKSPACE_ID)

        comp_repo = ComplianceRepository(db_session, WORKSPACE_ID)
        results, count, _ = await comp_repo.get_non_compliant_results()
        statuses = {r.status for r in results}
        assert "drift" in statuses
        # The canonical resource is compliant, so it is absent from the list.
        assert count == 1
        drift_row = next(r for r in results if r.status == "drift")
        assert drift_row.current_value == "prod"


# ---------------------------------------------------------------------------
# Multi-policy Tests
# ---------------------------------------------------------------------------


class TestMultiPolicy:
    async def test_overlapping_policies(self, db_session, sample_resources, sample_cost_records):
        """Two policies with overlapping scopes produce independent evaluations."""
        repo = TagPolicyRepository(db_session, WORKSPACE_ID)

        # Policy A: env must be prod or staging
        await repo.create(
            TagPolicyCreate(
                name="Policy A",
                rules=[
                    TagPolicyRuleCreate(
                        tag_name="environment",
                        value_type=ValueType.enum,
                        allowed_values=["prod", "staging"],
                        applicable_resource_types=["ec2"],
                    )
                ],
            )
        )

        # Policy B: env must be dev or staging
        await repo.create(
            TagPolicyCreate(
                name="Policy B",
                rules=[
                    TagPolicyRuleCreate(
                        tag_name="environment",
                        value_type=ValueType.enum,
                        allowed_values=["dev", "staging"],
                        applicable_resource_types=["ec2"],
                    )
                ],
            )
        )

        audit_run_id, result_count = await run_compliance_audit(db_session, WORKSPACE_ID)

        # 4 EC2 resources × 2 policies × 1 rule each = 8 results
        assert result_count == 8

        # Check per-policy snapshots
        comp_repo = ComplianceRepository(db_session, WORKSPACE_ID)
        policy_scores = await comp_repo.get_latest_snapshots_by_dimension("per_policy")
        score_map = {s.dimension_value: s for s in policy_scores}

        # Policy A: i-001 (env=prod) compliant, others not → 1 compliant
        assert score_map["Policy A"].compliant_resources == 1
        # Policy B: none have env=dev or env=staging → 0 compliant
        assert score_map["Policy B"].compliant_resources == 0


# ---------------------------------------------------------------------------
# API Endpoint Tests
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(db_session):
    """Async HTTP client for testing API endpoints."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


class TestTagPolicyAPI:
    async def test_create_policy(self, client):
        resp = await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "API Test Policy",
                "rules": [
                    {"tag_name": "team", "value_type": "string"},
                    {"tag_name": "env", "value_type": "enum", "allowed_values": ["prod", "dev"]},
                ],
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "API Test Policy"
        assert len(body["rules"]) == 2

    async def test_list_policies(self, client):
        # Create two policies
        await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "P1",
                "rules": [{"tag_name": "t1"}],
            },
        )
        await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "P2",
                "rules": [{"tag_name": "t2"}],
            },
        )

        resp = await client.get("/api/v1/tag-policies")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] >= 2

    async def test_get_policy(self, client):
        create_resp = await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "Detail",
                "rules": [{"tag_name": "t"}],
            },
        )
        policy_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/tag-policies/{policy_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Detail"

    async def test_get_policy_not_found(self, client):
        resp = await client.get(f"/api/v1/tag-policies/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_update_policy(self, client):
        create_resp = await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "Before",
                "rules": [{"tag_name": "t"}],
            },
        )
        policy_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/v1/tag-policies/{policy_id}",
            json={
                "name": "After",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "After"

    async def test_delete_policy(self, client):
        create_resp = await client.post(
            "/api/v1/tag-policies",
            json={
                "name": "ToDelete",
                "rules": [{"tag_name": "t"}],
            },
        )
        policy_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/tag-policies/{policy_id}")
        assert resp.status_code == 204

        resp = await client.get(f"/api/v1/tag-policies/{policy_id}")
        assert resp.status_code == 404


class TestComplianceAPI:
    async def test_summary_no_audit(self, client):
        resp = await client.get("/api/v1/compliance/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["overall"] is None
        assert body["total_resources"] == 0

    async def test_by_dimension_invalid(self, client):
        resp = await client.get("/api/v1/compliance/by-dimension?dimension=invalid")
        assert resp.status_code == 400

    async def test_trend_empty(self, client):
        resp = await client.get("/api/v1/compliance/trend")
        assert resp.status_code == 200
        body = resp.json()
        assert body["trend"] == []

    async def test_non_compliant_empty(self, client):
        resp = await client.get("/api/v1/compliance/non-compliant")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
