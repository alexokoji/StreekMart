import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isAllowedWhileLocked, shopHandleFromPath, STORE_COOKIE } from "../src/lib/storefront";
import { middleware } from "../src/middleware";

describe("isAllowedWhileLocked", () => {
  it("lets a locked visitor shop, sign in, check out and track orders", () => {
    for (const p of ["/shop/ada", "/products/abc123", "/cart", "/cart/checkout", "/login", "/register",
      "/account/orders", "/account/orders/x", "/messages", "/support", "/api/cart", "/seller", "/admin/users"]) {
      expect(isAllowedWhileLocked(p), p).toBe(true);
    }
  });
  it("closes off the rest of the marketplace", () => {
    for (const p of ["/", "/search", "/categories", "/u/someone", "/feed", "/posts/1", "/wishlist",
      "/products/best-sellers", "/products/featured", "/products/flash-sales", "/products/new-arrivals",
      "/products/trending-fabrics", "/products/", "/lookbook/a/b", "/sketch", "/preorder/x", "/cartoon"]) {
      expect(isAllowedWhileLocked(p), p).toBe(false);
    }
  });
});

describe("shopHandleFromPath", () => {
  it("reads the handle", () => {
    expect(shopHandleFromPath("/shop/ada-atelier")).toBe("ada-atelier");
    expect(shopHandleFromPath("/shop/ada-atelier/extra")).toBe("ada-atelier");
    expect(shopHandleFromPath("/shop")).toBeNull();
    expect(shopHandleFromPath("/u/ada")).toBeNull();
  });
});

describe("middleware storefront lock", () => {
  const req = (path: string, cookie?: string, fetchHeaders: Record<string, string> = {}) =>
    new NextRequest(`https://streekmart.test${path}`, {
      headers: { ...(cookie ? { cookie: `${STORE_COOKIE}=${cookie}` } : {}), ...fetchHeaders },
    });
  // What a browser sends for each way of arriving.
  const clickInsideSite = { "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
  const typedAddress = { "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
  const fromSearchResult = { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

  it("sets the lock cookie when a storefront link is opened", async () => {
    const res = await middleware(req("/shop/ada"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${STORE_COOKIE}=ada`);
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });
  it("sends a locked visitor back to the storefront when they click out of it", async () => {
    for (const path of ["/", "/search?q=lace", "/u/other", "/products/featured"]) {
      const res = await middleware(req(path, "ada", clickInsideSite));
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, path).toBe("/shop/ada");
    }
  });
  it("lets a locked visitor reach what they need to buy", async () => {
    for (const path of ["/products/abc", "/login", "/api/cart", "/cart"]) {
      const res = await middleware(req(path, "ada"));
      // Never bounced back to the storefront (signed-out /cart and /api/cart
      // go to login, which is the normal auth gate, not the lock).
      expect(res.headers.get("location") ?? "", path).not.toContain("/shop/");
    }
  });
  it("is a session cookie, not a long-lived one", async () => {
    const res = await middleware(req("/shop/ada"));
    expect(res.headers.get("set-cookie")?.toLowerCase()).not.toContain("max-age");
    expect(res.headers.get("set-cookie")?.toLowerCase()).not.toContain("expires");
  });
  it("releases the visitor when they type the site address, use a bookmark or come from a search result", async () => {
    for (const how of [typedAddress, fromSearchResult]) {
      const res = await middleware(req("/", "ada", how));
      expect(res.headers.get("location"), JSON.stringify(how)).toBeNull(); // not bounced
      expect(res.headers.get("set-cookie")).toContain(`${STORE_COOKIE}=;`); // lock cleared
    }
  });
  it("does not release the visitor mid-purchase (e.g. back from the payment page)", async () => {
    const res = await middleware(req("/cart/checkout/return?ref=1", "ada", fromSearchResult));
    expect(res.headers.get("set-cookie") ?? "").not.toContain(`${STORE_COOKIE}=;`);
  });
  it("re-locks every time the seller's link is used again", async () => {
    const res = await middleware(req("/shop/ada", undefined, fromSearchResult));
    expect(res.headers.get("set-cookie")).toContain(`${STORE_COOKIE}=ada`);
  });
  it("leaves normal visitors alone", async () => {
    const res = await middleware(req("/search"));
    expect(res.headers.get("location")).toBeNull();
  });
});
