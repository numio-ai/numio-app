"""REST API endpoints for analytics chat."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from numio.chat.service import ChatService
from numio.core.auth import AuthenticatedUser, get_current_user
from numio.core.config import settings
from numio.db.chat_repository import ChatRepository
from numio.db.session import get_session
from numio.schemas.chat import (
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionResponse,
    CreateSessionRequest,
    SendMessageRequest,
    SendMessageResponse,
)

logger = logging.getLogger("numio.api.chat")

router = APIRouter(prefix="/chat", tags=["chat"])


# --- Sessions ---


@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    status_code=201,
    summary="Create a new chat session",
)
async def create_session(
    body: CreateSessionRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatSessionResponse:
    repo = ChatRepository(session, str(current_user.workspace_id))
    title = body.title if body else None
    chat_session = await repo.create_session(title=title)
    return ChatSessionResponse.model_validate(chat_session)


@router.get(
    "/sessions",
    response_model=ChatSessionListResponse,
    summary="List chat sessions",
)
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatSessionListResponse:
    repo = ChatRepository(session, str(current_user.workspace_id))
    sessions, total = await repo.list_sessions(
        ttl_hours=settings.chat_session_ttl_hours,
        limit=limit,
        offset=offset,
    )
    return ChatSessionListResponse(
        sessions=[ChatSessionResponse.model_validate(s) for s in sessions],
        count=total,
    )


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetailResponse,
    summary="Get session with message history",
)
async def get_session_detail(
    session_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatSessionDetailResponse:
    repo = ChatRepository(session, str(current_user.workspace_id))
    chat_session = await repo.get_session(session_id)
    if chat_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSessionDetailResponse.model_validate(chat_session)


@router.delete(
    "/sessions/{session_id}",
    status_code=204,
    summary="Delete a chat session",
)
async def delete_session(
    session_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    repo = ChatRepository(session, str(current_user.workspace_id))
    deleted = await repo.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")


# --- Messages ---


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    summary="Send a message and get a response",
)
async def send_message(
    session_id: uuid.UUID,
    body: SendMessageRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SendMessageResponse:
    svc = ChatService(session, str(current_user.workspace_id))
    try:
        result = await svc.send_message(str(session_id), body.message)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        if "expired" in msg:
            raise HTTPException(status_code=410, detail=msg)
        if "limit" in msg:
            raise HTTPException(status_code=422, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception:
        logger.exception("Chat LLM error")
        raise HTTPException(
            status_code=503,
            detail="The AI assistant is temporarily unavailable. Please try again later.",
        )

    return SendMessageResponse(
        message=result["message"],
        data=result["data"],
        message_id=result["message_id"],
    )
