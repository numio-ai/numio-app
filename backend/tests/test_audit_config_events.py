"""Tests for audit trail — repository and route registration."""

import pytest

from numio.db.audit_config_event_repository import AuditConfigEventRepository

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo(db_session):
    return AuditConfigEventRepository(db_session, WORKSPACE_ID)


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_audit_event(repo):
    event = await repo.create(
        user="admin@test.com",
        action="policy_created",
        entity_type="infra_policy",
        entity_id="policy-123",
    )
    assert event.user == "admin@test.com"
    assert event.action == "policy_created"
    assert event.entity_type == "infra_policy"
    assert event.entity_id == "policy-123"


@pytest.mark.asyncio
async def test_create_audit_event_with_before_after(repo):
    event = await repo.create(
        user="admin@test.com",
        action="policy_modified",
        entity_type="infra_policy",
        entity_id="policy-123",
        before_value={"name": "old name", "amount": 100},
        after_value={"name": "new name", "amount": 200},
    )
    assert event.before_value == {"name": "old name", "amount": 100}
    assert event.after_value == {"name": "new name", "amount": 200}


@pytest.mark.asyncio
async def test_list_audit_events(repo):
    await repo.create(user="user1", action="policy_created", entity_type="policy")
    await repo.create(user="user2", action="budget_created", entity_type="budget")

    events, total = await repo.list_all()
    assert total == 2
    assert len(events) == 2


@pytest.mark.asyncio
async def test_filter_by_user(repo):
    await repo.create(user="user1", action="policy_created", entity_type="policy")
    await repo.create(user="user2", action="budget_created", entity_type="budget")

    events, total = await repo.list_all(user="user1")
    assert total == 1
    assert events[0].user == "user1"


@pytest.mark.asyncio
async def test_filter_by_action(repo):
    await repo.create(user="user1", action="policy_created", entity_type="policy")
    await repo.create(user="user1", action="policy_modified", entity_type="policy")

    events, total = await repo.list_all(action="policy_modified")
    assert total == 1
    assert events[0].action == "policy_modified"


@pytest.mark.asyncio
async def test_filter_by_entity_type(repo):
    await repo.create(user="user1", action="policy_created", entity_type="policy")
    await repo.create(user="user1", action="budget_created", entity_type="budget")

    events, total = await repo.list_all(entity_type="budget")
    assert total == 1
    assert events[0].entity_type == "budget"


# ---------------------------------------------------------------------------
# Route registration tests
# ---------------------------------------------------------------------------


def test_audit_config_event_routes_registered():
    """Verify audit event endpoints are registered in the app."""
    from numio.main import app

    paths = [route.path for route in app.routes]
    assert "/api/v1/audit-config-events" in paths
