import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, logout as apiLogout } from "../api/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider — manages the authenticated user state.
 *
 * On mount, calls /api/v1/auth/me to check if there's an active session.
 * If auth is disabled on the backend (AUTH_ENABLED=false), /me returns
 * the bypass admin user and no login is needed.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      setError(null);
    } catch (err) {
      setUser(null);
      // 401 is expected when not logged in — not an error
      if (!err.message?.includes("Not authenticated") && !err.message?.includes("401")) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore logout errors
    }
    setUser(null);
  }, []);

  const onLoginSuccess = useCallback((userData) => {
    setUser(userData);
  }, []);

  const value = {
    user,
    loading,
    error,
    logout,
    onLoginSuccess,
    checkSession,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
