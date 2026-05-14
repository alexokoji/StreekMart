import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/jwt";

const SESSION_COOKIE = "upclo_session";

// Route prefix → required permission flag on the session.
// "any-auth" gates require a logged-in user but no specific permission.
const PERMISSION_GATES: Array<{ prefix: string; require: "isSeller" | "isDesigner" }> = [
  { prefix: "/seller", require: "isSeller" },
  { prefix: "/designer", require: "isDesigner" },
];

const AUTH_ONLY_PREFIXES = [
  "/account",
  "/cart",
  "/wishlist",
  "/favorites",
  "/messages",
  "/sketch",
  "/api/cart",
  "/api/me",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  // Note: signed-in users CAN still hit /login and /register — the pages
  // render an "already signed in" branch with a sign-out CTA so they can
  // switch accounts. Bouncing them silently to "/" looked like the page
  // wasn't opening.

  const gate = PERMISSION_GATES.find((g) => pathname.startsWith(g.prefix));
  if (gate) {
    if (!session) return redirectToLogin(req);
    if (session[gate.require] !== true) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.rewrite(url);
    }
  }

  if (AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && !session) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/seller/:path*",
    "/designer/:path*",
    "/account/:path*",
    "/cart/:path*",
    "/wishlist/:path*",
    "/favorites/:path*",
    "/messages/:path*",
    "/sketch/:path*",
    "/api/cart/:path*",
    "/api/me/:path*",
  ],
};
