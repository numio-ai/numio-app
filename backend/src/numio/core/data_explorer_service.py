"""Execute ad-hoc SQL against the read-only Postgres role.

The service keeps the HTTP layer thin: it owns the row-cap policy, value
serialisation, and translation of psycopg errors into a structured outcome
that the route hands back to the client.
"""

from __future__ import annotations

import datetime
import decimal
import time
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class QueryResult:
    """Successful execution result, ready for serialisation."""

    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool
    elapsed_ms: int


class DataExplorerError(Exception):
    """Raised when the SQL is rejected by Postgres or by app-level limits.

    The route maps `error_code` to an HTTP status. Defined error codes:

    - INVALID_SQL — syntax, unknown column/table, type mismatch, etc.
    - PERMISSION_DENIED — write attempt rejected by the read-only role.
    - STATEMENT_TIMEOUT — query exceeded the configured timeout.
    """

    def __init__(self, error_code: str, message: str):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


# Postgres SQLSTATE codes we care about.
_SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501"
_SQLSTATE_QUERY_CANCELED = "57014"


def _serialise(value: Any) -> Any:
    """Convert a Postgres value into a JSON-safe scalar.

    Numbers and strings pass through. Decimals, dates, UUIDs, bytes are
    stringified — the operator is debugging raw rows, so a faithful textual
    representation is more useful than a guessed type.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    if isinstance(value, datetime.timedelta):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    return str(value)


def _classify(exc: DBAPIError) -> DataExplorerError:
    """Map a psycopg-wrapped error to a DataExplorerError."""
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    # Strip the SQLAlchemy "(psycopg.errors.X) " prefix; keep the Postgres
    # message itself which is what the operator wants to see.
    raw = getattr(exc, "orig", None)
    message = str(raw) if raw is not None else str(exc)
    message = message.strip()

    if sqlstate == _SQLSTATE_INSUFFICIENT_PRIVILEGE:
        return DataExplorerError("PERMISSION_DENIED", message)
    if sqlstate == _SQLSTATE_QUERY_CANCELED:
        return DataExplorerError(
            "STATEMENT_TIMEOUT",
            "Query exceeded the configured statement timeout.",
        )
    return DataExplorerError("INVALID_SQL", message)


async def execute_query(
    session: AsyncSession,
    sql: str,
    *,
    statement_timeout_ms: int,
    max_rows: int,
) -> QueryResult:
    """Run user-supplied SQL through the read-only session.

    Sets `statement_timeout` for the session's transaction, executes the
    statement once, fetches up to `max_rows + 1` rows, and reports whether
    the extra row was present (truncation indicator).
    """
    started = time.perf_counter()
    try:
        await session.execute(text(f"SET LOCAL statement_timeout = {statement_timeout_ms}"))
        result = await session.execute(text(sql))
        rows = result.fetchmany(max_rows + 1)
        columns = list(result.keys())
    except DBAPIError as exc:
        raise _classify(exc) from exc

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    truncated = len(rows) > max_rows
    if truncated:
        rows = rows[:max_rows]

    serialised = [[_serialise(v) for v in row] for row in rows]
    return QueryResult(
        columns=columns,
        rows=serialised,
        row_count=len(serialised),
        truncated=truncated,
        elapsed_ms=elapsed_ms,
    )
