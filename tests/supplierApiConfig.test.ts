import { describe, expect, it } from "vitest";
import {
  ApiConfigSchema,
  checkSupplierUrl,
  getPath,
  mapCatalogItem,
  mapSupplierStatus,
  parseApiConfig,
  renderTemplate,
} from "../src/lib/suppliers/apiConfig";

const cfg = ApiConfigSchema.parse({});

describe("getPath", () => {
  it("reads nested + array paths", () => {
    expect(getPath({ a: { b: [{ c: 5 }] } }, "a.b.0.c")).toBe(5);
    expect(getPath({ a: 1 }, "x.y")).toBeUndefined();
    expect(getPath({ a: 1 }, "")).toEqual({ a: 1 });
  });
});

describe("mapCatalogItem", () => {
  it("maps with defaults", () => {
    const r = mapCatalogItem(
      { id: 7, name: " Lace ", price: "4,500.50", stock: 3, images: ["https://x.io/a.jpg", "junk"] },
      cfg.catalog,
    );
    expect(r).toEqual({
      item: { externalId: "7", name: "Lace", description: "", images: ["https://x.io/a.jpg"], category: "", costPrice: 4500.5, stock: 3 },
    });
  });
  it("converts kobo and FX", () => {
    const c = ApiConfigSchema.parse({ catalog: { priceDivisor: 100, priceMultiplier: 2 } }).catalog;
    const r = mapCatalogItem({ id: "a", name: "n", price: 1000 }, c);
    expect("item" in r && r.item.costPrice).toBe(20);
  });
  it("uses custom field paths and default stock", () => {
    const c = ApiConfigSchema.parse({
      catalog: { fields: { externalId: "sku", name: "meta.title", cost: "pricing.wholesale" }, defaultStock: 9 },
    }).catalog;
    const r = mapCatalogItem({ sku: "S1", meta: { title: "T" }, pricing: { wholesale: 10 } }, c);
    expect("item" in r && r.item.stock).toBe(9);
  });
  it("skips bad rows with a reason", () => {
    expect(mapCatalogItem({ name: "x", price: 1 }, cfg.catalog)).toHaveProperty("skipped");
    expect(mapCatalogItem({ id: 1, name: "x", price: 0 }, cfg.catalog)).toHaveProperty("skipped");
  });
});

describe("renderTemplate", () => {
  const vars = { sku: "S1", quantity: 2, recipient: { name: "Ada" } };
  it("keeps types for whole-value placeholders", () => {
    expect(renderTemplate({ items: [{ sku: "{{sku}}", quantity: "{{quantity}}" }] }, vars)).toEqual({
      items: [{ sku: "S1", quantity: 2 }],
    });
  });
  it("interpolates inside strings", () => {
    expect(renderTemplate("Ship to {{recipient.name}}", vars)).toBe("Ship to Ada");
  });
});

describe("mapSupplierStatus", () => {
  it("normalises and maps", () => {
    expect(mapSupplierStatus("In Transit", cfg.tracking.statusMap)).toBe("SHIPPED");
    expect(mapSupplierStatus("weird", cfg.tracking.statusMap)).toBeNull();
  });
});

describe("parseApiConfig", () => {
  it("falls back to defaults on bad JSON", () => {
    expect(parseApiConfig("not json").catalog.path).toBe("/products");
    expect(parseApiConfig(null).order.path).toBe("/orders");
  });
});

describe("checkSupplierUrl", () => {
  it("blocks internal targets", () => {
    expect(checkSupplierUrl("https://api.vendor.com/v1")).toBeNull();
    expect(checkSupplierUrl("http://api.vendor.com")).not.toBeNull();
    expect(checkSupplierUrl("https://localhost/x")).not.toBeNull();
    expect(checkSupplierUrl("https://169.254.169.254/")).not.toBeNull();
    expect(checkSupplierUrl("https://10.0.0.5/")).not.toBeNull();
  });
});
