import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Gates a route to admins only. Non-admins are redirected to /inbox.
 * Used together with RequireAuth at the app shell — this guard runs after
 * the user is known to be authenticated.
 */
export default function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/inbox" replace />;
  }
  return children;
}
