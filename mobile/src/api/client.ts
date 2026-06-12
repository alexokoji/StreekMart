// Lightweight fetch wrapper for the StreekMart mobile app.
//
// Talks to the same Next.js API routes the web app uses. Sends the auth
// token from SecureStore on every request, sets the User-Agent so the
// server can route mobile-app traffic separately if it ever wants to.

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "https://www.streekmart.online";

const TOKEN_KEY = "streekmart:session";
const APP_UA_TAG = "StreekMartApp/2.0 (Native)";

let cachedToken: string | null = null;
let tokenLoaded = false;

async function loadToken(): Promise<string | null> {
  if (tokenLoaded) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  tokenLoaded = true;
  return cachedToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;
  tokenLoaded = true;
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }
}

export async function getAuthToken(): Promise<string | null> {
  return loadToken();
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOpts = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  // Skip Authorization header â€” used by login/register requests.
  noAuth?: boolean;
};

function buildUrl(path: string, query?: RequestOpts["query"]): string {
  const u = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const token = opts.noAuth ? null : await loadToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": APP_UA_TAG,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // Mobile auth uses Authorization: Bearer rather than a cookie because
  // RN's fetch cannot read the httpOnly cookie the web server sets. The
  // server's getSession() checks the Bearer header first, then falls
  // back to the cookie for browser requests.
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      isJson && data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOpts["query"], opts?: Omit<RequestOpts, "method" | "body" | "query">) =>
    request<T>(path, { ...opts, method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOpts, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOpts, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};

export { API_URL };
