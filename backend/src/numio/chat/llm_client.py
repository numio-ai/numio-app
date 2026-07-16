"""LLM client abstraction with LMGate and Anthropic implementations.

Both clients implement the same interface: send messages with tool definitions,
receive either a text response or tool-use requests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from numio.core.config import settings

logger = logging.getLogger("numio.chat.llm")

SYSTEM_PROMPT = (
    "You are Numio, an AI assistant for cloud cost management. "
    "You help users understand their cloud spending, identify cost anomalies, "
    "and find optimization opportunities. "
    "You have access to tools that query the user's cost data, findings, and recommendations. "
    "Always use the appropriate tool to fetch data before answering — never guess numbers. "
    "When presenting tabular data, include it in your response clearly. "
    "Be concise and factual. If the data is empty, say so clearly."
)


# ---------------------------------------------------------------------------
# Shared data structures
# ---------------------------------------------------------------------------


@dataclass
class ToolCall:
    """A tool call requested by the LLM."""

    id: str
    name: str
    input: dict[str, Any]


@dataclass
class LLMResponse:
    """Response from the LLM — either text content, tool calls, or both."""

    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str | None = None


@dataclass
class Message:
    """A conversation message."""

    role: str  # "user", "assistant", "tool_result"
    content: Any  # str or list of content blocks


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


class LLMClient(Protocol):
    async def chat(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
    ) -> LLMResponse: ...


# ---------------------------------------------------------------------------
# Anthropic implementation
# ---------------------------------------------------------------------------


class AnthropicLLMClient:
    """Calls Anthropic API directly using the anthropic SDK."""

    def __init__(self) -> None:
        import anthropic

        self._client = anthropic.AsyncAnthropic(api_key=settings.chat_anthropic_api_key)
        self._model = settings.chat_anthropic_model

    async def chat(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
    ) -> LLMResponse:
        api_messages = _build_anthropic_messages(messages)
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=api_messages,
            tools=tools,
        )
        return _parse_anthropic_response(response)


# ---------------------------------------------------------------------------
# LMGate implementation
# ---------------------------------------------------------------------------


class LMGateLLMClient:
    """Calls LMGate API, which proxies to customer-configured LLM provider.

    LMGate exposes an Anthropic-compatible /messages endpoint.
    """

    def __init__(self) -> None:
        self._base_url = settings.chat_lmgate_url.rstrip("/")
        self._model = settings.chat_lmgate_model
        self._http = httpx.AsyncClient(timeout=60.0)

    async def chat(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
    ) -> LLMResponse:
        api_messages = _build_anthropic_messages(messages)
        payload = {
            "model": self._model,
            "max_tokens": 4096,
            "system": SYSTEM_PROMPT,
            "messages": api_messages,
            "tools": tools,
        }
        resp = await self._http.post(
            f"{self._base_url}/v1/messages",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return _parse_lmgate_response(data)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_llm_client() -> LLMClient:
    """Create the LLM client based on configuration."""
    backend = settings.chat_llm_backend.lower()
    if backend == "anthropic":
        logger.info("Using Anthropic LLM backend (model=%s)", settings.chat_anthropic_model)
        return AnthropicLLMClient()
    elif backend == "lmgate":
        logger.info("Using LMGate LLM backend (url=%s)", settings.chat_lmgate_url)
        return LMGateLLMClient()
    else:
        raise ValueError(f"Unknown chat_llm_backend: {backend!r}. Use 'lmgate' or 'anthropic'.")


# ---------------------------------------------------------------------------
# Message format helpers (Anthropic-compatible)
# ---------------------------------------------------------------------------


def _build_anthropic_messages(messages: list[Message]) -> list[dict]:
    """Convert internal messages to Anthropic API format."""
    result = []
    for msg in messages:
        if msg.role == "user":
            result.append({"role": "user", "content": msg.content})
        elif msg.role == "assistant":
            result.append({"role": "assistant", "content": msg.content})
        elif msg.role == "tool_result":
            # tool_result messages carry tool_use_id + content
            result.append({"role": "user", "content": msg.content})
    return result


def _parse_anthropic_response(response: Any) -> LLMResponse:
    """Parse an Anthropic SDK response into our LLMResponse."""
    text_parts = []
    tool_calls = []

    for block in response.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use":
            tool_calls.append(ToolCall(id=block.id, name=block.name, input=block.input))

    return LLMResponse(
        text="\n".join(text_parts) if text_parts else None,
        tool_calls=tool_calls,
        stop_reason=response.stop_reason,
    )


def _parse_lmgate_response(data: dict) -> LLMResponse:
    """Parse a LMGate JSON response (Anthropic-compatible format)."""
    text_parts = []
    tool_calls = []

    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block["text"])
        elif block.get("type") == "tool_use":
            tool_calls.append(
                ToolCall(
                    id=block["id"],
                    name=block["name"],
                    input=block.get("input", {}),
                )
            )

    return LLMResponse(
        text="\n".join(text_parts) if text_parts else None,
        tool_calls=tool_calls,
        stop_reason=data.get("stop_reason"),
    )
