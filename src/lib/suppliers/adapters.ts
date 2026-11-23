// Supplier integration adapters.
//
// MANUAL suppliers have no adapter: products are entered/CSV-imported by an
// admin and supplier orders are placed by hand from the "Supplier orders"
// queue.
//
// API suppliers use the generic JSON adapter below, which speaks a simple
// contract. A supplier whose API differs (AliExpress, CJ Dropshipping, etc.)
// needs its own adapter implementing `SupplierAdapter` and registered in
// `getAdapter`.
//
//   GET  {apiBaseUrl}/products          -> { products: CatalogItem[] }
//   POST {apiBaseUrl}/orders            -> { orderId, trackingCode? }
//        body: { reference, items:[{ sku, quantity }], recipient:{...} }
//   Auth: Authorization: Bearer <apiKey>

export type CatalogItem = {
  externalId: string;
  name: string;
  description?: string;
  images?: string[];
  category?: string;
  costPrice: number; // naira
  stock?: number;
};

export type SupplierOrderRequest = {
  reference: string; // our SupplierOrder id
  sku: string;
  quantity: number;
  recipient: { name: string; phone?: string | null; address: string };
};

export type SupplierOrderResult = { externalOrderId: string; trackingCode?: string };

export interface SupplierAdapter {
  fetchCatalog(): Promise<CatalogItem[]>;
  placeOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult>;
}

type Cfg = { apiBaseUrl: string | null; apiKey: string | null };

const TIMEOUT_MS = 20_000;

export class GenericJsonAdapter implements SupplierAdapter {
  constructor(private cfg: Cfg) {}

  private base(): string {
    if (!this.cfg.apiBaseUrl) throw new Error("Supplier has no API base URL");
    return this.cfg.apiBaseUrl.replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}),
    };
  }

  private async call(path: string, init: RequestInit): Promise<any> {
    const res = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: this.headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supplier API ${res.status}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Supplier API returned non-JSON");
    }
  }

  async fetchCatalog(): Promise<CatalogItem[]> {
    const data = await this.call("/products", { method: "GET" });
    const list: any[] = Array.isArray(data) ? data : data?.products;
    if (!Array.isArray(list)) throw new Error("Supplier catalog has no products array");
    const out: CatalogItem[] = [];
    for (const r of list) {
      const externalId = String(r.externalId ?? r.id ?? r.sku ?? "").trim();
      const name = String(r.name ?? r.title ?? "").trim();
      const costPrice = Number(r.costPrice ?? r.price);
      if (!externalId || !name || !Number.isFinite(costPrice) || costPrice <= 0) continue;
      out.push({
        externalId,
        name,
        description: r.description ? String(r.description) : "",
        images: Array.isArray(r.images) ? r.images.map(String).filter(Boolean) : [],
        category: r.category ? String(r.category) : "",
        costPrice,
        stock: Number.isFinite(Number(r.stock)) ? Math.max(0, Math.floor(Number(r.stock))) : 0,
      });
    }
    return out;
  }

  async placeOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult> {
    const data = await this.call("/orders", {
      method: "POST",
      body: JSON.stringify({
        reference: req.reference,
        items: [{ sku: req.sku, quantity: req.quantity }],
        recipient: req.recipient,
      }),
    });
    const externalOrderId = String(data?.orderId ?? data?.id ?? "").trim();
    if (!externalOrderId) throw new Error("Supplier order response missing orderId");
    return {
      externalOrderId,
      trackingCode: data?.trackingCode ? String(data.trackingCode) : undefined,
    };
  }
}

export function getAdapter(s: {
  integration: string;
  apiBaseUrl: string | null;
  apiKey: string | null;
}): SupplierAdapter | null {
  if (s.integration === "API") return new GenericJsonAdapter(s);
  return null;
}
