/**
 * API client for Chat endpoints (P7.1).
 */
import { request } from "./client";

/** Create a new chat session. */
export async function createSession(title) {
  return request("/api/v1/chat/sessions", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

/** List active chat sessions. */
export async function listSessions(limit = 50, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request(`/api/v1/chat/sessions?${params}`);
}

/** Get session detail including message history. */
export async function getSession(sessionId) {
  return request(`/api/v1/chat/sessions/${sessionId}`);
}

/** Delete a chat session. */
export async function deleteSession(sessionId) {
  return request(`/api/v1/chat/sessions/${sessionId}`, { method: "DELETE" });
}

/** Send a message and get the assistant's response. */
export async function sendChatMessage(sessionId, message) {
  return request(`/api/v1/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
