"""Tests for API foundation: error handling, health endpoint, request IDs."""

import pytest
from httpx import ASGITransport, AsyncClient

from numio.core.config import Settings
from numio.core.logging import request_id_ctx


# ---------------------------------------------------------------------------
# Test app factory — avoids lifespan (no real DB, no migrations)
# ---------------------------------------------------------------------------
def _create_test_app():
    """Create a minimal FastAPI app with the same middleware and error handlers."""
    from fastapi import APIRouter, FastAPI, Query

    from numio.core.error_handlers import register_error_handlers
    from numio.core.middleware import RequestIDMiddleware

    app = FastAPI()
    app.add_middleware(RequestIDMiddleware)
    register_error_handlers(app)

    router = APIRouter()

    @router.get("/ok")
    async def ok():
        return {"msg": "ok"}

    @router.get("/boom")
    async def boom():
        raise RuntimeError("something broke")

    @router.get("/validate")
    async def validate(count: int = Query(...)):
        return {"count": count}

    app.include_router(router)
    return app


@pytest.fixture
def test_app():
    return _create_test_app()


@pytest.fixture
async def client(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------
class TestErrorHandling:
    async def test_unhandled_exception_returns_structured_json(self, client):
        resp = await client.get("/boom")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error_code"] == "INTERNAL_ERROR"
        assert body["message"] == "An unexpected error occurred"
        assert body["request_id"]  # non-empty

    async def test_validation_error_returns_field_details(self, client):
        resp = await client.get("/validate?count=notanumber")
        assert resp.status_code == 422
        body = resp.json()
        assert body["error_code"] == "VALIDATION_ERROR"
        assert body["request_id"]
        assert isinstance(body["details"], list)
        assert len(body["details"]) >= 1
        assert body["details"][0]["field"]
        assert body["details"][0]["message"]

    async def test_404_returns_structured_json(self, client):
        resp = await client.get("/nonexistent")
        assert resp.status_code == 404
        body = resp.json()
        assert body["error_code"] == "HTTP_404"
        assert body["request_id"]


# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------
class TestRequestIDMiddleware:
    async def test_response_has_request_id_header(self, client):
        resp = await client.get("/ok")
        assert resp.status_code == 200
        assert resp.headers.get("x-request-id")

    async def test_error_response_request_id_matches_header(self, client):
        resp = await client.get("/boom")
        header_id = resp.headers.get("x-request-id")
        body_id = resp.json()["request_id"]
        assert header_id == body_id


# ---------------------------------------------------------------------------
# Request ID context
# ---------------------------------------------------------------------------
class TestRequestIDContext:
    def test_request_id_context_default_is_empty(self):
        assert request_id_ctx.get("") == ""

    def test_request_id_context_set_and_reset(self):
        token = request_id_ctx.set("abc123")
        try:
            assert request_id_ctx.get() == "abc123"
        finally:
            request_id_ctx.reset(token)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
class TestConfiguration:
    def test_settings_defaults(self):
        s = Settings(database_url="sqlite:///:memory:")
        assert s.log_level == "INFO"
        assert s.environment == "local"
        assert s.debug is False

    def test_settings_override(self, monkeypatch):
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("DEBUG", "true")
        s = Settings(database_url="sqlite:///:memory:")
        assert s.log_level == "DEBUG"
        assert s.environment == "production"
        assert s.debug is True
