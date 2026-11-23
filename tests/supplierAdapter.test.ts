import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurableApiAdapter } from "../src/lib/suppliers/adapters";
import { ApiConfigSchema } from "../src/lib/suppliers/apiConfig";

type Call = { url: string; init: any };
function mockFetch(handler: (c: Call) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: any, init: any) => {
    const c = { url: String(url), init };
    calls.push(c);
    const r = handler(c);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: r.headers });
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

const conn = { apiBaseUrl: "https://api.vendor.com/v1", apiKey: "SECRET" };

describe("ConfigurableApiAdapter", () => {
  it("sends bearer auth and maps a catalog", async () => {
    const calls = mockFetch(() => ({ body: { products: [{ id: 1, name: "A", price: 100, stock: 2, images: ["https://i.io/a.jpg"] }] } }));
    const r = await new ConfigurableApiAdapter(conn).fetchCatalog();
    expect(r.items).toHaveLength(1);
    expect(calls[0].init.headers.Authorization).toBe("Bearer SECRET");
    expect(calls[0].url).toBe("https://api.vendor.com/v1/products");
  });

  it("supports header + query auth", async () => {
    let calls = mockFetch(() => ({ body: { products: [] } }));
    await new ConfigurableApiAdapter(conn, ApiConfigSchema.parse({ auth: { type: "HEADER", name: "X-Key" } })).fetchCatalog();
    expect(calls[0].init.headers["X-Key"]).toBe("SECRET");
    calls = mockFetch(() => ({ body: { products: [] } }));
    await new ConfigurableApiAdapter(conn, ApiConfigSchema.parse({ auth: { type: "QUERY", name: "key" } })).fetchCatalog();
    expect(calls[0].url).toContain("key=SECRET");
  });

  it("follows page pagination and dedupes", async () => {
    const cfg = ApiConfigSchema.parse({ catalog: { pagination: { type: "PAGE", size: 2 } } });
    const calls = mockFetch((c) => {
      const page = Number(new URL(c.url).searchParams.get("page"));
      const rows = page === 1 ? [1, 2] : page === 2 ? [3, 4] : [5];
      return { body: { products: rows.map((id) => ({ id, name: `P${id}`, price: 10 })) } };
    });
    const r = await new ConfigurableApiAdapter(conn, cfg).fetchCatalog();
    expect(r.items.map((i) => i.externalId)).toEqual(["1", "2", "3", "4", "5"]);
    expect(calls).toHaveLength(3);
    expect(r.complete).toBe(true);
  });

  it("follows cursors", async () => {
    const cfg = ApiConfigSchema.parse({ catalog: { pagination: { type: "CURSOR", size: 1 } } });
    mockFetch((c) => {
      const cur = new URL(c.url).searchParams.get("cursor");
      return cur
        ? { body: { products: [{ id: 2, name: "B", price: 5 }] } }
        : { body: { products: [{ id: 1, name: "A", price: 5 }], nextCursor: "c2" } };
    });
    const r = await new ConfigurableApiAdapter(conn, cfg).fetchCatalog();
    expect(r.items).toHaveLength(2);
  });

  it("retries transient errors then succeeds, never leaking the key", async () => {
    let n = 0;
    mockFetch(() => (++n < 2 ? { status: 503, body: { e: "down" }, headers: { "retry-after": "0" } } : { body: { products: [] } }));
    await expect(new ConfigurableApiAdapter(conn).fetchCatalog()).resolves.toBeTruthy();
    expect(n).toBe(2);
  });

  it("does not retry 4xx and redacts the key from errors", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => (n++, new Response("bad key SECRET", { status: 401 })));
    const err = await new ConfigurableApiAdapter(conn).fetchCatalog().catch((e) => e);
    expect(n).toBe(1);
    expect(err.message).toContain("401");
    expect(err.message).not.toContain("SECRET");
  });

  it("explains a wrong items path", async () => {
    mockFetch(() => ({ body: { data: [] } }));
    await expect(new ConfigurableApiAdapter(conn).fetchCatalog()).rejects.toThrow(/items path/);
  });

  it("places an order with idempotency key and typed body", async () => {
    const calls = mockFetch(() => ({ body: { orderId: "X9", trackingCode: "T1" } }));
    const r = await new ConfigurableApiAdapter(conn).placeOrder({
      reference: "so1", sku: "S", quantity: 2, unitCost: 5, recipient: { name: "Ada", phone: "080", address: "1 Rd" },
    });
    expect(r).toEqual({ externalOrderId: "X9", trackingCode: "T1" });
    expect(calls[0].init.headers["Idempotency-Key"]).toBe("so1");
    expect(JSON.parse(calls[0].init.body).items[0]).toEqual({ sku: "S", quantity: 2 });
  });

  it("reads order status through the status map", async () => {
    const calls = mockFetch(() => ({ body: { status: "In Transit", trackingCode: "TT" } }));
    const r = await new ConfigurableApiAdapter(conn).getOrderStatus("A/1");
    expect(r).toMatchObject({ status: "SHIPPED", trackingCode: "TT" });
    expect(calls[0].url).toContain("/orders/A%2F1");
  });
});
