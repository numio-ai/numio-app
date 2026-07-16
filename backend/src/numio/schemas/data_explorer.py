"""Pydantic schemas for the Data Explorer API."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class QueryRequest(BaseModel):
    """Body of POST /api/v1/data-explorer/query."""

    sql: str = Field(..., min_length=1, description="SQL statement to execute.")


class QueryResponse(BaseModel):
    """Result of an ad-hoc SQL execution."""

    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool
    elapsed_ms: int


class SavedQueryCreate(BaseModel):
    """Body of POST /api/v1/data-explorer/queries."""

    name: str = Field(..., min_length=1, max_length=120)
    sql: str = Field(..., min_length=1)
    description: str | None = None


class SavedQueryUpdate(BaseModel):
    """Body of PUT /api/v1/data-explorer/queries/{id}."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    sql: str | None = Field(default=None, min_length=1)
    description: str | None = None


class SavedQueryResponse(BaseModel):
    """Saved-query resource shape."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    sql: str
    description: str | None
    created_by_user_id: uuid.UUID
    updated_by_user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class SavedQueryListResponse(BaseModel):
    """List response — no pagination by design (tool is power-user, list is small)."""

    items: list[SavedQueryResponse]
    count: int
