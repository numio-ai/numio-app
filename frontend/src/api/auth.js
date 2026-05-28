/**
 * API client for authentication endpoints.
 */
import { request } from "./client";

/** Sign in with a Cognito ID token. */
export async function login(idToken) {
  return request("/api/v1/auth/login", {
    method: "POST",
    json: { id_token: idToken },
  });
}

/** Sign out (clears session cookie). */
export async function logout() {
  return request("/api/v1/auth/logout", { method: "POST" });
}

/** Get the current authenticated user. */
export async function getMe() {
  return request("/api/v1/auth/me");
}

/** Create a new API key. */
export async function createApiKey(name) {
  return request("/api/v1/auth/api-keys", {
    method: "POST",
    json: { name },
  });
}
