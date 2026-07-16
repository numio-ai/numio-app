"""Authentication and authorization core.

Provides FastAPI dependencies for:
- Cognito JWT session cookie verification
- API key authentication (X-API-Key header)
- Auth bypass when AUTH_ENABLED=false
- Role-based access control (admin, editor, viewer)
"""

import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.config import settings
from numio.db.session import get_session
from numio.models.api_key import ApiKey
from numio.models.user import User
from numio.models.workspace import Workspace

logger = logging.getLogger("numio.auth")

# Role hierarchy: admin > editor > viewer
ROLE_HIERARCHY = {"admin": 3, "editor": 2, "viewer": 1}

# Session cookie name
SESSION_COOKIE = "numio_session"

# API key prefix
API_KEY_PREFIX = "numi_"


@dataclass
class AuthenticatedUser:
    """Represents the currently authenticated user."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    name: str
    role: str


# ---------------------------------------------------------------------------
# Cognito JWKS cache
# ---------------------------------------------------------------------------

_jwks_cache: dict | None = None


async def _get_cognito_jwks() -> dict:
    """Fetch and cache Cognito JWKS (JSON Web Key Set)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    pool_id = settings.cognito_user_pool_id
    region = settings.cognito_region
    jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"

    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


def clear_jwks_cache() -> None:
    """Clear the JWKS cache (useful for testing)."""
    global _jwks_cache
    _jwks_cache = None


async def verify_cognito_token(token: str) -> dict:
    """Verify a Cognito ID token and return its claims.

    Validates the JWT signature against Cognito's JWKS, checks issuer and audience.
    """
    pool_id = settings.cognito_user_pool_id
    region = settings.cognito_region
    client_id = settings.cognito_client_id
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"

    jwks = await _get_cognito_jwks()

    # Extract the key ID from the token header
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")

    kid = unverified_header.get("kid")
    key = None
    for k in jwks.get("keys", []):
        if k["kid"] == kid:
            key = k
            break

    if key is None:
        # Clear cache in case keys rotated
        clear_jwks_cache()
        raise HTTPException(status_code=401, detail="Token signing key not found")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer,
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")

    # Cognito ID tokens have token_use=id
    if claims.get("token_use") != "id":
        raise HTTPException(status_code=401, detail="Not an ID token")

    return claims


# ---------------------------------------------------------------------------
# Session cookie (signed JWT)
# ---------------------------------------------------------------------------


def create_session_token(user: AuthenticatedUser) -> str:
    """Create a signed JWT session token for cookie storage."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "workspace_id": str(user.workspace_id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + settings.session_ttl_hours * 3600,
    }
    return jwt.encode(payload, settings.session_secret_key, algorithm="HS256")


def decode_session_token(token: str) -> dict:
    """Decode and verify a session JWT."""
    try:
        return jwt.decode(token, settings.session_secret_key, algorithms=["HS256"])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid session: {e}")


# ---------------------------------------------------------------------------
# API key helpers
# ---------------------------------------------------------------------------


def generate_api_key() -> tuple[str, str]:
    """Generate a new API key. Returns (raw_key, key_hash)."""
    raw = API_KEY_PREFIX + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, key_hash


def hash_api_key(raw_key: str) -> str:
    """Hash an API key for lookup."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def _validate_api_key(raw_key: str, session: AsyncSession) -> AuthenticatedUser | None:
    """Validate an API key and return the associated user."""
    key_hash = hash_api_key(raw_key)
    result = await session.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return None

    # Update last_used_at
    await session.execute(
        update(ApiKey)
        .where(ApiKey.id == api_key.id)
        .values(last_used_at=datetime.now(timezone.utc))
    )
    await session.commit()

    # Load the user (must be active)
    user_result = await session.execute(
        select(User).where(User.id == api_key.user_id, User.is_active.is_(True))
    )
    user = user_result.scalar_one_or_none()
    if user is None:
        return None

    return AuthenticatedUser(
        id=user.id,
        workspace_id=user.workspace_id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


# ---------------------------------------------------------------------------
# Auth bypass (synthetic admin user)
# ---------------------------------------------------------------------------


_BYPASS_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")


async def _get_bypass_user(session: AsyncSession) -> AuthenticatedUser:
    """Return or create the bypass admin user for auth-disabled mode."""
    # Use the default workspace
    result = await session.execute(select(Workspace).where(Workspace.slug == "default"))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=500,
            detail="Default workspace not found. Run seed data first.",
        )

    # Ensure the bypass user exists in the DB (needed for FK relations like API keys)
    user_result = await session.execute(select(User).where(User.id == _BYPASS_USER_ID))
    user = user_result.scalar_one_or_none()
    if user is None:
        user = User(
            id=_BYPASS_USER_ID,
            workspace_id=workspace.id,
            email="admin@localhost",
            name="Local Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()

    return AuthenticatedUser(
        id=user.id,
        workspace_id=user.workspace_id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> AuthenticatedUser:
    """FastAPI dependency that resolves the current authenticated user.

    Authentication methods (checked in order):
    1. Auth bypass (AUTH_ENABLED=false) → synthetic admin
    2. X-API-Key header → API key validation
    3. numio_session cookie → session JWT verification
    """
    # Auth bypass
    if not settings.auth_enabled:
        return await _get_bypass_user(session)

    # API key authentication
    api_key_header = request.headers.get("x-api-key")
    if api_key_header:
        user = await _validate_api_key(api_key_header, session)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return user

    # Session cookie
    session_token = request.cookies.get(SESSION_COOKIE)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    claims = decode_session_token(session_token)

    return AuthenticatedUser(
        id=uuid.UUID(claims["sub"]),
        workspace_id=uuid.UUID(claims["workspace_id"]),
        email=claims["email"],
        name=claims["name"],
        role=claims["role"],
    )


def require_role(*allowed_roles: str):
    """FastAPI dependency factory that enforces role-based access.

    Usage:
        @router.post("/settings", dependencies=[Depends(require_role("admin"))])

    Or inject the user:
        async def endpoint(user: AuthenticatedUser = Depends(require_role("admin", "editor"))):
    """

    async def _check_role(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(allowed_roles)}",
            )
        return current_user

    return _check_role
