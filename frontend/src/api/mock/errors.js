/**
 * Shared error helper for mock handlers. A handler calls notFound() to mirror a
 * real endpoint's 404 (e.g. an unknown id); the registry's own 404 is reserved
 * for an unregistered path (a coverage gap).
 */
import { ApiError } from "../client";

export function notFound(what = "Resource") {
  throw new ApiError(`${what} not found`, { status: 404 });
}
