import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  exchangeCodeForProfile,
  isGoogleEnabled,
  verifyState,
} from "@/lib/google";
import { uniqueSlugFrom } from "@/lib/slug";

export const runtime = "nodejs";

// GET /api/auth/google/callback?code=…&state=…
//
// Google redirects the user here after consent. We:
//   1. Verify the `state` matches the cookie we set in /start (CSRF guard).
//   2. Exchange the code for the user's profile.
//   3. Resolve to an StreekMart user via this preference order:
//        a. Existing googleId match → log in.
//        b. Existing email match    → link googleId to that account, log in.
//        c. Fresh account           → create with the roles carried in state.
//   4. Mint the session cookie and redirect to the requested target (or /).

export async function GET(req: Request) {
  if (!isGoogleEnabled()) {
    return redirectWithError(req, "Google sign-in is not configured.");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) {
    return redirectWithError(req, "Missing OAuth response parameters.");
  }

  const stateCookie = cookies().get(GOOGLE_STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return redirectWithError(req, "OAuth state mismatch. Try again.");
  }
  // One-shot — burn the cookie immediately.
  cookies().delete(GOOGLE_STATE_COOKIE);

  const state = await verifyState(stateParam);
  if (!state) return redirectWithError(req, "OAuth state expired. Try again.");

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;

  let profile;
  try {
    profile = await exchangeCodeForProfile({ code, origin });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Google login failed.";
    return redirectWithError(req, msg);
  }
  if (!profile.email_verified) {
    return redirectWithError(req, "Your Google email is not verified.");
  }

  // 1) Existing googleId.
  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });

  // 2) Link to an existing account that shares the email.
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.sub },
      });
    }
  }

  // 3) Create a fresh user with the roles selected on /register.
  if (!user) {
    const slug = await uniqueSlugFrom(profile.name || profile.email.split("@")[0]);
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
        slug,
        passwordHash: null,
        googleId: profile.sub,
        authProvider: "google",
        avatarUrl: profile.picture ?? null,
        isSeller: state.intent === "signup" ? state.isSeller : false,
        isDesigner: state.intent === "signup" ? state.isDesigner : false,
        cart: { create: {} },
      },
    });
  } else {
    // Lazy-provision a cart for older accounts.
    await prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  // Suspension gate — block sign-in for suspended accounts at the OAuth
  // landing too. Redirect to /login with an error flag so the user sees
  // a clear message instead of a session that immediately 401s.
  if (user.suspendedAt) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "suspended");
    return NextResponse.redirect(url);
  }

  await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });

  // Land the user where they came from, falling back to home.
  const target = state.redirect && state.redirect.startsWith("/") ? state.redirect : "/";
  return NextResponse.redirect(new URL(target, origin));
}

function redirectWithError(req: Request, message: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
