import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as apiLogin } from "../api/auth";

/**
 * Cognito configuration from environment variables.
 * These are baked into the JS bundle at build time via Vite.
 */
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || "";
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const COGNITO_REDIRECT_URI =
  import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/login`;

/**
 * Build the Cognito hosted UI URL for sign-in.
 */
function getCognitoLoginUrl() {
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: COGNITO_REDIRECT_URI,
  });
  return `${COGNITO_DOMAIN}/login?${params}`;
}

/**
 * Exchange an authorization code for tokens using the Cognito token endpoint.
 */
async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: COGNITO_REDIRECT_URI,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json();
}

export default function Login() {
  const { isAuthenticated, onLoginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/inbox";

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Handle Cognito callback (authorization code in URL)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const authError = params.get("error_description") || params.get("error");

    if (authError) {
      setError(authError);
      return;
    }

    if (code && !loading) {
      setLoading(true);
      (async () => {
        try {
          const tokens = await exchangeCodeForTokens(code);
          const user = await apiLogin(tokens.id_token);
          onLoginSuccess(user);
          navigate(from, { replace: true });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [location.search, loading, navigate, from, onLoginSuccess]);

  const hasCognitoConfig = COGNITO_DOMAIN && COGNITO_CLIENT_ID;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Numio</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Cloud cost management platform
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Signing in...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hasCognitoConfig ? (
              <a
                href={getCognitoLoginUrl()}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in with SSO
              </a>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Cognito is not configured. Set AUTH_ENABLED=false in the backend to use
                  bypass mode, or configure VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
