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
  const req = (path: string, cookie?: string) =>
    new NextRequest(`https://streekmart.test${path}`, { headers: cookie ? { cookie: `${STORE_COOKIE}=${cookie}` } : {} });

  it("sets the lock cookie when a storefront link is opened", async () => {
    const res = await middleware(req("/shop/ada"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${STORE_COOKIE}=ada`);
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });
  it("sends a locked visitor back to the storefront when they try to leave", async () => {
    for (const path of ["/", "/search?q=lace", "/u/other", "/products/featured"]) {
      const res = await middleware(req(path, "ada"));
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
  it("leaves normal visitors alone", async () => {
    const res = await middleware(req("/search"));
    expect(res.headers.get("location")).toBeNull();
  });
});
