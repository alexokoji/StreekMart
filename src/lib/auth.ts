import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Permission } from "./enums";
import { prisma } from "./db";
import { signSession, verifySession, type SessionPayload } from "./jwt";

export const SESSION_COOKIE = "upclo_session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      slug: true,
      // Contact + brand identity. Surfaced on every dashboard so the
      // ProfileCompletionBanner can decide whether to nag the user.
      phone: true,
      businessName: true,
      businessNameLower: true,
      coverImageUrl: true,
      isSeller: true,
      isDesigner: true,
      sellerVerified: true,
      designerVerified: true,
      isAdmin: true,
      bio: true,
      avatarUrl: true,
      exposureScore: true,
      country: true,
      region: true,
      city: true,
      deliveryWithinCityCents: true,
      deliveryOutsideCityCents: true,
      deliveryOutsideCountryCents: true,
    },
  });
}

// Admin guard for /admin pages. Throws via redirect if not signed in or
// not flagged as admin.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");
  return user;
}

// Admin guard for /api/admin/* route handlers.
export async function requireApiAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const me = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, isAdmin: true },
  });
  if (!me?.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, user: me };
}

// Helper for permission checks. Buyer permission is implicit for any logged-in user.
export function hasPermission(
  user: { isSeller: boolean; isDesigner: boolean } | null | undefined,
  perm: Permission,
): boolean {
  if (!user) return false;
  if (perm === Permission.BUYER) return true;
  if (perm === Permission.SELLER) return user.isSeller;
  if (perm === Permission.DESIGNER) return user.isDesigner;
  return false;
}

// Server-component guard. Pass a single permission or an array (any-of) — Buyer is implicit.
// On failure: redirect to /login or /unauthorized.
export async function requireUser(perm?: Permission | Permission[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (perm) {
    const required = Array.isArray(perm) ? perm : [perm];
    const ok = required.some((p) => hasPermission(user, p));
    if (!ok) redirect("/unauthorized");
  }
  return user;
}

// API route guard. Returns either a session (with attached permission flags)
// or a NextResponse 401/403 to short-circuit the handler.
export async function requireApiUser(perm?: Permission | Permission[]) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (perm) {
    const required = Array.isArray(perm) ? perm : [perm];
    const ok = required.some((p) => {
      if (p === Permission.BUYER) return true;
      if (p === Permission.SELLER) return session.isSeller === true;
      if (p === Permission.DESIGNER) return session.isDesigner === true;
      return false;
    });
    if (!ok) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}
