import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  subscribeAuthSession,
} from "../api/client";
import { fetchCurrentUser, loginWithPassword } from "../api/authApi";

const AuthContext = createContext(null);

function normalizeRoles(user) {
  if (!Array.isArray(user?.roles)) {
    return [];
  }

  return user.roles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getAuthSession());
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((nextSession) => {
      setSession(nextSession);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const existingSession = getAuthSession();
      if (!existingSession?.tokens?.accessToken && !existingSession?.tokens?.refreshToken) {
        if (!cancelled) {
          setInitializing(false);
        }
        return;
      }

      try {
        const payload = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        const nextSession = setAuthSession({
          ...existingSession,
          user: payload?.user || existingSession?.user || null,
        });

        setSession(nextSession);
      } catch (_error) {
        if (!cancelled && !getAuthSession()) {
          clearAuthSession();
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const payload = await loginWithPassword({ email, password });
    const nextSession = setAuthSession({
      user: payload?.user || null,
      tokens: payload?.tokens || null,
    });

    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const user = session?.user || null;
  const roles = useMemo(() => normalizeRoles(user), [user]);

  const hasAnyRole = useCallback(
    (allowedRoles) => {
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return true;
      }

      if (roles.includes("super_admin")) {
        return true;
      }

      const allowedSet = new Set(
        allowedRoles
          .map((role) => String(role || "").trim().toLowerCase())
          .filter(Boolean)
      );

      return roles.some((role) => allowedSet.has(role));
    },
    [roles]
  );

  const isAuthenticated = Boolean(session?.tokens?.accessToken && user);

  const value = useMemo(
    () => ({
      initializing,
      isAuthenticated,
      session,
      user,
      roles,
      login,
      logout,
      hasAnyRole,
    }),
    [initializing, isAuthenticated, session, user, roles, login, logout, hasAnyRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider.");
  }

  return context;
}
