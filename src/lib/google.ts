// Hand-rolled Google OAuth 2.0 helpers.
//
// We don't pull in next-auth or @auth/core because the rest of the auth
// stack is hand-rolled JWT (`src/lib/jwt.ts`) and the integration is small
// enough to do directly. This module is the only place we talk to Google.

import { SignJWT, jwtVerify } from "jose";

const STATE_COOKIE = "upclo_oauth_state";
const STATE_TTL = 60 * 10; // 10 minutes — plenty for a Google round-trip.

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-please-change-in-production-min32",
);

export const GOOGLE_STATE_COOKIE = STATE_COOKIE;

export function isGoogleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not set");
  return id;
}

export function googleClientSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return s;
}

export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

// Inputs the caller stuffs into the OAuth `state` parameter so the callback
// can recover them. Used to:
//   - Carry the role choice (isSeller / isDesigner) from /register.
//   - Remember where the user wanted to land after auth.
export type StatePayload = {
  intent: "login" | "signup";
  isSeller: boolean;
  isDesigner: boolean;
  redirect?: string;
};

// Sign + verify the state via JWT so a malicious party can't forge it.
export async function signState(payload: StatePayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL}s`)
    .sign(SECRET);
}

export async function verifyState(token: string): Promise<StatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as StatePayload;
  } catch {
    return null;
  }
}

export function buildAuthUrl(args: {
  origin: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: buildRedirectUri(args.origin),
    response_type: "code",
    scope: "openid email profile",
    state: args.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;        // Stable Google user ID.
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
};

// Exchange the auth code for an access token, then fetch the userinfo.
// Returns the verified profile or throws.
export async function exchangeCodeForProfile(args: {
  code: string;
  origin: string;
}): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: buildRedirectUri(args.origin),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => "");
    throw new Error(`Token exchange failed: ${tokenRes.status} ${txt}`);
  }

  const token = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!token.access_token) throw new Error("Token exchange returned no access_token");

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    const txt = await userRes.text().catch(() => "");
    throw new Error(`userinfo failed: ${userRes.status} ${txt}`);
  }

  const profile = (await userRes.json()) as GoogleProfile;
  if (!profile.email || !profile.sub) {
    throw new Error("userinfo response missing email/sub");
  }
  return profile;
}
