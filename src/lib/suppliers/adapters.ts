// Supplier integration adapters.
//
// MANUAL suppliers have no adapter: an admin adds/imports products and
// places supplier orders by hand from the Orders queue.
//
// API suppliers use ConfigurableApiAdapter, which is driven entirely by the
// supplier's ApiConfig (see apiConfig.ts): auth style, endpoint paths,
// field mapping, price conversion, pagination, order payload and tracking.
// The defaults match this simple contract, so a supplier that follows it
// needs no configuration:
//
//   GET  {base}/products        -> { products: [{ id, name, price, stock, images[] }] }
//   POST {base}/orders          -> { orderId, trackingCode? }
//   GET  {base}/orders/{id}     -> { status, trackingCode? }
//
// A platform with a very different protocol (signed requests, OAuth token
// exchange) needs its own class implementing SupplierAdapter, returned from
// getAdapter().

import {
  type ApiConfig,
  type MappedItem,
  checkSupplierUrl,
  getPath,
  mapCatalogItem,
  mapSupplierStatus,
  parseApiConfig,
  renderTemplate,
} from "./apiConfig";

export type CatalogItem = Partial<MappedItem> & Pick<MappedItem, "externalId" | "name" | "costPrice">;

export type CatalogResult = {
  items: MappedItem[];
  skipped: string[]; // reasons, capped
  pages: number;
  // false when we stopped early (page cap / error mid-way) — callers must
  // not infer "missing from catalog" from an incomplete result.
  complete: boolean;
};

export type SupplierOrderRequest = {
  reference: string; // our SupplierOrder id; doubles as the idempotency key
  sku: string;
  quantity: number;
  unitCost: number;
  recipient: { name: string; phone?: string | null; address: string };
};

export type SupplierOrderResult = { externalOrderId: string; trackingCode?: string };

export type OrderStatusResult = {
  status: "PLACED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | null; // null = unmapped status
  rawStatus: string;
  trackingCode?: string;
};

export interface SupplierAdapter {
  fetchCatalog(opts?: { maxItems?: number }): Promise<CatalogResult>;
  placeOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult>;
  /** null when this supplier has no status endpoint configured. */
  getOrderStatus(externalOrderId: string): Promise<OrderStatusResult | null>;
}

export class SupplierApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

type Conn = { apiBaseUrl: string | null; apiKey: string | null; apiConfigJson?: string | null };

const TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ConfigurableApiAdapter implements SupplierAdapter {
  private cfg: ApiConfig;
  constructor(private conn: Conn, cfg?: ApiConfig) {
    this.cfg = cfg ?? parseApiConfig(conn.apiConfigJson);
  }

  private url(path: string, query: Record<string, string | number> = {}): URL {
    if (!this.conn.apiBaseUrl) throw new SupplierApiError("Supplier has no API base URL");
    const bad = checkSupplierUrl(this.conn.apiBaseUrl, process.env.NODE_ENV !== "production");
    if (bad) throw new SupplierApiError(bad);
    const u = new URL(this.conn.apiBaseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`));
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
    const a = this.cfg.auth;
    if (a.type === "QUERY" && this.conn.apiKey) u.searchParams.set(a.name || "api_key", this.conn.apiKey);
    return u;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json", ...this.cfg.headers, ...extra };
    const key = this.conn.apiKey;
    const a = this.cfg.auth;
    if (key) {
      if (a.type === "BEARER") h.Authorization = `Bearer ${key}`;
      else if (a.type === "HEADER") h[a.name || "X-API-Key"] = key;
      else if (a.type === "BASIC") h.Authorization = `Basic ${Buffer.from(key).toString("base64")}`;
    }
    return h;
  }

  // One request with timeout, size cap and retry on network errors / 429 / 5xx.
  // `retryable` is false for POSTs without an idempotency key.
  private async request(
    method: "GET" | "POST",
    url: URL,
    opts: { body?: unknown; headers?: Record<string, string>; retryable?: boolean } = {},
  ): Promise<any> {
    const retryable = opts.retryable ?? method === "GET";
    let lastErr: SupplierApiError = new SupplierApiError("Request failed");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let retryAfterMs = 0;
      try {
        const res = await fetch(url, {
          method,
          headers: this.headers({
            ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...opts.headers,
          }),
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "error",
        });
        const text = await res.text();
        if (text.length > MAX_BODY_BYTES) throw new SupplierApiError("Supplier response too large");
        if (res.ok) {
          try {
            return text ? JSON.parse(text) : {};
          } catch {
            throw new SupplierApiError("Supplier returned non-JSON", res.status);
          }
        }
        lastErr = new SupplierApiError(`Supplier API ${res.status}: ${redact(text, this.conn.apiKey)}`, res.status);
        const transient = res.status === 429 || res.status >= 500;
        if (!transient) throw lastErr;
        const ra = Number(res.headers.get("retry-after"));
        retryAfterMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 5000) : 0;
      } catch (e) {
        if (e instanceof SupplierApiError && !(e.status && (e.status === 429 || e.status >= 500))) throw e;
        if (!(e instanceof SupplierApiError)) {
          lastErr = new SupplierApiError(`Supplier unreachable: ${(e as Error).message ?? "network error"}`);
        }
      }
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(retryAfterMs || 500 * 2 ** (attempt - 1));
    }
    throw lastErr;
  }

  async fetchCatalog(opts: { maxItems?: number } = {}): Promise<CatalogResult> {
    const c = this.cfg.catalog;
    const p = c.pagination;
    const items: MappedItem[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    let complete = true;
    const limit = opts.maxItems ?? Infinity;

    for (let page = 0; page < (opts.maxItems ? 1 : p.maxPages); page++) {
      const query: Record<string, string | number> = {};
      if (p.type === "PAGE") Object.assign(query, { [p.pageParam]: page + 1, [p.sizeParam]: p.size });
      if (p.type === "OFFSET") Object.assign(query, { [p.pageParam]: page * p.size, [p.sizeParam]: p.size });
      if (p.type === "CURSOR") {
        query[p.sizeParam] = p.size;
        if (cursor) query[p.cursorParam] = cursor;
      }
      const data = await this.request("GET", this.url(c.path, query));
      pages++;
      const list = getPath(data, c.itemsPath);
      if (!Array.isArray(list)) {
        throw new SupplierApiError(
          `Catalog response has no array at "${c.itemsPath || "(root)"}" — check the items path in the API mapping`,
        );
      }
      let added = 0;
      for (const raw of list) {
        const m = mapCatalogItem(raw, c);
        if ("skipped" in m) {
          if (skipped.length < 20) skipped.push(m.skipped);
          continue;
        }
        if (seen.has(m.item.externalId)) continue;
        seen.add(m.item.externalId);
        items.push(m.item);
        added++;
        if (items.length >= limit) return { items, skipped, pages, complete: false };
      }
      if (p.type === "NONE") break;
      if (p.type === "CURSOR") {
        const next = getPath(data, p.nextCursorPath);
        cursor = next ? String(next) : undefined;
        if (!cursor) break;
      } else if (list.length < p.size) {
        break;
      }
      if (added === 0) break; // page repeated → avoid looping forever
      if (page === p.maxPages - 1) complete = false;
    }
    return { items, skipped, pages, complete };
  }

  async placeOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult> {
    const o = this.cfg.order;
    const body = renderTemplate(o.body, {
      reference: req.reference,
      sku: req.sku,
      quantity: req.quantity,
      unitCost: req.unitCost,
      recipient: req.recipient,
    });
    const idem = o.idempotencyHeader ? { [o.idempotencyHeader]: req.reference } : {};
    const data = await this.request("POST", this.url(o.path), {
      body,
      headers: idem,
      retryable: !!o.idempotencyHeader,
    });
    const externalOrderId = String(getPath(data, o.externalIdPath) ?? "").trim();
    if (!externalOrderId) {
      throw new SupplierApiError(`Order response has no "${o.externalIdPath}" — check the order mapping`);
    }
    const tracking = getPath(data, o.trackingPath);
    return { externalOrderId, trackingCode: tracking ? String(tracking) : undefined };
  }

  async getOrderStatus(externalOrderId: string): Promise<OrderStatusResult | null> {
    const t = this.cfg.tracking;
    if (!t.path) return null;
    const path = t.path.replace(/\{\{\s*externalOrderId\s*\}\}/g, encodeURIComponent(externalOrderId));
    const data = await this.request("GET", this.url(path));
    const raw = getPath(data, t.statusPath);
    const tracking = getPath(data, t.trackingPath);
    return {
      status: mapSupplierStatus(raw, t.statusMap),
      rawStatus: raw == null ? "" : String(raw),
      trackingCode: tracking ? String(tracking) : undefined,
    };
  }
}

function redact(text: string, key: string | null): string {
  let t = text.slice(0, 200);
  if (key) t = t.split(key).join("***");
  return t;
}

export function getAdapter(s: {
  integration: string;
  apiBaseUrl: string | null;
  apiKey: string | null;
  apiConfigJson?: string | null;
}): SupplierAdapter | null {
  if (s.integration === "API") return new ConfigurableApiAdapter(s);
  return null;
}
