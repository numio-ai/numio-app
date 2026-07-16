---
status: done
phase: 7
task_id: P7.3
---

# Frontend: Chat Widget

## Prerequisites

- **P7.1 — Analytics chat backend:** Provides the chat API including message send/receive, session management, and the response schema with `message` and `data` fields.

## Problem Statement

The current chat widget is a prototype with no backend connection. Customers need a functional chat interface that lets them ask natural language questions about their cost data and get answers with inline data displays.

## Scope

**In scope:**
- Replace the prototype chat widget with a functional implementation connected to the chat backend API (P7.1)
- Chat panel slides in from the side of the screen (existing UX pattern from prototype)
- Message input with send button
- Response rendering supports: plain text/markdown (from the `message` field), and data tables rendered from the `data` field in the chat API response (see P7.1 response schema). When `data` is present, the widget renders a formatted table. When absent, the widget renders `message` as text/markdown.
- Conversation history displayed within the session
- Ability to start a new chat session
- Loading indicator while waiting for response

**Out of scope:**
- Chart rendering in chat responses (tables and text are sufficient for MVP)
- Voice input
- Chat-initiated actions (chat is read-only)
- Streaming response display

## Acceptance Criteria

1. Chat widget opens and connects to the backend chat API
2. User can type a question and receive a response with relevant cost data
3. Responses with tabular data render as formatted tables inline in the chat
4. Conversation history is maintained during the session
5. Starting a new session clears the history
6. Loading state is shown while waiting for a response
7. Error states (backend unavailable, LLM error) are handled gracefully with user-friendly messages

## Quality Gates

- Chat widget functions correctly with backend API
- Frontend builds without errors: `cd frontend && npm run build`
