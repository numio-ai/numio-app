"""Workspace-scoped data access layer for chat sessions and messages."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from numio.models.chat import ChatMessage, ChatSession


class ChatRepository:
    """CRUD operations for chat sessions and messages, scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    # --- Session operations ---

    async def create_session(self, title: str | None = None) -> ChatSession:
        chat_session = ChatSession(
            workspace_id=self._workspace_id,
            title=title,
        )
        self._session.add(chat_session)
        await self._session.commit()
        await self._session.refresh(chat_session)
        return chat_session

    async def list_sessions(
        self,
        *,
        ttl_hours: int = 24,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ChatSession], int]:
        """List active sessions (not expired). Returns (sessions, total)."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl_hours)
        conditions = [
            ChatSession.workspace_id == self._workspace_id,
            ChatSession.last_activity_at >= cutoff,
        ]

        count_result = await self._session.execute(
            select(sa_func.count(ChatSession.id)).where(*conditions)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(ChatSession)
            .where(*conditions)
            .order_by(ChatSession.last_activity_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_session(self, session_id: uuid.UUID) -> ChatSession | None:
        result = await self._session.execute(
            select(ChatSession)
            .where(
                ChatSession.id == session_id,
                ChatSession.workspace_id == self._workspace_id,
            )
            .options(selectinload(ChatSession.messages))
        )
        return result.scalar_one_or_none()

    async def delete_session(self, session_id: uuid.UUID) -> bool:
        chat_session = await self._get_session_simple(session_id)
        if chat_session is None:
            return False
        await self._session.delete(chat_session)
        await self._session.commit()
        return True

    async def touch_session(self, session_id: uuid.UUID) -> None:
        """Update last_activity_at for a session."""
        chat_session = await self._get_session_simple(session_id)
        if chat_session is not None:
            chat_session.last_activity_at = datetime.now(timezone.utc)
            await self._session.commit()

    async def is_session_expired(self, session_id: uuid.UUID, ttl_hours: int = 24) -> bool:
        chat_session = await self._get_session_simple(session_id)
        if chat_session is None:
            return True
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl_hours)
        return chat_session.last_activity_at < cutoff

    # --- Message operations ---

    async def add_message(
        self,
        session_id: uuid.UUID,
        role: str,
        content: str,
        data: list[dict] | None = None,
    ) -> ChatMessage:
        msg = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            data=data,
        )
        self._session.add(msg)
        await self._session.commit()
        await self._session.refresh(msg)
        return msg

    async def get_message_count(self, session_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(sa_func.count(ChatMessage.id)).where(ChatMessage.session_id == session_id)
        )
        return result.scalar_one()

    async def get_messages(self, session_id: uuid.UUID, limit: int = 50) -> list[ChatMessage]:
        """Get the most recent messages for a session, ordered oldest-first."""
        result = await self._session.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        messages = list(result.scalars().all())
        messages.reverse()  # oldest first for conversation context
        return messages

    # --- Cleanup ---

    async def delete_expired_sessions(self, ttl_hours: int = 24) -> int:
        """Delete sessions older than ttl_hours. Returns count deleted."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl_hours)
        result = await self._session.execute(
            delete(ChatSession).where(
                ChatSession.workspace_id == self._workspace_id,
                ChatSession.last_activity_at < cutoff,
            )
        )
        await self._session.commit()
        return result.rowcount

    # --- Internal helpers ---

    async def _get_session_simple(self, session_id: uuid.UUID) -> ChatSession | None:
        result = await self._session.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()
