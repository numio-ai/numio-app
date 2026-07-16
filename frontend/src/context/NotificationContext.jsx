import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, getNotificationStreamUrl } from "../api/dashboard";

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 50 });
      if (data) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      if (data) setUnreadCount(data.count);
    } catch {
      // silently ignore — badge just won't update
    }
  }, []);

  const markRead = useCallback(async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // SSE connection for real-time updates
  useEffect(() => {
    const url = getNotificationStreamUrl();
    if (!url) return;

    let es;
    try {
      es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          setNotifications((prev) => [notification, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);
        } catch {
          // ignore malformed SSE data
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects; no action needed
      };
    } catch {
      // SSE not supported or URL invalid — degrade gracefully
    }

    return () => {
      if (es) es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
