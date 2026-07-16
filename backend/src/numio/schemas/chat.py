"""Pydantic schemas for analytics chat API."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# --- Request schemas ---


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class CreateSessionRequest(BaseModel):
    title: str | None = Field(default=None, max_length=500)


# --- Response schemas ---


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    data: list[dict[str, Any]] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    title: str | None
    created_at: datetime
    last_activity_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: list[ChatMessageResponse] = []


class ChatSessionListResponse(BaseModel):
    sessions: list[ChatSessionResponse]
    count: int


class SendMessageResponse(BaseModel):
    message: str
    data: list[dict[str, Any]] | None = None
    message_id: uuid.UUID
