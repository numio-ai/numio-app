/**
 * Mock handlers for the chat API domain — mirrors src/api/chat.js.
 */
import { store } from "./store.js";
import { notFound } from "./errors.js";

const summary = (s) => ({ id: s.id, workspace_id: s.workspace_id, title: s.title, created_at: s.created_at, last_activity_at: s.last_activity_at });

export const chatHandlers = [
  { method: "POST", path: "/api/v1/chat/sessions", handler: ({ body }) => store.createChatSession(body?.title) },
  { method: "GET", path: "/api/v1/chat/sessions", handler: () => ({ sessions: store.chatSessions().map(summary), count: store.chatSessions().length }) },
  { method: "GET", path: "/api/v1/chat/sessions/:id", handler: ({ params }) => store.chatSession(params.id) || notFound("Session") },
  { method: "DELETE", path: "/api/v1/chat/sessions/:id", handler: ({ params }) => { store.deleteChatSession(params.id); return null; } },
  { method: "POST", path: "/api/v1/chat/sessions/:id/messages", handler: ({ params, body }) => store.addChatMessage(params.id, body?.message) },
];
