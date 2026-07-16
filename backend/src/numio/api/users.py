"""User management and API key management endpoints."""

import logging
import uuid

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import (
    API_KEY_PREFIX,
    AuthenticatedUser,
    generate_api_key,
    get_current_user,
    require_role,
)
from numio.core.config import settings
from numio.db.session import get_session
from numio.models.api_key import ApiKey
from numio.models.user import User
from numio.schemas.auth import (
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyResponse,
    CreateApiKeyRequest,
    InviteUserRequest,
    UpdateUserRequest,
    UserListResponse,
    UserResponse,
)

logger = logging.getLogger("numio.users")

router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------


@router.get("", response_model=UserListResponse, summary="List workspace users")
async def list_users(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> UserListResponse:
    """List all users in the workspace. Admin only."""
    result = await session.execute(
        select(User).where(User.workspace_id == current_user.workspace_id)
    )
    users = list(result.scalars().all())
    return UserListResponse(
        users=[
            UserResponse(
                id=u.id,
                workspace_id=u.workspace_id,
                email=u.email,
                name=u.name,
                role=u.role,
                is_active=u.is_active,
            )
            for u in users
        ],
        count=len(users),
    )


@router.post("", response_model=UserResponse, status_code=201, summary="Invite a user")
async def invite_user(
    body: InviteUserRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Invite a new user to the workspace. Admin only.

    Creates a user record in Numio and, if Cognito is configured,
    creates the user in Cognito (which sends an invitation email).
    """
    # Check for duplicate email
    existing = await session.execute(
        select(User).where(
            User.workspace_id == current_user.workspace_id,
            User.email == body.email,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    # Create user in Cognito if configured
    cognito_sub = None
    if settings.auth_enabled and settings.cognito_user_pool_id:
        cognito_sub = await _create_cognito_user(body.email, body.name)

    user = User(
        workspace_id=current_user.workspace_id,
        email=body.email,
        name=body.name,
        role=body.role,
        is_active=True,
        cognito_sub=cognito_sub,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return UserResponse(
        id=user.id,
        workspace_id=user.workspace_id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
    )


@router.put("/{user_id}", response_model=UserResponse, summary="Update a user")
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Update a user's role or active status. Admin only."""
    result = await session.execute(
        select(User).where(
            User.id == user_id,
            User.workspace_id == current_user.workspace_id,
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active

    await session.commit()
    await session.refresh(user)

    return UserResponse(
        id=user.id,
        workspace_id=user.workspace_id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
    )


# ---------------------------------------------------------------------------
# API keys — user self-service + admin view
# ---------------------------------------------------------------------------


@router.get("/me/api-keys", response_model=ApiKeyListResponse, summary="List my API keys")
async def list_my_api_keys(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyListResponse:
    """List the current user's API keys (masked)."""
    result = await session.execute(
        select(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.revoked_at.is_(None),
        )
    )
    keys = list(result.scalars().all())
    return ApiKeyListResponse(
        keys=[
            ApiKeyResponse(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                created_at=k.created_at,
                last_used_at=k.last_used_at,
            )
            for k in keys
        ],
        count=len(keys),
    )


@router.post(
    "/me/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=201,
    summary="Create an API key",
)
async def create_api_key(
    body: CreateApiKeyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyCreatedResponse:
    """Generate a new API key. The raw key is returned only once."""
    raw_key, key_hash = generate_api_key()

    api_key = ApiKey(
        workspace_id=str(current_user.workspace_id),
        user_id=current_user.id,
        name=body.name,
        key_hash=key_hash,
        key_prefix=raw_key[: len(API_KEY_PREFIX) + 8],
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key=raw_key,
        created_at=api_key.created_at,
    )


@router.delete("/me/api-keys/{key_id}", status_code=204, summary="Revoke my API key")
async def revoke_my_api_key(
    key_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Revoke one of the current user's API keys."""
    from datetime import datetime, timezone

    result = await session.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.user_id == current_user.id,
            ApiKey.revoked_at.is_(None),
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.revoked_at = datetime.now(timezone.utc)
    await session.commit()


@router.get("/api-keys", response_model=ApiKeyListResponse, summary="List all API keys (admin)")
async def list_all_api_keys(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyListResponse:
    """List all API keys in the workspace. Admin only."""
    result = await session.execute(
        select(ApiKey, User.email)
        .join(User, ApiKey.user_id == User.id)
        .where(
            ApiKey.workspace_id == str(current_user.workspace_id),
            ApiKey.revoked_at.is_(None),
        )
    )
    rows = result.all()
    return ApiKeyListResponse(
        keys=[
            ApiKeyResponse(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                created_at=k.created_at,
                last_used_at=k.last_used_at,
                user_id=k.user_id,
                user_email=email,
            )
            for k, email in rows
        ],
        count=len(rows),
    )


@router.delete("/api-keys/{key_id}", status_code=204, summary="Revoke any API key (admin)")
async def revoke_any_api_key(
    key_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Revoke any API key in the workspace. Admin only."""
    from datetime import datetime, timezone

    result = await session.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.workspace_id == str(current_user.workspace_id),
            ApiKey.revoked_at.is_(None),
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.revoked_at = datetime.now(timezone.utc)
    await session.commit()


# ---------------------------------------------------------------------------
# Cognito user creation helper
# ---------------------------------------------------------------------------


async def _create_cognito_user(email: str, name: str) -> str | None:
    """Create a user in Cognito user pool. Returns cognito_sub or None on failure."""
    try:
        client = boto3.client("cognito-idp", region_name=settings.cognito_region)
        response = client.admin_create_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": name},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
        return response["User"]["Username"]
    except ClientError as e:
        logger.warning("Failed to create Cognito user %s: %s", email, e)
        return None
    except Exception as e:
        logger.warning("Cognito user creation failed for %s: %s", email, e)
        return None
