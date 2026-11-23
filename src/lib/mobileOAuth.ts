// Server-side verification of the provider tokens the mobile app collects
// with the native Google / Apple / Facebook SDKs. The web uses the
// redirect-based Google flow (src/lib/google.ts); this is the token-based
// equivalent for the app. Each verifier returns a normalised profile or
// throws an Error with a user-readable message.

import { createRemoteJWKSet, jwtVerify } from "jose";

export type OAuthProfile = {
  provider: "google" | "apple" | "facebook";
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string | null;
};

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function csv(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Client IDs the Google id_token may have been issued to (web + native apps). */
export function googleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    ...csv(process.env.GOOGLE_MOBILE_CLIENT_IDS),
  ].filter((x): x is string => !!x);
}

export async function verifyGoogleIdToken(idToken: string): Promise<OAuthProfile> {
  const audience = googleAudiences();
  if (audience.length === 0) throw new Error("Google sign-in isn't set up on the server yet.");
  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
    });
    if (!payload.email || !payload.sub) throw new Error("no email");
    return {
      provider: "google",
      sub: String(payload.sub),
      email: String(payload.email).toLowerCase(),
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: String(payload.name ?? "") || String(payload.email).split("@")[0],
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    throw new Error("Couldn't verify your Google sign-in. Try again.");
  }
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  extra?: { email?: string | null; fullName?: { givenName?: string | null; familyName?: string | null } | null },
): Promise<OAuthProfile> {
  const audience = csv(process.env.APPLE_CLIENT_IDS);
  if (audience.length === 0) audience.push("com.streekmart.app");
  try {
    const { payload } = await jwtVerify(identityToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience,
    });
    const email = String(payload.email ?? extra?.email ?? "").toLowerCase();
    if (!payload.sub || !email) throw new Error("no email");
    const given = extra?.fullName?.givenName ?? "";
    const family = extra?.fullName?.familyName ?? "";
    return {
      provider: "apple",
      sub: String(payload.sub),
      email,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: `${given} ${family}`.trim() || email.split("@")[0],
      picture: null,
    };
  } catch {
    throw new Error("Couldn't verify your Apple sign-in. Try again.");
  }
}

export async function verifyFacebookAccessToken(accessToken: string): Promise<OAuthProfile> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Facebook sign-in isn't set up on the server yet.");
  try {
    // Confirm the token was issued to OUR app, not another Facebook app.
    const dbg = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10_000) },
    ).then((r) => r.json());
    if (!dbg?.data?.is_valid || String(dbg.data.app_id) !== appId) throw new Error("bad token");
    const me = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    ).then((r) => r.json());
    if (!me?.id || !me?.email) {
      throw new Error("Facebook didn't share an email address. Allow email access and try again.");
    }
    return {
      provider: "facebook",
      sub: String(me.id),
      email: String(me.email).toLowerCase(),
      emailVerified: true,
      name: String(me.name ?? "") || String(me.email).split("@")[0],
      picture: me.picture?.data?.url ?? null,
    };
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith("Facebook") ? e.message : "Couldn't verify your Facebook sign-in. Try again.");
  }
}
