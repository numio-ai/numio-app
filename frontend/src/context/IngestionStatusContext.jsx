/**
 * IngestionStatusContext
 *
 * Single shared subscription to /api/v1/jobs/ingestion-status used by:
 *   - Top-bar Data status pill + popover (Task 04)
 *   - Dashboard freshness labels (Task 05)
 *   - Global app-shell failure banner (Task 07)
 *
 * Responsibilities:
 *   - Fetch once on mount, poll every POLL_INTERVAL_MS while the tab is
 *     visible, pause while hidden.
 *   - Cache the latest status + account list so every consumer shares one
 *     network call.
 *   - Expose a stable value object so consumers memoize cleanly.
 *
 * Consumers use `useIngestionStatus()`. Derivation helpers live in
 * `src/lib/ingestionStatus.js` so they can be unit-tested without React.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getIngestionStatus } from "../api/jobs";
import { listAccounts } from "../api/workspace";

const POLL_INTERVAL_MS = 60_000;

const IngestionStatusContext = createContext(null);

export function IngestionStatusProvider({ children }) {
  const [statuses, setStatuses] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const intervalRef = useRef(null);

  const fetchStatus = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [statusRes, accountsRes] = await Promise.all([
        getIngestionStatus().catch((e) => {
          // Preserve the error so consumers can show a neutral "can't
          // determine" state, but don't crash the app shell.
          throw e;
        }),
        listAccounts().catch(() => ({ accounts: [] })),
      ]);
      setStatuses(statusRes?.statuses || []);
      setAccounts(accountsRes?.accounts || []);
      setLastFetchedAt(new Date());
    } catch (e) {
      setError(e?.message || "Failed to load ingestion status");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Page-visibility-aware polling: don't waste cycles or quota while the
  // tab is hidden; resume immediately on focus.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchStatus({ silent: true });
    };
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchStatus({ silent: true });
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [fetchStatus]);

  const value = {
    statuses,
    accounts,
    loading,
    error,
    lastFetchedAt,
    refresh: () => fetchStatus({ silent: true }),
  };

  return (
    <IngestionStatusContext.Provider value={value}>
      {children}
    </IngestionStatusContext.Provider>
  );
}

/**
 * Access the shared ingestion status. Returns a safe default when used
 * outside the provider so the app shell stays robust against render-order
 * accidents.
 */
export function useIngestionStatus() {
  const ctx = useContext(IngestionStatusContext);
  if (!ctx) {
    return {
      statuses: null,
      accounts: [],
      loading: true,
      error: null,
      lastFetchedAt: null,
      refresh: () => {},
    };
  }
  return ctx;
}
