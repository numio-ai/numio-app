"""Tests for notification engine — repository, service, preferences, and route registration."""

import uuid

import pytest

from numio.core.notification_service import NotificationService
from numio.db.notification_repository import (
    NotificationPreferenceRepository,
    NotificationRepository,
)

WORKSPACE_ID = "default"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo(db_session, default_workspace_id):
    return NotificationRepository(db_session, default_workspace_id)


@pytest.fixture
def pref_repo(db_session, default_workspace_id):
    return NotificationPreferenceRepository(db_session, default_workspace_id)


@pytest.fixture
def service(db_session, default_workspace_id):
    return NotificationService(db_session, default_workspace_id)


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_notification(repo):
    notification = await repo.create(
        event_type="budget_alert",
        title="Budget exceeded",
        message="Budget 'Infra' exceeded 80%",
        entity_type="budget",
        entity_id=str(uuid.uuid4()),
    )
    assert notification.event_type == "budget_alert"
    assert notification.title == "Budget exceeded"
    assert notification.is_read is False


@pytest.mark.asyncio
async def test_list_notifications(repo):
    await repo.create(event_type="budget_alert", title="Alert 1")
    await repo.create(event_type="anomaly_detected", title="Alert 2")

    notifications, total = await repo.list_all()
    assert total == 2
    assert len(notifications) == 2
    titles = {n.title for n in notifications}
    assert titles == {"Alert 1", "Alert 2"}


@pytest.mark.asyncio
async def test_list_unread_only(repo):
    n1 = await repo.create(event_type="budget_alert", title="Alert 1")
    await repo.create(event_type="anomaly_detected", title="Alert 2")
    await repo.mark_read(n1.id)

    unread, total = await repo.list_all(unread_only=True)
    assert total == 1
    assert unread[0].title == "Alert 2"


@pytest.mark.asyncio
async def test_mark_read(repo):
    notification = await repo.create(event_type="budget_alert", title="Alert")
    assert notification.is_read is False

    updated = await repo.mark_read(notification.id)
    assert updated is True

    count = await repo.unread_count()
    assert count == 0


@pytest.mark.asyncio
async def test_mark_read_nonexistent(repo):
    updated = await repo.mark_read(uuid.uuid4())
    assert updated is False


@pytest.mark.asyncio
async def test_mark_all_read(repo):
    await repo.create(event_type="budget_alert", title="Alert 1")
    await repo.create(event_type="anomaly_detected", title="Alert 2")

    count_before = await repo.unread_count()
    assert count_before == 2

    updated = await repo.mark_all_read()
    assert updated == 2

    count_after = await repo.unread_count()
    assert count_after == 0


@pytest.mark.asyncio
async def test_unread_count(repo):
    await repo.create(event_type="budget_alert", title="Alert 1")
    await repo.create(event_type="budget_alert", title="Alert 2")
    await repo.create(event_type="budget_alert", title="Alert 3")

    count = await repo.unread_count()
    assert count == 3


# ---------------------------------------------------------------------------
# Preferences tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_default_preferences(pref_repo):
    prefs = await pref_repo.get_preferences("user1")
    # All event types should default to True
    assert prefs["budget_alert"] is True
    assert prefs["anomaly_detected"] is True
    assert prefs["zombie_found"] is True
    assert prefs["policy_violation"] is True
    assert prefs["recommendation_generated"] is True


@pytest.mark.asyncio
async def test_set_preference(pref_repo):
    await pref_repo.set_preference("user1", "budget_alert", False)
    prefs = await pref_repo.get_preferences("user1")
    assert prefs["budget_alert"] is False
    assert prefs["anomaly_detected"] is True  # others unchanged


@pytest.mark.asyncio
async def test_is_enabled_default(pref_repo):
    enabled = await pref_repo.is_enabled("user1", "budget_alert")
    assert enabled is True


@pytest.mark.asyncio
async def test_is_enabled_after_disable(pref_repo):
    await pref_repo.set_preference("user1", "budget_alert", False)
    enabled = await pref_repo.is_enabled("user1", "budget_alert")
    assert enabled is False


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_create_notification(service, repo):
    notification = await service.create_notification(
        event_type="anomaly_detected",
        title="Cost spike detected",
        entity_type="finding",
        entity_id="test-123",
    )
    assert notification.event_type == "anomaly_detected"
    assert notification.title == "Cost spike detected"

    count = await repo.unread_count()
    assert count == 1


# ---------------------------------------------------------------------------
# Route registration tests
# ---------------------------------------------------------------------------


def test_notification_routes_registered():
    """Verify notification endpoints are registered in the app."""
    from numio.main import app

    paths = [route.path for route in app.routes]
    assert "/api/v1/notifications" in paths
    assert "/api/v1/notifications/unread-count" in paths
    assert "/api/v1/notifications/read-all" in paths
    assert "/api/v1/notifications/stream" in paths
    assert "/api/v1/notifications/preferences" in paths
