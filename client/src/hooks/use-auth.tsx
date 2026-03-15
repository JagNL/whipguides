import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

// ─── Types ───────────────────────────────────────────────────
interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  memberSince: string;
  rating: number | null;
  reviewCount: number | null;
  verified: boolean | null;
  responseTime: string | null;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "wg_session";

function getStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    // Check if expired (with 60s buffer)
    if (s.expires_at && Date.now() / 1000 > s.expires_at - 60) return null;
    return s;
  } catch {
    return null;
  }
}

function storeSession(s: AuthSession | null) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

// ─── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((newSession: AuthSession, newUser: AuthUser) => {
    storeSession(newSession);
    setSession(newSession);
    setUser(newUser);
  }, []);

  const clearSession = useCallback(() => {
    storeSession(null);
    setSession(null);
    setUser(null);
    queryClient.clear();
  }, []);

  // Restore session on mount
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Verify token is still valid by fetching /me
    apiRequest("GET", "/api/auth/me", undefined)
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setSession(stored);
          setUser(data.user);
        } else {
          storeSession(null);
        }
      })
      .catch(() => storeSession(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!session) return;
    const msUntilExpiry = session.expires_at * 1000 - Date.now() - 60_000;
    if (msUntilExpiry <= 0) return;
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest("POST", "/api/auth/refresh", { refresh_token: session.refresh_token });
        const data = await res.json();
        if (data.session && user) applySession(data.session, user);
      } catch {
        clearSession();
      }
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [session, user, applySession, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    applySession(data.session, data.user);
  }, [applySession]);

  const register = useCallback(async (email: string, password: string, username: string, displayName: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, password, username, displayName });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    applySession(data.session, data.user);
  }, [applySession]);

  const logout = useCallback(async () => {
    if (session) {
      try {
        await apiRequest("POST", "/api/auth/logout", {});
      } catch { /* ignore */ }
    }
    clearSession();
  }, [session, clearSession]);

  const refreshUser = useCallback(async () => {
    if (!session) return;
    try {
      const res = await apiRequest("GET", "/api/auth/me", undefined);
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch { /* ignore */ }
  }, [session]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
