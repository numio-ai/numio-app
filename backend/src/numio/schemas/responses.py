"""Consistent API response schemas."""

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Single field-level validation error."""

    field: str
    message: str


class ErrorResponse(BaseModel):
    """Structured error response returned by all error handlers."""

    error_code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None
