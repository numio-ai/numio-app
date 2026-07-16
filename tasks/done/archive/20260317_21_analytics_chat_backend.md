---
status: done
phase: 7
task_id: P7.1
---

# Analytics Chat Backend

## Prerequisites

- **P3.3 — Cost attribution & cost views API:** Provides cost data tools (get_cost_summary, get_cost_by_dimension, spend over time) that the chat LLM calls to answer cost questions.
- **P4.3 — Findings management:** Provides findings data tools (list_findings, get_finding_detail) for anomaly/zombie/policy questions.
- **P6.1 — Recommendations engine:** Provides recommendations data tools (list_recommendations) for optimization questions.

## Problem Statement

Operators need to query cost data using natural language without navigating the full UI. A chat interface that understands questions like "What did team X spend last month?" or "Why did costs increase?" provides faster access to insights.

## Scope

**In scope:**
- Natural language interface for querying cost data. Example queries:
  - "What was total spend last month?"
  - "What did team X spend last month?"
  - "Why did costs increase?"
  - "Show top 5 cost drivers"
  - "What are the open anomalies?"
  - "How many zombie resources do we have?"
- Chat is read-only — no state-changing actions can be triggered via chat in MVP
- Chat queries are scoped to the customer's workspace data
- Responses include relevant data (numbers, breakdowns, tables) and can reference specific findings or recommendations
- Chat session management: maintain conversation history within a session, support starting new sessions, sessions are workspace-scoped
- **LLM integration (dual-mode):** The backend supports two LLM backends, selectable via configuration:
  - **LMGate** (preferred): Backend talks to LMGate API (https://github.com/vkroz/lmgate), which routes to the customer-configured LLM provider. LMGate is a separate service deployed independently.
  - **Anthropic API** (alternate mode): When this mode is selected in configuration, the backend calls Anthropic APIs directly. There is no automatic switch to Anthropic when LMGate is down — see LLM error handling below.
  - The active mode is set via configuration. The chat logic must not depend on which backend is active — the LLM integration layer abstracts this.
- **LLM integration architecture (tool-use pattern):** The chat backend uses a tool-use pattern. The LLM is provided with tool definitions matching Numio's core APIs (get_cost_summary, get_cost_by_dimension, list_findings, list_recommendations, etc. — conceptually the same tools as the MCP server P7.2). When the user asks a question, the LLM decides which tools to call, the backend executes them against the core business logic layer, and the LLM generates a natural-language response from the results. The chat backend and MCP server (P7.2) should share tool definitions where possible to avoid divergence.
- REST API endpoints for: send message (returns response), list sessions, get session history, create new session
- **Chat response schema:** The chat API response includes a `message` field (text/markdown for display) and an optional `data` field (structured JSON array for table rendering by the frontend P7.3). The frontend uses `data` when present to render tables; otherwise displays `message` as text/markdown.
- **Session storage:** Sessions are stored in the database (workspace-scoped). Sessions expire after 24 hours of inactivity. Session history is limited to the last 50 messages per session (configurable).
- **LLM error handling:** If the configured LLM backend (LMGate or Anthropic) is unreachable or returns an error, the chat API returns a 503 with a clear user-friendly error message. No automatic fallback from LMGate to Anthropic — the configured backend is authoritative. Switching between backends requires a configuration change only.

**Out of scope:**
- Chat triggering any write operations or state changes
- Streaming responses (request/response is sufficient for MVP)
- Voice input
- Frontend chat widget (separate task P7.3)
- Contributing to LMGate if it lacks required functionality (separate task as needed)
- Deploying or managing LMGate (it is a separate service owned by the customer)

## Constraints

- LMGate is an external dependency deployed separately — Numio does not include it in its deployment
- If LMGate lacks required APIs, a separate task will be created to contribute the needed functionality to LMGate

## Acceptance Criteria

1. Chat correctly answers "What was total spend last month?" with accurate data from ingested costs
2. Chat correctly answers "What are the top cost drivers?" with a ranked list
3. Chat correctly answers "How many open findings are there?" referencing the findings system
4. Chat uses the tool-use pattern: LLM calls tool definitions to fetch data, then generates a response
5. Chat does not allow triggering any state-changing operations
6. Conversation history is maintained within a session (database-persisted)
7. Chat responses include a `message` field and an optional `data` field with structured JSON for table rendering
8. When configured for LMGate, chat communicates via LMGate API
9. When configured for Anthropic fallback, chat communicates via Anthropic API directly
10. Switching between LMGate and Anthropic modes requires only a configuration change, no code changes
11. When the LLM backend is unreachable, the chat API returns a 503 with a user-friendly error message
12. List sessions API returns sessions with last-activity timestamps; get session history returns the full message thread

## Quality Gates

- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`
- API endpoints documented in OpenAPI
