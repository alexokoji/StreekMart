import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/jwt";
import {
  STORE_COOKIE,
  cookieHeaderWithout,
  isAllowedWhileLocked,
  isFreshArrival,
  shopHandleFromPath,
} from "./lib/storefront";

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

  // ---- Storefront lock ----------------------------------------------------
  // Opening a seller's storefront link (/shop/<handle>) locks the visitor to
  // that seller, every time they use the link. While locked, anything outside
  // the allowed paths bounces back to the storefront.
  //
  // The lock only holds for visits that came THROUGH the link. If the visitor
  // arrives some other way (typing the site address, a bookmark, a search
  // result) they are released and see the normal marketplace.
  const shopHandle = shopHandleFromPath(pathname);
  if (shopHandle) {
    const res = NextResponse.next();
    res.cookies.set(STORE_COOKIE, shopHandle, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // No maxAge: a session cookie, gone when the browser closes.
    });
    return res;
  }
  const lockedTo = req.cookies.get(STORE_COOKIE)?.value;
  if (lockedTo && req.method === "GET" && !isAllowedWhileLocked(pathname)) {
    const fresh = isFreshArrival({
      site: req.headers.get("sec-fetch-site"),
      mode: req.headers.get("sec-fetch-mode"),
      dest: req.headers.get("sec-fetch-dest"),
    });
    if (fresh) {
      // They typed the address / used a bookmark / came from elsewhere:
      // release the lock for this page and from now on.
      const headers = new Headers(req.headers);
      const rest = cookieHeaderWithout(req.headers.get("cookie"), STORE_COOKIE);
      if (rest) headers.set("cookie", rest);
      else headers.delete("cookie");
      const res = NextResponse.next({ request: { headers } });
      res.cookies.set(STORE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    const url = req.nextUrl.clone();
    url.pathname = `/shop/${encodeURIComponent(lockedTo)}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

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
  // Every page request (the storefront lock applies site-wide). Static files
  // and Next internals are skipped; auth gating above still only acts on its
  // own prefixes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
