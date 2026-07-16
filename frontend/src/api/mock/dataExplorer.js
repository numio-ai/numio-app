/**
 * Mock handlers for the data-explorer API domain — mirrors src/api/dataExplorer.js.
 */
import { store } from "./store.js";
import { notFound } from "./errors.js";
import * as platform from "../../mocks/synthetic/platform";

export const dataExplorerHandlers = [
  { method: "POST", path: "/api/v1/data-explorer/query", handler: () => platform.runQueryResult() },
  { method: "GET", path: "/api/v1/data-explorer/queries", handler: () => ({ items: store.savedQueries(), count: store.savedQueries().length }) },
  { method: "POST", path: "/api/v1/data-explorer/queries", handler: ({ body }) => store.createSavedQuery(body || {}) },
  { method: "PUT", path: "/api/v1/data-explorer/queries/:id", handler: ({ params, body }) => store.updateSavedQuery(params.id, body || {}) || notFound("Query") },
  { method: "DELETE", path: "/api/v1/data-explorer/queries/:id", handler: ({ params }) => { store.deleteSavedQuery(params.id); return null; } },
];
