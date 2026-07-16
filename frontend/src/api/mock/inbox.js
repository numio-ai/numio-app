/**
 * Mock handlers for the inbox API domain — mirrors src/api/inbox.js.
 */
import { store } from "./store.js";

export const inboxHandlers = [
  { method: "GET", path: "/api/v1/inbox/badge", handler: () => store.inboxBadge() },
  {
    method: "POST",
    path: "/api/v1/inbox/findings/:id/ack",
    handler: ({ params }) => store.ackInboxFinding(params.id),
  },
];
