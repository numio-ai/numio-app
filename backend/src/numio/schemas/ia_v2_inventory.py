"""Pydantic schemas for IA v2 resources-inventory API.

The IA v2 Resources page expects cursor-paginated rows, a configurable column
set (including tag columns), and bulk endpoints (export, hibernate). This
schema captures the shape; persistence + cursor implementation deferred.
"""

from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class InventoryRow(BaseModel):
    id: str
    name: str
    svc: str
    type: str | None = None
    state: str | None = None
    region: str | None = None
    acct: str | None = None
    spend: Decimal = Decimal("0")
    gaps: int = 0
    tags: dict[str, Any] = Field(default_factory=dict)


class InventoryListResponse(BaseModel):
    rows: list[InventoryRow]
    next_cursor: str | None = None
    total_count: int
    columns_returned: list[str]


class BulkSelector(BaseModel):
    resource_ids: list[str] = Field(default_factory=list, max_length=1000)
    view_id: str | None = None


class BulkActionType(str, Enum):
    export = "export"
    hibernate = "hibernate"


class BulkActionResponse(BaseModel):
    action: BulkActionType
    accepted: int
    rejected: int
    job_id: str | None = None
    artifact_url: str | None = None
    errors: list[str] = Field(default_factory=list)


class ColumnDescriptor(BaseModel):
    id: str
    label: str
    width: int
    section: str
    always: bool = False
    tag_column: bool = False


class ColumnsAvailableResponse(BaseModel):
    columns: list[ColumnDescriptor]
