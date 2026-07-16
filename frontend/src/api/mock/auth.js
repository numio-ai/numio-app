/**
 * Mock handlers for the auth API domain — mirrors src/api/auth.js.
 */
import { store } from "./store.js";

export const authHandlers = [
  { method: "GET", path: "/api/v1/auth/me", handler: () => store.me() },
  { method: "POST", path: "/api/v1/auth/login", handler: () => store.me() },
  { method: "POST", path: "/api/v1/auth/logout", handler: () => ({ message: "Logged out" }) },
  { method: "POST", path: "/api/v1/auth/api-keys", handler: ({ body }) => store.createApiKey(body?.name) },
];
