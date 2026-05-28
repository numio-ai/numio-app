/**
 * API client for the Data Explorer admin endpoints.
 */
import { request as baseRequest, ApiError } from "./client";

/**
 * Retained as a subclass of ApiError. DataExplorerPage reads `.status` and
 * `.errorCode` off the thrown error; this preserves that surface so the page
 * works unchanged through the shared client.
 */
export class DataExplorerError extends ApiError {
  constructor(message, { status, errorCode } = {}) {
    super(message, { status, errorCode });
    this.name = "DataExplorerError";
  }
}

// Rethrow the shared client's ApiError as a DataExplorerError, preserving the
// status/errorCode fields the Data Explorer UI surfaces to the user.
async function request(path, options = {}) {
  try {
    return await baseRequest(path, options);
  } catch (err) {
    if (err instanceof ApiError) {
      throw new DataExplorerError(err.message, { status: err.status, errorCode: err.errorCode });
    }
    throw err;
  }
}

export async function runQuery(sql) {
  return request("/api/v1/data-explorer/query", {
    method: "POST",
    json: { sql },
  });
}

export async function listSavedQueries() {
  return request("/api/v1/data-explorer/queries");
}

export async function createSavedQuery({ name, sql, description }) {
  return request("/api/v1/data-explorer/queries", {
    method: "POST",
    json: { name, sql, description: description ?? null },
  });
}

export async function updateSavedQuery(id, patch) {
  return request(`/api/v1/data-explorer/queries/${id}`, {
    method: "PUT",
    json: patch,
  });
}

export async function deleteSavedQuery(id) {
  return request(`/api/v1/data-explorer/queries/${id}`, {
    method: "DELETE",
  });
}
