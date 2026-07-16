"""Audit trail service — decorator and helper for logging significant actions."""

import functools
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.audit_config_event_repository import AuditConfigEventRepository

logger = logging.getLogger(__name__)

DEFAULT_USER = "system"

# Path-parameter names that map to entity IDs
_ID_PARAM_NAMES = (
    "account_id",
    "budget_id",
    "policy_id",
    "finding_id",
    "recommendation_id",
    "campaign_id",
    "threshold_id",
    "rule_id",
)


def _serialize_value(value: Any) -> Any:
    """Convert a value to JSON-safe form."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _entity_to_dict(model_class: Any, entity: Any) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-safe dict."""
    return {c.key: _serialize_value(getattr(entity, c.key)) for c in model_class.__table__.columns}


async def _fetch_entity_state(
    session: AsyncSession, model_class: Any, entity_id: uuid.UUID
) -> dict | None:
    """Fetch current entity state from DB as a dict."""
    result = await session.execute(select(model_class).where(model_class.id == entity_id))
    entity = result.scalar_one_or_none()
    if entity is None:
        return None
    return _entity_to_dict(model_class, entity)


def _extract_entity_id(kwargs: dict) -> str | None:
    """Extract entity ID from endpoint kwargs by looking for known param names."""
    for name in _ID_PARAM_NAMES:
        if name in kwargs:
            return str(kwargs[name])
    return None


def _extract_entity_id_from_response(result: Any) -> str | None:
    """Try to get entity ID from the response object (for create endpoints)."""
    if result is not None and hasattr(result, "id"):
        return str(result.id)
    return None


async def log_audit_event(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    before_value: dict | None = None,
    after_value: dict | None = None,
    details: str | None = None,
    user: str = DEFAULT_USER,
    workspace_id: str = "default",
) -> None:
    """Directly log an audit event. For use in services that aren't HTTP endpoints."""
    repo = AuditConfigEventRepository(session, workspace_id)
    await repo.create(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_value=before_value,
        after_value=after_value,
        details=details,
    )


def audit_trail(
    action: str,
    entity_type: str,
    model_class: Any | None = None,
):
    """Decorator that adds audit logging to API endpoints.

    Args:
        action: The audit action name (e.g. "account_registered", "policy_updated").
        entity_type: The type of entity affected (e.g. "account", "policy").
        model_class: Optional SQLAlchemy model class. When provided, the decorator
            captures before/after state for update/delete operations.
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            session: AsyncSession | None = kwargs.get("session")
            entity_id = _extract_entity_id(kwargs)

            # Capture before state for modifications
            before_value = None
            if model_class is not None and entity_id is not None and session is not None:
                try:
                    before_value = await _fetch_entity_state(
                        session, model_class, uuid.UUID(entity_id)
                    )
                except Exception:
                    logger.warning("Failed to capture before state for audit", exc_info=True)

            # Call the original endpoint
            result = await func(*args, **kwargs)

            # Extract entity_id from response if not in path params (create endpoints)
            if entity_id is None:
                entity_id = _extract_entity_id_from_response(result)

            # Capture after state for modifications
            after_value = None
            if model_class is not None and entity_id is not None and session is not None:
                try:
                    after_value = await _fetch_entity_state(
                        session, model_class, uuid.UUID(entity_id)
                    )
                except Exception:
                    logger.warning("Failed to capture after state for audit", exc_info=True)

            # Log audit event
            if session is not None:
                try:
                    # Extract user and workspace from authenticated user if available
                    current_user = kwargs.get("current_user")
                    audit_user = DEFAULT_USER
                    audit_workspace_id = "default"
                    if current_user is not None:
                        audit_user = current_user.email
                        audit_workspace_id = str(current_user.workspace_id)

                    repo = AuditConfigEventRepository(session, audit_workspace_id)
                    await repo.create(
                        user=audit_user,
                        action=action,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        before_value=before_value,
                        after_value=after_value,
                    )
                except Exception:
                    logger.warning("Failed to write audit event", exc_info=True)

            return result

        return wrapper

    return decorator
