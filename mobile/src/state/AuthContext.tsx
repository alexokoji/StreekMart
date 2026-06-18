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
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
  pointsBalance?: number;
  referralCode?: string | null;
};

export type OAuthProvider = "google" | "apple" | "facebook";

// Payload posted to /api/auth/oauth/{provider}. Mirrors the field set
// produced by each provider's SDK so the server can pick what it needs.
//   - google:    { idToken } (preferred — verifies on Google's JWKs)
//   - apple:     { identityToken, authorizationCode, fullName?, email? }
//                fullName + email arrive only on the FIRST sign-in.
//   - facebook:  { accessToken }
// The server is expected to verify the token with the provider, look up
// or create the user, and return { token, user } the same way the
// password flow does.
export type OAuthPayload = {
  idToken?: string;
  accessToken?: string;
  identityToken?: string;
  authorizationCode?: string;
  email?: string | null;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
};

type Ctx = {
  user: CurrentUser | null;
  ready: boolean;
  signingIn: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: OAuthProvider, payload: OAuthPayload) => Promise<void>;
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

  // OAuth exchange. Client obtains the provider token via the SDK
  // (expo-auth-session for Google/Facebook, expo-apple-authentication
  // for Apple) and POSTs it here. Server contract the backend needs
  // to implement:
  //
  //   POST /api/auth/oauth/google
  //     body: { idToken: string }
  //   POST /api/auth/oauth/apple
  //     body: { identityToken: string, authorizationCode: string,
  //             email?: string, fullName?: { givenName, familyName } }
  //   POST /api/auth/oauth/facebook
  //     body: { accessToken: string }
  //
  // For each, the server:
  //   1. Verifies the token with the provider's JWKs / Graph API.
  //   2. Finds or creates the user (link by verified email if matching).
  //   3. Returns { token, user } — same shape as /api/auth/login.
  //
  // Apple `email` + `fullName` are only present on the very first
  // sign-in; persist them then so future sign-ins (which won't include
  // them) still resolve to the same account.
  const loginWithOAuth = useCallback(
    async (provider: OAuthProvider, payload: OAuthPayload) => {
      setSigningIn(true);
      try {
        const resp = await api.post<LoginResponse>(
          `/api/auth/oauth/${provider}`,
          payload,
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
      value={{ user, ready, signingIn, loginWithPassword, loginWithOAuth, register, logout, refresh }}
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
