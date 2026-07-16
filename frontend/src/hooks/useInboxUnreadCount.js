import { useEffect, useRef, useState } from "react";

import { fetchInboxBadge } from "../api/inbox";

/**
 * Live unread-count hook for the IA v2 Inbox badge.
 *
 * Fetches `/api/v1/inbox/badge` on mount and polls every 60s. Returns
 * the current `unread_count` as a number; before the first response (or
 * on transient fetch failure) returns 0 so the badge stays hidden rather
 * than flashing a stale value.
 *
 * The hook signature `() => number` is preserved so V2Sidebar.jsx and
 * InboxPage.jsx need no changes.
 */
const POLL_INTERVAL_MS = 60_000;

export default function useInboxUnreadCount() {
  const [count, setCount] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const load = async () => {
      try {
        const data = await fetchInboxBadge();
        if (!cancelledRef.current && data && typeof data.unread_count === "number") {
          setCount(data.unread_count);
        }
      } catch {
        // Transient failure — leave the prior count. Badge silently stays at
        // its last known good value; a refresh will retry within 60s.
      }
    };

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, []);

  return count;
}
