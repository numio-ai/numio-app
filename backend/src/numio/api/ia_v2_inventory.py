"""IA v2 resources inventory — configurable columns, tag columns, bulk endpoints.

Scaffold-only. Endpoints accept the v2 query shape (cols=, cursor=, search)
and return realistic fixtures so the Resources page can flip from local
mocks to real network calls. Persistence (cursor pagination over
cloud_resources + bulk job machinery) is deferred.
"""

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_inventory import (
    BulkActionResponse,
    BulkActionType,
    BulkSelector,
    ColumnDescriptor,
    ColumnsAvailableResponse,
    InventoryListResponse,
    InventoryRow,
)

router = APIRouter(prefix="/inventory", tags=["ia-v2-inventory"])

_COLUMNS: list[ColumnDescriptor] = [
    ColumnDescriptor(id="name", label="Name / ID", width=280, section="always", always=True),
    ColumnDescriptor(id="svc", label="Service", width=92, section="always", always=True),
    ColumnDescriptor(id="spend", label="Spend/mo", width=88, section="always", always=True),
    ColumnDescriptor(id="type", label="Type", width=130, section="builtin"),
    ColumnDescriptor(id="state", label="State", width=108, section="builtin"),
    ColumnDescriptor(id="region", label="Region", width=86, section="builtin"),
    ColumnDescriptor(id="acct", label="Account", width=88, section="builtin"),
    ColumnDescriptor(id="gaps", label="Tags", width=64, section="builtin"),
    ColumnDescriptor(id="provider", label="Provider", width=70, section="builtin"),
    ColumnDescriptor(id="created", label="Created", width=110, section="builtin"),
    ColumnDescriptor(id="arn", label="ARN", width=200, section="builtin"),
    ColumnDescriptor(id="tag:env", label="tag:env", width=100, section="tag", tag_column=True),
    ColumnDescriptor(id="tag:team", label="tag:team", width=100, section="tag", tag_column=True),
    ColumnDescriptor(id="tag:cost-center", label="tag:cost-center", width=110, section="tag", tag_column=True),
    ColumnDescriptor(id="tag:owner", label="tag:owner", width=110, section="tag", tag_column=True),
    ColumnDescriptor(id="tag:service", label="tag:service", width=110, section="tag", tag_column=True),
    ColumnDescriptor(id="tag:criticality", label="tag:criticality", width=96, section="tag", tag_column=True),
]

_FIXTURE_ROWS: list[InventoryRow] = [
    InventoryRow(id="i-0a4f8c2d09b3e7a11", name="payments-api-prod-3", svc="EC2", type="m6i.2xlarge", state="running", region="us-east-1", acct="123456789012", spend=Decimal("842"), gaps=0, tags={"env": "production", "team": "payments", "cost-center": "CC-PAY"}),
    InventoryRow(id="i-0fc7b21e88a4d09c2", name="ml-train-worker-04", svc="EC2", type="g5.12xlarge", state="running", region="us-west-2", acct="987654321098", spend=Decimal("3120"), gaps=2, tags={"env": "staging", "team": "ml"}),
    InventoryRow(id="vol-079b3f12c4ad99e", name="logs-archive-volume", svc="EBS", type="gp3 · 1.2 TB", state="unassociated", region="us-east-1", acct="123456789012", spend=Decimal("96"), gaps=2, tags={"env": "production"}),
    InventoryRow(id="eip-0c1f9b2e", name="—", svc="EIP", type="Elastic IP", state="unassociated", region="eu-west-1", acct="123456789012", spend=Decimal("4"), gaps=4, tags={}),
    InventoryRow(id="arn:lambda:search-api-fn", name="search-api-fn", svc="Lambda", type="512 MB · py3.11", state=None, region="us-east-1", acct="123456789012", spend=Decimal("318"), gaps=0, tags={"env": "production", "team": "eng"}),
]


def _parse_cols(cols: str | None) -> list[str]:
    if not cols:
        return ["name", "svc", "spend", "type", "state", "region", "acct", "gaps"]
    requested = [c for c in cols.split(",") if c]
    valid = {c.id for c in _COLUMNS}
    return [c for c in requested if c in valid]


@router.get("/columns/available", response_model=ColumnsAvailableResponse, summary="List all columns including tag columns")
async def list_available_columns(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ColumnsAvailableResponse:
    return ColumnsAvailableResponse(columns=_COLUMNS)


@router.get("/resources", response_model=InventoryListResponse, summary="List resources with configurable columns + cursor pagination")
async def list_resources(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cols: str | None = Query(default=None, description="comma-separated column ids"),
    search: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> InventoryListResponse:
    rows = _FIXTURE_ROWS
    if search:
        q = search.lower()
        rows = [
            r for r in rows
            if q in r.name.lower() or q in r.id.lower() or any(q in str(v).lower() for v in r.tags.values())
        ]
    returned_cols = _parse_cols(cols)
    return InventoryListResponse(
        rows=rows[:limit],
        next_cursor=None,
        total_count=1284,
        columns_returned=returned_cols,
    )


@router.post("/bulk/export", response_model=BulkActionResponse, summary="Export selected resources as CSV")
async def bulk_export(
    body: BulkSelector,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BulkActionResponse:
    if not body.resource_ids and not body.view_id:
        raise HTTPException(status_code=400, detail="Provide resource_ids or view_id")
    count = len(body.resource_ids)
    return BulkActionResponse(
        action=BulkActionType.export,
        accepted=count,
        rejected=0,
        artifact_url=f"https://example.local/exports/{uuid.uuid4()}.csv",
    )


@router.post("/bulk/hibernate", response_model=BulkActionResponse, summary="Hibernate selected resources")
async def bulk_hibernate(
    body: BulkSelector,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BulkActionResponse:
    if not body.resource_ids:
        raise HTTPException(status_code=400, detail="resource_ids required")
    if len(body.resource_ids) > 200:
        raise HTTPException(status_code=400, detail="Bulk hibernate cap: 200 resources")
    return BulkActionResponse(
        action=BulkActionType.hibernate,
        accepted=len(body.resource_ids),
        rejected=0,
        job_id=f"hib-{uuid.uuid4()}",
    )
