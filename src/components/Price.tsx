"use client";

// NGN is the canonical display currency for now — UpClo is Nigeria-only at
// launch, so we format every money amount as Naira directly without going
// through the USD round-trip. The currency-selection plumbing
// (CurrencyProvider, CurrencySelector, currencyServer helpers) is kept in
// place dormant for the future "swap currencies for other countries"
// feature; this component just ignores it.
//
//   <Price amount={6091.38} />   →  "₦6,091.38"
//
// Amounts are expected in regular NGN units (e.g. 1234.56), not kobo.

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function Price({ amount }: { amount: number }) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return <span>{NGN_FORMATTER.format(safe)}</span>;
}
