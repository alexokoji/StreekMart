// Auth context.
//
// Persists the session token in SecureStore (encrypted on iOS, hardware
// keystore on Android). Exposes the current user object + login / logout
// helpers. Cold start hydrates the cached token; if it's still valid the
// /api/me endpoint returns the user.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getAuthToken, setAuthToken } from "../api/client";
import { clearApiCache } from "../api/cache";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  slug?: string | null;
  isSeller: boolean;
  isDesigner: boolean;
  isAdmin?: boolean;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
  pointsBalance?: number;
  referralCode?: string | null;
};

type Ctx = {
  user: CurrentUser | null;
  ready: boolean;
  signingIn: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  phone: string;
  country: string;
  city: string;
  region?: string;
  businessName?: string;
  isSeller?: boolean;
  isDesigner?: boolean;
  referralCode?: string;
};

const AuthContext = createContext<Ctx | null>(null);

// Server response shape — /api/auth/login returns { token } when called
// from the mobile app (web flow uses Set-Cookie; mobile asks for the raw
// token via the X-Mobile-Auth header). Fallback: parse the Set-Cookie if
// the server doesn't return a body token yet.
type LoginResponse = { token?: string; user?: CurrentUser };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const refresh = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<{ user: CurrentUser }>("/api/me");
      setUser(me.user ?? null);
    } catch {
      await setAuthToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const finishLogin = useCallback(async (resp: LoginResponse) => {
    if (resp.token) await setAuthToken(resp.token);
    if (resp.user) {
      setUser(resp.user);
    } else {
      await refresh();
    }
  }, [refresh]);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      setSigningIn(true);
      try {
        const resp = await api.post<LoginResponse>(
          "/api/auth/login",
          { email, password },
          { noAuth: true },
        );
        await finishLogin(resp);
      } finally {
        setSigningIn(false);
      }
    },
    [finishLogin],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setSigningIn(true);
      try {
        const resp = await api.post<LoginResponse>(
          "/api/auth/register",
          input,
          { noAuth: true },
        );
        await finishLogin(resp);
      } finally {
        setSigningIn(false);
      }
    },
    [finishLogin],
  );

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => {});
    await setAuthToken(null);
    await clearApiCache();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, ready, signingIn, loginWithPassword, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
