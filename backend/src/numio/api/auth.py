"""Authentication API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import (
    API_KEY_PREFIX,
    SESSION_COOKIE,
    AuthenticatedUser,
    create_session_token,
    generate_api_key,
    get_current_user,
    verify_cognito_token,
)
from numio.core.config import settings
from numio.db.session import get_session
from numio.models.api_key import ApiKey
from numio.models.user import User
from numio.models.workspace import Workspace
from numio.schemas.auth import (
    ApiKeyCreatedResponse,
    CreateApiKeyRequest,
    LoginRequest,
    UserResponse,
)

logger = logging.getLogger("numio.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", summary="Sign in with Cognito ID token")
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Validate a Cognito ID token, create or update the user record, and set a session cookie."""
    if not settings.auth_enabled:
        raise HTTPException(status_code=400, detail="Auth is disabled")

    claims = await verify_cognito_token(body.id_token)

    cognito_sub = claims["sub"]
    email = claims.get("email", "")
    name = claims.get("name", email)

    # Find or create user
    result = await session.execute(select(User).where(User.cognito_sub == cognito_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Find or create default workspace
        ws_result = await session.execute(select(Workspace).where(Workspace.slug == "default"))
        workspace = ws_result.scalar_one_or_none()
        if workspace is None:
            raise HTTPException(status_code=500, detail="Default workspace not found")

        # Check if a user with this email already exists (link Cognito)
        email_result = await session.execute(
            select(User).where(User.email == email, User.workspace_id == workspace.id)
        )
        user = email_result.scalar_one_or_none()

        if user is not None:
            # Link existing user to Cognito
            user.cognito_sub = cognito_sub
            user.name = name
        else:
            # Create new user (first user gets admin role)
            user_count_result = await session.execute(
                select(User).where(User.workspace_id == workspace.id).limit(1)
            )
            is_first_user = user_count_result.scalar_one_or_none() is None

            user = User(
                workspace_id=workspace.id,
                email=email,
                name=name,
                role="admin" if is_first_user else "viewer",
                cognito_sub=cognito_sub,
            )
            session.add(user)

        await session.commit()
        await session.refresh(user)

    auth_user = AuthenticatedUser(
        id=user.id,
        workspace_id=user.workspace_id,
        email=user.email,
        name=user.name,
        role=user.role,
    )

    token = create_session_token(auth_user)

    response = JSONResponse(
        content=UserResponse(
            id=user.id,
            workspace_id=user.workspace_id,
            email=user.email,
            name=user.name,
            role=user.role,
        ).model_dump(mode="json")
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=settings.environment != "local",
        samesite="lax",
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )
    return response


@router.post("/logout", summary="Sign out")
async def logout() -> JSONResponse:
    """Clear the session cookie."""
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return response


@router.get("/me", response_model=UserResponse, summary="Get current user")
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> UserResponse:
    """Return the currently authenticated user's info."""
    return UserResponse(
        id=current_user.id,
        workspace_id=current_user.workspace_id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
    )


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=201,
    summary="Create an API key",
)
async def create_api_key(
    body: CreateApiKeyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyCreatedResponse:
    """Generate a new API key for the current user. The raw key is returned only once."""
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
