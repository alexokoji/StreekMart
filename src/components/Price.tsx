"use client";

import { formatPriceFrom } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

// Drop-in replacement for the old `formatPrice(...)` calls.
// Renders a USD amount as the visitor's local currency.
//
//   <Price amount={48} />        → "$48.00" / "₦72,000.00" / "£37.92"
//
// Use `as="span"` if you need it inline within a paragraph (default is a
// <span> already, so this is informational only).
export function Price({ amount }: { amount: number }) {
  const ctx = useCurrency();
  return <span>{formatPriceFrom(amount, ctx)}</span>;
}
