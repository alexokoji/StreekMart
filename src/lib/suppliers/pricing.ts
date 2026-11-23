// Pure pricing helpers for supplier products. No DB access so they can be
// unit-tested and reused by both the admin UI preview and the server.

export type MarkupType = "PERCENT" | "FIXED";

export type MarkupRule = { type: MarkupType; value: number };

export function normaliseMarkupType(v: unknown): MarkupType {
  return v === "FIXED" ? "FIXED" : "PERCENT";
}

/**
 * Price the customer pays: supplier cost plus markup, rounded UP to the
 * next whole naira so rounding never eats into profit.
 */
export function sellPrice(cost: number, rule: MarkupRule): number {
  if (!Number.isFinite(cost) || cost < 0) return 0;
  const value = Number.isFinite(rule.value) && rule.value > 0 ? rule.value : 0;
  const raw = rule.type === "FIXED" ? cost + value : cost * (1 + value / 100);
  return Math.ceil(raw - 1e-9);
}

/** Resolve the markup that applies: per-product override beats supplier default. */
export function effectiveMarkup(
  supplier: { markupType: string; markupValue: number },
  override?: { markupType: string | null; markupValue: number | null },
): MarkupRule {
  if (override && override.markupType && override.markupValue != null) {
    return { type: normaliseMarkupType(override.markupType), value: override.markupValue };
  }
  return { type: normaliseMarkupType(supplier.markupType), value: supplier.markupValue };
}

export function profitPerUnit(cost: number, price: number): number {
  return price - cost;
}

/** Profit as a % of the selling price (margin), 0 when price is 0. */
export function marginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}
