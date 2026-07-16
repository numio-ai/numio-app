"""Tests for authentication: auth bypass, session tokens, API keys, role-based access."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from numio.core.auth import (
    AuthenticatedUser,
    create_session_token,
    decode_session_token,
    generate_api_key,
    hash_api_key,
)
from numio.models.user import User
from numio.models.workspace import Workspace

# ---------------------------------------------------------------------------
# Unit tests: session tokens
# ---------------------------------------------------------------------------


class TestSessionTokens:
    def test_create_and_decode_session_token(self):
        user = AuthenticatedUser(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            email="test@example.com",
            name="Test User",
            role="admin",
        )
        token = create_session_token(user)
        claims = decode_session_token(token)
        assert claims["email"] == "test@example.com"
        assert claims["role"] == "admin"
        assert claims["sub"] == str(user.id)

    def test_decode_invalid_token_raises(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            decode_session_token("invalid.token.value")
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Unit tests: API key hashing
# ---------------------------------------------------------------------------


class TestApiKeyHashing:
    def test_generate_api_key_format(self):
        raw, key_hash = generate_api_key()
        assert raw.startswith("numi_")
        assert len(key_hash) == 64  # SHA-256 hex

    def test_hash_api_key_matches(self):
        raw, key_hash = generate_api_key()
        assert hash_api_key(raw) == key_hash

    def test_different_keys_different_hashes(self):
        _, h1 = generate_api_key()
        _, h2 = generate_api_key()
        assert h1 != h2


# ---------------------------------------------------------------------------
# Integration tests: auth bypass mode
# ---------------------------------------------------------------------------


class TestAuthBypass:
    """When AUTH_ENABLED=false, all endpoints should work without authentication."""

    @pytest.fixture
    async def client(self, db_session):
        from numio.db.session import get_session
        from numio.main import app

        async def _override():
            yield db_session

        app.dependency_overrides[get_session] = _override
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)

    async def test_me_returns_bypass_admin(self, client):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@localhost"
        assert data["role"] == "admin"
        assert data["name"] == "Local Admin"

    async def test_protected_endpoint_works_without_auth(self, client):
        resp = await client.get("/api/v1/budgets")
        # Should return 200 (empty list), not 401
        assert resp.status_code == 200


class TestAuthBypassSetupGuard:
    """Regression guard for tasks/done/20260419_cognito_not_configured_warning*.

    The user-visible failure ("Cognito is not configured" on the Login page)
    is the downstream effect of `/api/v1/auth/me` not returning the bypass
    admin in a fresh worktree. The two conditions below are the ones that
    landed in the bug report: schema migrated but no default workspace row.
    Both must fail loudly so the dev-runbook SOP can recover — not silently
    redirect the user to a dead-end login.
    """

    @pytest.fixture
    async def client(self, db_session):
        from numio.db.session import get_session
        from numio.main import app

        async def _override():
            yield db_session

        app.dependency_overrides[get_session] = _override
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)

    async def test_me_surfaces_clear_error_when_default_workspace_missing(self, client, db_session):
        """Delete the default workspace and confirm /me returns a recognisable
        server error pointing the operator at the seed step. This prevents a
        future refactor from silently returning 200 / 401 / an opaque 500."""
        # Remove any related rows first so the workspace delete does not
        # violate FK constraints.
        from numio.models.api_key import ApiKey

        await db_session.execute(User.__table__.delete())
        await db_session.execute(ApiKey.__table__.delete())
        await db_session.execute(Workspace.__table__.delete().where(Workspace.slug == "default"))
        await db_session.commit()

        resp = await client.get("/api/v1/auth/me")

        assert resp.status_code >= 500, (
            "Missing default workspace must fail loudly (5xx), not silently "
            "redirect the frontend to /login."
        )
        body = resp.json()
        message = (body.get("detail") or body.get("message") or "").lower()
        assert "workspace" in message or "seed" in message, (
            f"Error must hint at the missing default workspace / seed step; got: {body!r}"
        )


# ---------------------------------------------------------------------------
# Integration tests: API key authentication
# ---------------------------------------------------------------------------


class TestApiKeyAuth:
    @pytest.fixture
    async def client(self, db_session):
        from numio.db.session import get_session
        from numio.main import app

        async def _override():
            yield db_session

        app.dependency_overrides[get_session] = _override
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)

    async def test_create_api_key(self, client):
        """API key creation works in bypass mode (authenticated as admin)."""
        resp = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "test-key"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-key"
        assert data["key"].startswith("numi_")
        assert data["key_prefix"]


# ---------------------------------------------------------------------------
# Integration tests: role-based access
# ---------------------------------------------------------------------------


class TestRoleBasedAccess:
    """Test that role guards return 403 for insufficient roles."""

    @pytest.fixture
    async def viewer_token(self, db_session):
        """Create a viewer user and return a session token."""
        ws_result = await db_session.execute(select(Workspace).where(Workspace.slug == "default"))
        workspace = ws_result.scalar_one()

        user = User(
            workspace_id=workspace.id,
            email=f"viewer-{uuid.uuid4().hex[:8]}@test.com",
            name="Test Viewer",
            role="viewer",
        )
        db_session.add(user)
        await db_session.flush()

        auth_user = AuthenticatedUser(
            id=user.id,
            workspace_id=user.workspace_id,
            email=user.email,
            name=user.name,
            role=user.role,
        )
        return create_session_token(auth_user)

    @pytest.fixture
    async def client_with_auth(self, db_session):
        """Client factory that requires explicit auth."""
        from numio.core.config import settings
        from numio.db.session import get_session
        from numio.main import app

        # Temporarily enable auth for these tests
        original = settings.auth_enabled
        settings.auth_enabled = True

        async def _override():
            yield db_session

        app.dependency_overrides[get_session] = _override
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)
        settings.auth_enabled = original

    async def test_viewer_can_read(self, client_with_auth, viewer_token):
        resp = await client_with_auth.get(
            "/api/v1/budgets",
            cookies={"numio_session": viewer_token},
        )
        assert resp.status_code == 200

    async def test_viewer_cannot_create_budget(self, client_with_auth, viewer_token):
        resp = await client_with_auth.post(
            "/api/v1/budgets",
            json={
                "name": "test",
                "scope_type": "service",
                "scope_value": "EC2",
                "amount": 1000,
                "period": "monthly",
                "alert_thresholds": [80],
            },
            cookies={"numio_session": viewer_token},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, client_with_auth):
        resp = await client_with_auth.get("/api/v1/budgets")
        assert resp.status_code == 401
