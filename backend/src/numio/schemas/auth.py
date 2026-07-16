"""Auth request and response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login with a Cognito ID token."""

    id_token: str


class UserResponse(BaseModel):
    """Current user info."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    name: str
    role: str
    is_active: bool = True


class UserListResponse(BaseModel):
    """List of users in the workspace."""

    users: list[UserResponse]
    count: int


class InviteUserRequest(BaseModel):
    """Invite a new user to the workspace."""

    email: str
    name: str
    role: str = Field(default="viewer", pattern="^(admin|editor|viewer)$")


class UpdateUserRequest(BaseModel):
    """Update a user's role or active status."""

    role: str | None = Field(None, pattern="^(admin|editor|viewer)$")
    is_active: bool | None = None


class CreateApiKeyRequest(BaseModel):
    """Create a new API key."""

    name: str


class ApiKeyCreatedResponse(BaseModel):
    """Returned once when an API key is created — contains the raw key."""

    id: uuid.UUID
    name: str
    key_prefix: str
    key: str  # Raw key — shown only once
    created_at: datetime


class ApiKeyResponse(BaseModel):
    """API key info (without the raw key)."""

    id: uuid.UUID
    name: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None
    user_id: uuid.UUID | None = None
    user_email: str | None = None


class ApiKeyListResponse(BaseModel):
    """List of API keys."""

    keys: list[ApiKeyResponse]
    count: int
