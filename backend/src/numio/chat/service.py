"""Chat service — orchestrates the conversation loop.

Flow:
1. User sends a message
2. Service loads conversation history and sends it + tools to the LLM
3. If LLM requests tool calls, execute them and send results back
4. Repeat until LLM returns a text response
5. Persist messages and return the response
"""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from numio.chat.llm_client import LLMClient, Message, create_llm_client
from numio.chat.tools import TOOL_DEFINITIONS, execute_tool
from numio.core.config import settings
from numio.db.chat_repository import ChatRepository

logger = logging.getLogger("numio.chat.service")

# Maximum tool-call round-trips before we force a text response
MAX_TOOL_ROUNDS = 5


class ChatService:
    """Orchestrates analytics chat conversations."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id
        self._repo = ChatRepository(session, workspace_id)
        self._llm: LLMClient = create_llm_client()

    async def send_message(self, session_id: str, user_message: str) -> dict[str, Any]:
        """Process a user message and return the assistant's response.

        Returns:
            dict with keys: message (str), data (list|None), message_id (UUID)
        """
        import uuid

        sid = uuid.UUID(session_id)

        # Validate session exists and is not expired
        chat_session = await self._repo.get_session(sid)
        if chat_session is None:
            raise ValueError("Session not found")

        if await self._repo.is_session_expired(sid, settings.chat_session_ttl_hours):
            raise ValueError("Session has expired")

        # Check message limit
        msg_count = await self._repo.get_message_count(sid)
        if msg_count >= settings.chat_max_messages_per_session:
            raise ValueError(
                f"Session message limit ({settings.chat_max_messages_per_session}) reached"
            )

        # Persist user message
        await self._repo.add_message(sid, "user", user_message)

        # Load conversation history for context
        history = await self._repo.get_messages(sid, limit=settings.chat_max_messages_per_session)

        # Build message list for LLM
        messages = self._build_llm_messages(history)

        # Run the tool-use loop
        response_text, response_data = await self._tool_use_loop(messages)

        # Persist assistant response
        assistant_msg = await self._repo.add_message(
            sid, "assistant", response_text, data=response_data
        )

        # Update session activity
        await self._repo.touch_session(sid)

        return {
            "message": response_text,
            "data": response_data,
            "message_id": assistant_msg.id,
        }

    async def _tool_use_loop(self, messages: list[Message]) -> tuple[str, list[dict] | None]:
        """Run LLM calls in a loop, executing tools until we get a text response."""
        response_data: list[dict] | None = None

        for round_num in range(MAX_TOOL_ROUNDS):
            llm_response = await self._llm.chat(messages, TOOL_DEFINITIONS)

            if not llm_response.tool_calls:
                # LLM returned a final text response
                return llm_response.text or "", response_data

            # Build the assistant message with tool_use blocks
            assistant_content = []
            if llm_response.text:
                assistant_content.append({"type": "text", "text": llm_response.text})
            for tc in llm_response.tool_calls:
                assistant_content.append(
                    {
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.input,
                    }
                )
            messages.append(Message(role="assistant", content=assistant_content))

            # Execute each tool call
            tool_results = []
            for tc in llm_response.tool_calls:
                logger.info("Executing tool %s (round %d)", tc.name, round_num + 1)
                result = await execute_tool(tc.name, tc.input, self._session, self._workspace_id)

                # Collect structured data for the response
                if _has_tabular_data(result):
                    response_data = _extract_tabular_data(result)

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "content": json.dumps(result),
                    }
                )

            # Send tool results back to LLM
            messages.append(Message(role="tool_result", content=tool_results))

        # Exhausted rounds — return whatever text we have
        logger.warning("Max tool rounds (%d) reached", MAX_TOOL_ROUNDS)
        return llm_response.text or "I wasn't able to complete the analysis.", response_data

    def _build_llm_messages(self, history: list) -> list[Message]:
        """Convert DB message history into LLM message format."""
        messages: list[Message] = []
        for msg in history:
            messages.append(Message(role=msg.role, content=msg.content))
        return messages


def _has_tabular_data(result: dict) -> bool:
    """Check if a tool result contains data suitable for table rendering."""
    for key in ("findings", "recommendations", "items", "by_category", "data_points"):
        if key in result and isinstance(result[key], list) and len(result[key]) > 0:
            return True
    return False


def _extract_tabular_data(result: dict) -> list[dict]:
    """Extract the primary list from a tool result for structured response."""
    for key in ("findings", "recommendations", "items", "by_category", "data_points"):
        if key in result and isinstance(result[key], list) and len(result[key]) > 0:
            return result[key]
    return []
