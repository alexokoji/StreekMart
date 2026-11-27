// Storefront lock.
//
// A seller's shareable storefront link is /shop/<slug>. Anyone who arrives
// through it is "locked" to that seller for the rest of their visit: the
// site shows only that seller's products, the rest of the marketplace is
// closed off, and they can only buy from that seller.
//
// The lock is a cookie set by middleware when /shop/<slug> is opened. This
// file holds the pieces that don't depend on a request object so they can be
// unit-tested: the cookie name, which paths a locked visitor may still use,
// and the server-side resolver.

export const STORE_COOKIE = "sm_store";
export const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Paths a locked visitor may still open. Anything else is sent back to the
// storefront. /products/<id> is allowed here (the product page itself checks
// the product belongs to the locked seller). /api is never redirected: the
// individual endpoints enforce the lock where it matters (cart, checkout).
const ALLOWED_PREFIXES = [
  "/shop/",
  "/cart",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/account",
  "/messages",
  "/support",
  "/terms-and-conditions",
  "/privacy-policy",
  "/data-deletion",
  "/deliver/",
  "/rider",
  // Seller / designer / admin tools. A seller testing their own link must
  // not be trapped out of their dashboard.
  "/seller",
  "/designer",
  "/admin",
  "/api/",
  "/_next/",
  "/unauthorized",
  "/403",
];

// These live under /products/ but are marketplace listing pages, not products.
const PRODUCT_LIST_PAGES = new Set([
  "best-sellers",
  "featured",
  "flash-sales",
  "new-arrivals",
  "trending-fabrics",
  "list",
]);

/** True when a locked visitor may open `pathname`. */
export function isAllowedWhileLocked(pathname: string): boolean {
  if (pathname.startsWith("/products/")) {
    const rest = pathname.slice("/products/".length).split("/")[0];
    return rest.length > 0 && !PRODUCT_LIST_PAGES.has(rest);
  }
  return ALLOWED_PREFIXES.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + "/"),
  );
}

/** The slug/id segment from a /shop/<handle> path, or null. */
export function shopHandleFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/shop\/([^/]+)/);
  if (!m) return null;
  try {
    const h = decodeURIComponent(m[1]).trim();
    return h && h.length <= 120 ? h : null;
  } catch {
    return null;
  }
}
