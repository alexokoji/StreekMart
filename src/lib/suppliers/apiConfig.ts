// Per-supplier API configuration + the pure helpers that interpret it.
// Everything here is side-effect free so it can be unit-tested; the HTTP
// client lives in adapters.ts.
//
// An empty config ({}) means "use the defaults", which match the simple
// contract documented in adapters.ts.

import { z } from "zod";

const Path = z.string().trim().max(200);

export const ApiConfigSchema = z.object({
  auth: z
    .object({
      // BEARER: Authorization: Bearer <key>
      // HEADER: <name>: <key>            (e.g. X-API-Key)
      // QUERY:  ?<name>=<key>
      // BASIC:  Authorization: Basic base64(<key>)  (key = "user:pass")
      type: z.enum(["BEARER", "HEADER", "QUERY", "BASIC", "NONE"]).default("BEARER"),
      name: z.string().trim().max(60).optional(),
    })
    .default({}),
  // Extra static headers sent on every request (never put secrets here —
  // use the API key field).
  headers: z.record(z.string().max(300)).default({}),
  catalog: z
    .object({
      path: Path.default("/products"),
      // Where the array of items lives in the response. "" = response root.
      itemsPath: Path.default("products"),
      fields: z
        .object({
          externalId: Path.default("id"),
          name: Path.default("name"),
          description: Path.default("description"),
          images: Path.default("images"),
          category: Path.default("category"),
          cost: Path.default("price"),
          stock: Path.default("stock"),
        })
        .default({}),
      // Convert the supplier's price to naira: naira = raw / divisor * multiplier.
      // kobo → naira: divisor 100.  USD → naira: multiplier = your FX rate.
      priceDivisor: z.number().positive().max(1e6).default(1),
      priceMultiplier: z.number().positive().max(1e6).default(1),
      // Used when the supplier doesn't report stock at all.
      defaultStock: z.number().int().min(0).max(1_000_000).default(10),
      pagination: z
        .object({
          type: z.enum(["NONE", "PAGE", "OFFSET", "CURSOR"]).default("NONE"),
          pageParam: z.string().max(40).default("page"),
          sizeParam: z.string().max(40).default("limit"),
          size: z.number().int().min(1).max(1000).default(100),
          cursorParam: z.string().max(40).default("cursor"),
          nextCursorPath: Path.default("nextCursor"),
          maxPages: z.number().int().min(1).max(200).default(50),
        })
        .default({}),
    })
    .default({}),
  order: z
    .object({
      path: Path.default("/orders"),
      // Request body. String values may contain {{placeholders}}:
      // reference, sku, quantity, unitCost, recipient.name,
      // recipient.phone, recipient.address
      body: z.record(z.any()).default({
        reference: "{{reference}}",
        items: [{ sku: "{{sku}}", quantity: "{{quantity}}" }],
        recipient: {
          name: "{{recipient.name}}",
          phone: "{{recipient.phone}}",
          address: "{{recipient.address}}",
        },
      }),
      // Sent as this header so a retried request can't create a duplicate.
      idempotencyHeader: z.string().max(60).default("Idempotency-Key"),
      externalIdPath: Path.default("orderId"),
      trackingPath: Path.default("trackingCode"),
    })
    .default({}),
  tracking: z
    .object({
      // {{externalOrderId}} is substituted. Empty path disables status polling.
      path: Path.default("/orders/{{externalOrderId}}"),
      statusPath: Path.default("status"),
      trackingPath: Path.default("trackingCode"),
      // Supplier status (lowercased) → our status.
      statusMap: z.record(z.enum(["PLACED", "SHIPPED", "DELIVERED", "CANCELLED"])).default({
        processing: "PLACED",
        pending: "PLACED",
        shipped: "SHIPPED",
        in_transit: "SHIPPED",
        delivered: "DELIVERED",
        cancelled: "CANCELLED",
        canceled: "CANCELLED",
      }),
    })
    .default({}),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

export function parseApiConfig(json: string | null | undefined): ApiConfig {
  let raw: unknown = {};
  try {
    raw = json ? JSON.parse(json) : {};
  } catch {
    raw = {};
  }
  const r = ApiConfigSchema.safeParse(raw);
  return r.success ? r.data : ApiConfigSchema.parse({});
}

/** Validate admin input; returns a readable error instead of throwing. */
export function validateApiConfig(raw: unknown): { ok: true; config: ApiConfig } | { ok: false; error: string } {
  const r = ApiConfigSchema.safeParse(raw ?? {});
  if (r.success) return { ok: true, config: r.data };
  const i = r.error.issues[0];
  return { ok: false, error: `API config: ${i.path.join(".") || "root"} — ${i.message}` };
}

// ---------- pure helpers ----------

/** Read "a.b.0.c" from an object. Returns undefined when missing. */
export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: any = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[^0-9.\-]/g, ""));
  return NaN;
}

function toImages(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr
    .map((x) => (typeof x === "string" ? x : toStr((x as any)?.url ?? (x as any)?.src)))
    .map((x) => x.trim())
    .filter((x) => /^https?:\/\//i.test(x));
}

export type MappedItem = {
  externalId: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  costPrice: number; // naira
  stock: number;
};

/** Map one raw supplier record to our shape, or return why it was skipped. */
export function mapCatalogItem(
  raw: unknown,
  cfg: ApiConfig["catalog"],
): { item: MappedItem } | { skipped: string } {
  const f = cfg.fields;
  const externalId = toStr(getPath(raw, f.externalId));
  if (!externalId) return { skipped: `missing ${f.externalId}` };
  const name = toStr(getPath(raw, f.name));
  if (!name) return { skipped: `${externalId}: missing ${f.name}` };
  const rawCost = toNum(getPath(raw, f.cost));
  if (!Number.isFinite(rawCost) || rawCost <= 0) return { skipped: `${externalId}: bad price` };
  const costPrice = Math.round((rawCost / cfg.priceDivisor) * cfg.priceMultiplier * 100) / 100;
  const stockRaw = getPath(raw, f.stock);
  const stockNum = toNum(stockRaw);
  return {
    item: {
      externalId,
      name,
      description: toStr(getPath(raw, f.description)),
      images: toImages(getPath(raw, f.images)),
      category: toStr(getPath(raw, f.category)),
      costPrice,
      stock: Number.isFinite(stockNum) ? Math.max(0, Math.floor(stockNum)) : cfg.defaultStock,
    },
  };
}

/** Fill {{placeholders}} in a JSON template. A value that is exactly one
 *  placeholder keeps the variable's type (so quantity stays a number). */
export function renderTemplate(tpl: unknown, vars: Record<string, unknown>): unknown {
  if (typeof tpl === "string") {
    const whole = tpl.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (whole) return getPath(vars, whole[1]) ?? null;
    return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => toStr(getPath(vars, k)));
  }
  if (Array.isArray(tpl)) return tpl.map((x) => renderTemplate(x, vars));
  if (tpl && typeof tpl === "object") {
    return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, renderTemplate(v, vars)]));
  }
  return tpl;
}

export function mapSupplierStatus(
  raw: unknown,
  map: Record<string, "PLACED" | "SHIPPED" | "DELIVERED" | "CANCELLED">,
): "PLACED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | null {
  const key = toStr(raw).toLowerCase().replace(/[\s-]+/g, "_");
  return map[key] ?? null;
}

/** Reject URLs an admin-supplied config must never make the server call. */
export function checkSupplierUrl(url: string, allowHttp = false): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "Not a valid URL";
  }
  if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) return "API URL must use https";
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "::1" ||
    h.startsWith("[")
  ) {
    return "API URL must be a public host";
  }
  return null;
}
