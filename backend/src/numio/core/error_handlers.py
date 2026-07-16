"""Global exception handlers for the FastAPI application."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from numio.schemas.responses import ErrorDetail, ErrorResponse

logger = logging.getLogger("numio.errors")


def _get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")


async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle HTTP exceptions (404, 405, etc.) with structured JSON."""
    body = ErrorResponse(
        error_code=f"HTTP_{exc.status_code}",
        message=str(exc.detail),
        request_id=_get_request_id(request),
    )
    return JSONResponse(status_code=exc.status_code, content=body.model_dump())


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors with field-level details."""
    details = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"])
        details.append(ErrorDetail(field=field, message=err["msg"]))

    logger.warning(
        "Request validation failed: %s %s — %s",
        request.method,
        request.url.path,
        "; ".join(f"{d.field}: {d.message}" for d in details),
    )

    body = ErrorResponse(
        error_code="VALIDATION_ERROR",
        message="Request validation failed",
        request_id=_get_request_id(request),
        details=details,
    )
    return JSONResponse(status_code=422, content=body.model_dump())


def register_error_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the app.

    Note: Unhandled exceptions (generic Exception) are caught by
    RequestIDMiddleware, which sits outside the exception middleware stack.
    """
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
