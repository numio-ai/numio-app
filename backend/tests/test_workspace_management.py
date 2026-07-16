"""Tests for workspace settings, user management, API keys, and Andon cord."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(db_session):
    """Async HTTP client with DB session override and auth bypass."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


# ---------------------------------------------------------------------------
# Workspace settings
# ---------------------------------------------------------------------------


class TestWorkspaceSettings:
    async def test_get_settings(self, client):
        resp = await client.get("/api/v1/workspace/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "default"
        assert data["default_currency"] == "USD"
        assert data["timezone"] == "UTC"
        assert data["data_retention_days"] == 365
        assert data["automation_paused"] is False

    async def test_update_settings(self, client):
        resp = await client.put(
            "/api/v1/workspace/settings",
            json={"name": "My Workspace", "default_currency": "EUR", "timezone": "US/Eastern"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "My Workspace"
        assert data["default_currency"] == "EUR"
        assert data["timezone"] == "US/Eastern"

    async def test_update_partial(self, client):
        resp = await client.put(
            "/api/v1/workspace/settings",
            json={"data_retention_days": 90},
        )
        assert resp.status_code == 200
        assert resp.json()["data_retention_days"] == 90

    async def test_update_invalid_retention(self, client):
        resp = await client.put(
            "/api/v1/workspace/settings",
            json={"data_retention_days": 5},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


class TestUserManagement:
    async def test_list_users(self, client):
        resp = await client.get("/api/v1/users")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1  # At least the bypass admin user

    @patch("numio.api.users._create_cognito_user", new_callable=AsyncMock, return_value=None)
    async def test_invite_user(self, mock_cognito, client):
        resp = await client.post(
            "/api/v1/users",
            json={"email": "newuser@example.com", "name": "New User", "role": "editor"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "editor"
        assert data["is_active"] is True

    @patch("numio.api.users._create_cognito_user", new_callable=AsyncMock, return_value=None)
    async def test_invite_duplicate_email(self, mock_cognito, client):
        await client.post(
            "/api/v1/users",
            json={"email": "duplicate@example.com", "name": "User A", "role": "viewer"},
        )
        resp = await client.post(
            "/api/v1/users",
            json={"email": "duplicate@example.com", "name": "User B", "role": "viewer"},
        )
        assert resp.status_code == 409

    @patch("numio.api.users._create_cognito_user", new_callable=AsyncMock, return_value=None)
    async def test_update_user_role(self, mock_cognito, client):
        create_resp = await client.post(
            "/api/v1/users",
            json={"email": "rolechange@example.com", "name": "Role User", "role": "viewer"},
        )
        user_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/users/{user_id}", json={"role": "admin"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    @patch("numio.api.users._create_cognito_user", new_callable=AsyncMock, return_value=None)
    async def test_deactivate_user(self, mock_cognito, client):
        create_resp = await client.post(
            "/api/v1/users",
            json={"email": "deactivate@example.com", "name": "Deactivate Me", "role": "viewer"},
        )
        user_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/users/{user_id}", json={"is_active": False})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_update_nonexistent_user(self, client):
        resp = await client.put(f"/api/v1/users/{uuid.uuid4()}", json={"role": "editor"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# API keys — self-service
# ---------------------------------------------------------------------------


class TestApiKeySelfService:
    async def test_create_and_list_api_key(self, client):
        create_resp = await client.post(
            "/api/v1/users/me/api-keys",
            json={"name": "Test Key"},
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        assert data["name"] == "Test Key"
        assert "key" in data  # Raw key shown once
        assert data["key"].startswith("numi_")

        list_resp = await client.get("/api/v1/users/me/api-keys")
        assert list_resp.status_code == 200
        assert list_resp.json()["count"] >= 1

    async def test_revoke_api_key(self, client):
        create_resp = await client.post(
            "/api/v1/users/me/api-keys",
            json={"name": "Revoke Me"},
        )
        key_id = create_resp.json()["id"]

        revoke_resp = await client.delete(f"/api/v1/users/me/api-keys/{key_id}")
        assert revoke_resp.status_code == 204

        # Key should no longer appear in list
        list_resp = await client.get("/api/v1/users/me/api-keys")
        key_ids = [k["id"] for k in list_resp.json()["keys"]]
        assert key_id not in key_ids

    async def test_revoke_nonexistent_key(self, client):
        resp = await client.delete(f"/api/v1/users/me/api-keys/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# API keys — admin view
# ---------------------------------------------------------------------------


class TestApiKeyAdmin:
    async def test_admin_list_all_keys(self, client):
        # Create a key first
        await client.post(
            "/api/v1/users/me/api-keys",
            json={"name": "Admin View Key"},
        )

        resp = await client.get("/api/v1/users/api-keys")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1
        # Admin view includes user_email
        assert data["keys"][0]["user_email"] is not None

    async def test_admin_revoke_any_key(self, client):
        create_resp = await client.post(
            "/api/v1/users/me/api-keys",
            json={"name": "Admin Revoke"},
        )
        key_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/users/api-keys/{key_id}")
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Andon cord — automation safety toggles
# ---------------------------------------------------------------------------


class TestAndonCord:
    async def test_get_automation_status(self, client):
        resp = await client.get("/api/v1/workspace/automation")
        assert resp.status_code == 200
        data = resp.json()
        assert data["automation_paused"] is False
        assert data["domain_toggles"] == []

    async def test_set_global_toggle(self, client):
        resp = await client.put(
            "/api/v1/workspace/automation/global",
            json={"paused": True},
        )
        assert resp.status_code == 200
        assert resp.json()["automation_paused"] is True

        # Verify persisted
        get_resp = await client.get("/api/v1/workspace/automation")
        assert get_resp.json()["automation_paused"] is True

        # Turn back off
        resp = await client.put(
            "/api/v1/workspace/automation/global",
            json={"paused": False},
        )
        assert resp.json()["automation_paused"] is False

    async def test_set_domain_toggle(self, client):
        resp = await client.put(
            "/api/v1/workspace/automation/domain",
            json={"domain": "zombie_detection", "paused": True},
        )
        assert resp.status_code == 200
        toggles = {t["domain"]: t["paused"] for t in resp.json()["domain_toggles"]}
        assert toggles["zombie_detection"] is True

    async def test_domain_toggles_independent(self, client):
        await client.put(
            "/api/v1/workspace/automation/domain",
            json={"domain": "budget_alerts", "paused": True},
        )
        await client.put(
            "/api/v1/workspace/automation/domain",
            json={"domain": "anomaly_detection", "paused": False},
        )

        resp = await client.get("/api/v1/workspace/automation")
        toggles = {t["domain"]: t["paused"] for t in resp.json()["domain_toggles"]}
        assert toggles["budget_alerts"] is True
        assert toggles["anomaly_detection"] is False

    async def test_domain_toggle_update_existing(self, client):
        await client.put(
            "/api/v1/workspace/automation/domain",
            json={"domain": "policy_evaluation", "paused": True},
        )
        resp = await client.put(
            "/api/v1/workspace/automation/domain",
            json={"domain": "policy_evaluation", "paused": False},
        )
        toggles = {t["domain"]: t["paused"] for t in resp.json()["domain_toggles"]}
        assert toggles["policy_evaluation"] is False


# ---------------------------------------------------------------------------
# Andon cord — notification suppression
# ---------------------------------------------------------------------------


class TestAndonCordNotificationIntegration:
    async def test_notification_suppressed_when_global_paused(
        self, db_session, default_workspace_id
    ):
        # Pause automation globally
        from sqlalchemy import select

        from numio.core.notification_service import NotificationService
        from numio.models.workspace import Workspace

        ws_result = await db_session.execute(
            select(Workspace).where(Workspace.id == default_workspace_id)
        )
        ws = ws_result.scalar_one()
        ws.automation_paused = True
        await db_session.flush()

        svc = NotificationService(db_session, default_workspace_id)
        result = await svc.create_notification(
            event_type="budget_alert",
            title="Budget exceeded",
        )
        assert result is None

    async def test_notification_suppressed_when_domain_paused(
        self, db_session, default_workspace_id
    ):
        from numio.core.notification_service import NotificationService
        from numio.models.workspace import AutomationToggle

        toggle = AutomationToggle(
            workspace_id=default_workspace_id,
            domain="zombie_detection",
            paused=True,
        )
        db_session.add(toggle)
        await db_session.flush()

        svc = NotificationService(db_session, default_workspace_id)
        result = await svc.create_notification(
            event_type="zombie_found",
            title="Zombie resource detected",
        )
        assert result is None

    async def test_notification_not_suppressed_when_different_domain_paused(
        self, db_session, default_workspace_id
    ):
        from numio.core.notification_service import NotificationService
        from numio.models.workspace import AutomationToggle

        toggle = AutomationToggle(
            workspace_id=default_workspace_id,
            domain="zombie_detection",
            paused=True,
        )
        db_session.add(toggle)
        await db_session.flush()

        svc = NotificationService(db_session, default_workspace_id)
        result = await svc.create_notification(
            event_type="budget_alert",
            title="Budget exceeded",
        )
        assert result is not None
