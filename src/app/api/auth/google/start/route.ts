import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GOOGLE_STATE_COOKIE,
  buildAuthUrl,
  isGoogleEnabled,
  signState,
} from "@/lib/google";

// `node:crypto` indirectly used by jose; pin to Node to be safe.
export const runtime = "nodejs";

// GET /api/auth/google/start?intent=signup&isSeller=1&isDesigner=0&redirect=/account
//
// Mints a signed `state` parameter (carrying the role choice + intended
// landing path) and redirects the browser to Google's consent screen.

export async function GET(req: Request) {
  if (!isGoogleEnabled()) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const intent = (url.searchParams.get("intent") ?? "login") === "signup" ? "signup" : "login";
  const isSeller = url.searchParams.get("isSeller") === "1";
  const isDesigner = url.searchParams.get("isDesigner") === "1";
  const redirect = url.searchParams.get("redirect") ?? undefined;

  const state = await signState({ intent, isSeller, isDesigner, redirect });

  // Mirror the state into an httpOnly cookie too. Google returns it in the
  // query string, but cross-checking against the cookie blocks a forged
  // callback hitting `/callback?state=…` directly.
  cookies().set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
    secure: process.env.NODE_ENV === "production",
  });

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  return NextResponse.redirect(buildAuthUrl({ origin, state }));
}
