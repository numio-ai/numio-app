"""Request middleware for correlation IDs and request logging."""

import json
import logging
import uuid
from collections.abc import MutableMapping
from typing import Any

from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

from numio.core.logging import request_id_ctx

logger = logging.getLogger("uvicorn.error")


class SecurityHeadersMiddleware:
    """Adds standard security headers to every HTTP response."""

    HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"x-xss-protection", b"1; mode=block"),
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
        (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    ]

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: MutableMapping[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(self.HEADERS)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


class RequestIDMiddleware:
    """Pure ASGI middleware that assigns a unique request ID to each request.

    Also serves as the catch-all for unhandled exceptions — returns a structured
    JSON error response instead of an HTML 500 page.

    - Sets the request_id context variable
    - Adds X-Request-ID header to the response
    - Stores request_id in scope state for use in error handlers
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        rid = uuid.uuid4().hex
        token = request_id_ctx.set(rid)

        # Store request_id in scope state so error handlers can access it
        state: MutableMapping[str, Any] = scope.setdefault("state", {})
        state["request_id"] = rid

        request = Request(scope)
        logger.info("%s %s [request_id=%s]", request.method, request.url.path, rid)

        async def send_with_request_id(message: MutableMapping[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", rid.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception("Unhandled exception [request_id=%s]", rid)
            error_body = json.dumps(
                {
                    "error_code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": rid,
                    "details": None,
                }
            ).encode()
            response = Response(
                content=error_body,
                status_code=500,
                media_type="application/json",
                headers={"x-request-id": rid},
            )
            await response(scope, receive, send)
        finally:
            request_id_ctx.reset(token)
