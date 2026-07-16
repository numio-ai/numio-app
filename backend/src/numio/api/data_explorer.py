"""REST API for the Data Explorer feature.

Admin-only ad-hoc SQL execution and saved-query CRUD. Ad-hoc queries flow
through the read-only Postgres connection; saved-query CRUD uses the
primary connection because it writes to `data_explorer_saved_queries`.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, require_role
from numio.core.config import settings
from numio.core.data_explorer_service import (
    DataExplorerError,
    execute_query,
)
from numio.db.explorer_session import get_explorer_session
from numio.db.saved_query_repository import (
    SavedQueryNameTaken,
    SavedQueryRepository,
)
from numio.db.session import get_session
from numio.schemas.data_explorer import (
    QueryRequest,
    QueryResponse,
    SavedQueryCreate,
    SavedQueryListResponse,
    SavedQueryResponse,
    SavedQueryUpdate,
)
from numio.schemas.responses import ErrorResponse

router = APIRouter(prefix="/data-explorer", tags=["data-explorer"])

# HTTP status codes by error_code — kept here so the spec contract is
# enforced in one place rather than scattered through service code.
_STATUS_BY_CODE = {
    "PERMISSION_DENIED": 403,
    "STATEMENT_TIMEOUT": 408,
    "INVALID_SQL": 400,
    "SQL_TOO_LARGE": 413,
}


def _error_response(request: Request, exc: DataExplorerError) -> JSONResponse:
    body = ErrorResponse(
        error_code=exc.error_code,
        message=exc.message,
        request_id=getattr(request.state, "request_id", ""),
    )
    return JSONResponse(
        status_code=_STATUS_BY_CODE.get(exc.error_code, 400),
        content=body.model_dump(),
    )


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Execute ad-hoc read-only SQL",
    dependencies=[Depends(require_role("admin"))],
)
async def run_query(
    body: QueryRequest,
    request: Request,
    session: AsyncSession = Depends(get_explorer_session),
):
    if len(body.sql.encode("utf-8")) > settings.data_explorer_max_sql_bytes:
        return _error_response(
            request,
            DataExplorerError(
                "SQL_TOO_LARGE",
                f"SQL exceeds {settings.data_explorer_max_sql_bytes} bytes.",
            ),
        )
    try:
        result = await execute_query(
            session,
            body.sql,
            statement_timeout_ms=settings.data_explorer_statement_timeout_ms,
            max_rows=settings.data_explorer_max_rows,
        )
    except DataExplorerError as exc:
        return _error_response(request, exc)

    return QueryResponse(
        columns=result.columns,
        rows=result.rows,
        row_count=result.row_count,
        truncated=result.truncated,
        elapsed_ms=result.elapsed_ms,
    )


# ---------------------------------------------------------------------------
# Saved queries — workspace-shared CRUD. Admin-only.
# ---------------------------------------------------------------------------


def _repo(session: AsyncSession, user: AuthenticatedUser) -> SavedQueryRepository:
    return SavedQueryRepository(session, user.workspace_id)


@router.get(
    "/queries",
    response_model=SavedQueryListResponse,
    summary="List saved queries in the workspace",
)
async def list_saved_queries(
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> SavedQueryListResponse:
    items, total = await _repo(session, user).list_all()
    return SavedQueryListResponse(
        items=[SavedQueryResponse.model_validate(q) for q in items],
        count=total,
    )


@router.post(
    "/queries",
    response_model=SavedQueryResponse,
    status_code=201,
    summary="Save a query",
)
async def create_saved_query(
    body: SavedQueryCreate,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> SavedQueryResponse:
    repo = _repo(session, user)
    try:
        query = await repo.create(
            name=body.name,
            sql=body.sql,
            description=body.description,
            user_id=user.id,
        )
    except SavedQueryNameTaken:
        raise HTTPException(status_code=409, detail=f"Name already exists: {body.name}")
    return SavedQueryResponse.model_validate(query)


@router.get(
    "/queries/{query_id}",
    response_model=SavedQueryResponse,
    summary="Fetch a saved query",
)
async def get_saved_query(
    query_id: uuid.UUID,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> SavedQueryResponse:
    query = await _repo(session, user).get_by_id(query_id)
    if query is None:
        raise HTTPException(status_code=404, detail="Saved query not found")
    return SavedQueryResponse.model_validate(query)


@router.put(
    "/queries/{query_id}",
    response_model=SavedQueryResponse,
    summary="Update a saved query",
)
async def update_saved_query(
    query_id: uuid.UUID,
    body: SavedQueryUpdate,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> SavedQueryResponse:
    repo = _repo(session, user)
    fields = body.model_dump(exclude_unset=True)
    try:
        query = await repo.update(
            query_id,
            name=fields.get("name"),
            sql=fields.get("sql"),
            description=fields.get("description"),
            description_set="description" in fields,
            user_id=user.id,
        )
    except SavedQueryNameTaken:
        raise HTTPException(
            status_code=409,
            detail=f"Name already exists: {body.name}",
        )
    if query is None:
        raise HTTPException(status_code=404, detail="Saved query not found")
    return SavedQueryResponse.model_validate(query)


@router.delete(
    "/queries/{query_id}",
    status_code=204,
    summary="Delete a saved query",
)
async def delete_saved_query(
    query_id: uuid.UUID,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    deleted = await _repo(session, user).delete(query_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved query not found")
    return Response(status_code=204)
