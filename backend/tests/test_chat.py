"""Tests for analytics chat — repository, tools, and API endpoints."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from numio.db.chat_repository import ChatRepository
from numio.db.finding_repository import FindingRepository
from numio.db.recommendation_repository import RecommendationRepository
from numio.schemas.finding import CreateFindingRequest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def chat_repo(db_session, default_workspace_id):
    return ChatRepository(db_session, default_workspace_id)


@pytest.fixture
def finding_repo(db_session, default_workspace_id):
    return FindingRepository(db_session, default_workspace_id)


@pytest.fixture
def rec_repo(db_session, default_workspace_id):
    return RecommendationRepository(db_session, default_workspace_id)


# ---------------------------------------------------------------------------
# ChatRepository — session CRUD
# ---------------------------------------------------------------------------


class TestChatRepository:
    async def test_create_session(self, chat_repo, default_workspace_id):
        session = await chat_repo.create_session(title="Test Session")
        assert session.id is not None
        assert session.workspace_id == default_workspace_id
        assert session.title == "Test Session"
        assert session.last_activity_at is not None

    async def test_create_session_no_title(self, chat_repo):
        session = await chat_repo.create_session()
        assert session.title is None

    async def test_list_sessions(self, chat_repo):
        await chat_repo.create_session(title="S1")
        await chat_repo.create_session(title="S2")
        sessions, total = await chat_repo.list_sessions()
        assert total >= 2
        assert len(sessions) >= 2

    async def test_list_sessions_excludes_expired(self, chat_repo):
        session = await chat_repo.create_session(title="Old")
        # Manually set last_activity to 25 hours ago
        session.last_activity_at = datetime.now(timezone.utc) - timedelta(hours=25)
        await chat_repo._session.commit()

        sessions, total = await chat_repo.list_sessions(ttl_hours=24)
        ids = [s.id for s in sessions]
        assert session.id not in ids

    async def test_get_session_with_messages(self, chat_repo):
        session = await chat_repo.create_session(title="With Messages")
        await chat_repo.add_message(session.id, "user", "Hello")
        await chat_repo.add_message(session.id, "assistant", "Hi there!")

        loaded = await chat_repo.get_session(session.id)
        assert loaded is not None
        assert len(loaded.messages) == 2
        assert loaded.messages[0].role == "user"
        assert loaded.messages[1].role == "assistant"

    async def test_get_session_not_found(self, chat_repo):
        result = await chat_repo.get_session(uuid.uuid4())
        assert result is None

    async def test_delete_session(self, chat_repo):
        session = await chat_repo.create_session(title="Delete Me")
        deleted = await chat_repo.delete_session(session.id)
        assert deleted is True
        assert await chat_repo.get_session(session.id) is None

    async def test_delete_session_not_found(self, chat_repo):
        deleted = await chat_repo.delete_session(uuid.uuid4())
        assert deleted is False

    async def test_touch_session(self, chat_repo):
        session = await chat_repo.create_session(title="Touch Me")
        original_activity = session.last_activity_at
        await chat_repo.touch_session(session.id)
        loaded = await chat_repo.get_session(session.id)
        assert loaded.last_activity_at >= original_activity

    async def test_is_session_expired(self, chat_repo):
        session = await chat_repo.create_session()
        assert await chat_repo.is_session_expired(session.id, ttl_hours=24) is False
        # Manually expire it
        session.last_activity_at = datetime.now(timezone.utc) - timedelta(hours=25)
        await chat_repo._session.commit()
        assert await chat_repo.is_session_expired(session.id, ttl_hours=24) is True

    async def test_is_session_expired_not_found(self, chat_repo):
        assert await chat_repo.is_session_expired(uuid.uuid4()) is True


# ---------------------------------------------------------------------------
# ChatRepository — message operations
# ---------------------------------------------------------------------------


class TestChatMessages:
    async def test_add_message(self, chat_repo):
        session = await chat_repo.create_session()
        msg = await chat_repo.add_message(session.id, "user", "What was total spend?")
        assert msg.id is not None
        assert msg.role == "user"
        assert msg.content == "What was total spend?"
        assert msg.data is None

    async def test_add_message_with_data(self, chat_repo):
        session = await chat_repo.create_session()
        data = [{"service": "EC2", "cost": 100.0}]
        msg = await chat_repo.add_message(session.id, "assistant", "Here's the data:", data)
        assert msg.data == data

    async def test_get_messages_ordered(self, chat_repo):
        session = await chat_repo.create_session()
        await chat_repo.add_message(session.id, "user", "First")
        await chat_repo.add_message(session.id, "assistant", "Second")
        await chat_repo.add_message(session.id, "user", "Third")

        messages = await chat_repo.get_messages(session.id)
        assert len(messages) == 3
        contents = {m.content for m in messages}
        assert contents == {"First", "Second", "Third"}

    async def test_get_messages_limit(self, chat_repo):
        session = await chat_repo.create_session()
        for i in range(5):
            await chat_repo.add_message(session.id, "user", f"Msg {i}")

        messages = await chat_repo.get_messages(session.id, limit=3)
        assert len(messages) == 3

    async def test_get_message_count(self, chat_repo):
        session = await chat_repo.create_session()
        assert await chat_repo.get_message_count(session.id) == 0
        await chat_repo.add_message(session.id, "user", "Hello")
        assert await chat_repo.get_message_count(session.id) == 1


# ---------------------------------------------------------------------------
# Chat tools — list_findings executor
# ---------------------------------------------------------------------------


class TestChatTools:
    async def test_list_findings_tool(self, db_session, finding_repo, default_workspace_id):
        from numio.chat.tools import execute_tool

        # Create a finding
        await finding_repo.create_or_update(
            CreateFindingRequest(
                type="zombie",
                severity="medium",
                title="Unattached EBS volume",
                resource_id="vol-abc123",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("5.00"),
            )
        )

        result = await execute_tool(
            "list_findings",
            {"type": "zombie", "status": "open"},
            db_session,
            default_workspace_id,
        )
        assert result["total"] >= 1
        assert len(result["findings"]) >= 1
        assert result["findings"][0]["type"] == "zombie"

    async def test_list_recommendations_tool(
        self, db_session, finding_repo, rec_repo, default_workspace_id
    ):
        from numio.chat.tools import execute_tool

        # Create a finding and recommendation
        finding, _ = await finding_repo.create_or_update(
            CreateFindingRequest(
                type="zombie",
                severity="medium",
                title="Unattached EBS volume",
                resource_id="vol-rec-test",
                detection_source="zombie_detection",
                estimated_cost_impact=Decimal("3.50"),
            )
        )
        await rec_repo.create(
            finding_id=finding.id,
            category="zombie_cleanup",
            confidence="high",
            title="Delete unattached volume",
            description="Clean up vol-rec-test",
            resource_id="vol-rec-test",
            remediation_commands="aws ec2 delete-volume --volume-id vol-rec-test",
            estimated_monthly_savings=Decimal("3.50"),
        )

        result = await execute_tool(
            "list_recommendations",
            {"status": "open"},
            db_session,
            default_workspace_id,
        )
        assert result["total"] >= 1
        assert len(result["recommendations"]) >= 1

    async def test_get_savings_summary_tool(self, db_session, default_workspace_id):
        from numio.chat.tools import execute_tool

        result = await execute_tool("get_savings_summary", {}, db_session, default_workspace_id)
        assert "total_estimated_monthly_savings" in result
        assert "total_actual_savings" in result

    async def test_unknown_tool(self, db_session, default_workspace_id):
        from numio.chat.tools import execute_tool

        result = await execute_tool("nonexistent_tool", {}, db_session, default_workspace_id)
        assert "error" in result


# ---------------------------------------------------------------------------
# Chat tool definitions
# ---------------------------------------------------------------------------


class TestToolDefinitions:
    def test_tool_definitions_structure(self):
        from numio.chat.tools import TOOL_DEFINITIONS

        assert len(TOOL_DEFINITIONS) >= 6
        for tool in TOOL_DEFINITIONS:
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool
            assert tool["input_schema"]["type"] == "object"

    def test_tool_names_match_executors(self):
        from numio.chat.tools import _EXECUTORS, TOOL_DEFINITIONS

        tool_names = {t["name"] for t in TOOL_DEFINITIONS}
        executor_names = set(_EXECUTORS.keys())
        assert tool_names == executor_names


# ---------------------------------------------------------------------------
# LLM client factory
# ---------------------------------------------------------------------------


class TestLLMClientFactory:
    def test_create_anthropic_client(self):
        from numio.chat.llm_client import AnthropicLLMClient, create_llm_client

        with patch("numio.chat.llm_client.settings") as mock_settings:
            mock_settings.chat_llm_backend = "anthropic"
            mock_settings.chat_anthropic_api_key = "test-key"
            mock_settings.chat_anthropic_model = "claude-sonnet-4-5-20250514"
            client = create_llm_client()
            assert isinstance(client, AnthropicLLMClient)

    def test_create_lmgate_client(self):
        from numio.chat.llm_client import LMGateLLMClient, create_llm_client

        with patch("numio.chat.llm_client.settings") as mock_settings:
            mock_settings.chat_llm_backend = "lmgate"
            mock_settings.chat_lmgate_url = "http://localhost:8080"
            mock_settings.chat_lmgate_model = "gpt-4"
            client = create_llm_client()
            assert isinstance(client, LMGateLLMClient)

    def test_invalid_backend(self):
        from numio.chat.llm_client import create_llm_client

        with patch("numio.chat.llm_client.settings") as mock_settings:
            mock_settings.chat_llm_backend = "invalid"
            with pytest.raises(ValueError, match="Unknown chat_llm_backend"):
                create_llm_client()


# ---------------------------------------------------------------------------
# API endpoint tests (with mocked LLM)
# ---------------------------------------------------------------------------


def _mock_llm_response():
    """Create a mock LLM client that returns a canned response."""
    from numio.chat.llm_client import LLMResponse

    mock = AsyncMock()
    mock.chat.return_value = LLMResponse(
        text="Total spend last month was $12,345.67.",
        tool_calls=[],
        stop_reason="end_turn",
    )
    return mock


class TestChatAPI:
    @pytest.fixture
    def app(self):
        from numio.main import app

        return app

    async def test_create_session_api(self, app, db_session):
        from numio.db.session import get_session

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/chat/sessions",
                    json={"title": "API Test Session"},
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["title"] == "API Test Session"
                assert "id" in data
        finally:
            app.dependency_overrides.clear()

    async def test_list_sessions_api(self, app, db_session, chat_repo):
        from numio.db.session import get_session

        await chat_repo.create_session(title="Listed Session")
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/chat/sessions")
                assert resp.status_code == 200
                data = resp.json()
                assert data["count"] >= 1
        finally:
            app.dependency_overrides.clear()

    async def test_get_session_detail_api(self, app, db_session, chat_repo):
        from numio.db.session import get_session

        session = await chat_repo.create_session(title="Detail Session")
        await chat_repo.add_message(session.id, "user", "Hello")
        await chat_repo.add_message(session.id, "assistant", "Hi!")

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/chat/sessions/{session.id}")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data["messages"]) == 2
        finally:
            app.dependency_overrides.clear()

    async def test_get_session_not_found_api(self, app, db_session):
        from numio.db.session import get_session

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/chat/sessions/{uuid.uuid4()}")
                assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_delete_session_api(self, app, db_session, chat_repo):
        from numio.db.session import get_session

        session = await chat_repo.create_session(title="Delete Me")
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete(f"/api/v1/chat/sessions/{session.id}")
                assert resp.status_code == 204
        finally:
            app.dependency_overrides.clear()

    async def test_send_message_api(self, app, db_session, chat_repo):
        from numio.db.session import get_session

        session = await chat_repo.create_session(title="Chat Session")
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            with patch("numio.chat.service.create_llm_client", return_value=_mock_llm_response()):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        f"/api/v1/chat/sessions/{session.id}/messages",
                        json={"message": "What was total spend last month?"},
                    )
                    assert resp.status_code == 200
                    data = resp.json()
                    assert "message" in data
                    assert data["message"] == "Total spend last month was $12,345.67."
                    assert "message_id" in data
        finally:
            app.dependency_overrides.clear()

    async def test_send_message_session_not_found_api(self, app, db_session):
        from numio.db.session import get_session

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    f"/api/v1/chat/sessions/{uuid.uuid4()}/messages",
                    json={"message": "Hello"},
                )
                assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_send_message_llm_error_returns_503(self, app, db_session, chat_repo):
        from numio.db.session import get_session

        session = await chat_repo.create_session(title="Error Session")
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            mock_llm = AsyncMock()
            mock_llm.chat.side_effect = Exception("LLM unavailable")
            with patch("numio.chat.service.create_llm_client", return_value=mock_llm):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        f"/api/v1/chat/sessions/{session.id}/messages",
                        json={"message": "Hello"},
                    )
                    assert resp.status_code == 503
                    assert "temporarily unavailable" in resp.json()["message"]
        finally:
            app.dependency_overrides.clear()
