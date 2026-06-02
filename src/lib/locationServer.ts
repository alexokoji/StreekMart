// Server-only delivery helpers.
//
// These touch prisma + SiteSetting, so they MUST NOT be imported from a
// client component. Splitting them out of src/lib/location.ts (which is
// imported by client code like RegisterForm for the COUNTRIES list) keeps
// Webpack from trying to bundle @libsql/client into the browser. Same
// pattern as currencyServer.ts vs currency.ts.

import { prisma } from "./db";
import { getSettingNumber } from "./settings";
import type {
  DeliveryQuote,
  LocatedUser,
  SellerDeliveryRates,
} from "./location";

// Server-only — uses prisma + the SiteSetting cache. Used by the cart and
// the checkout endpoint to decide *whether* an order can be quoted and to
// flag the geographical zone for analytics. The actual delivery FEE comes
// from the platform's logistics provider (Shipbubble) at checkout time —
// this helper no longer prices deliveries from seller-set rates.
//
// Rules:
//   1. International (different country) → BLOCKED. Cross-border isn't
//      supported yet.
//   2. Anything in-country → PLATFORM fulfiller with `feeCents: 0`. The
//      checkout flow replaces the zero with the courier the buyer selects
//      out of the Shipbubble rate list. The `zone` tag (WITHIN_CITY /
//      OUTSIDE_CITY) is kept for analytics and the cart's "delivering to"
//      label, but no longer drives pricing or fulfillment routing.
//
// `sellerHasRider` and the SellerDeliveryRates fields are kept on the
// signature for callers that pass them, but they no longer affect the
// outcome. The legacy "seller delivers within city" pattern is gone — every
// order is fulfilled by the platform's logistics provider.
export async function resolveDeliveryQuote(args: {
  buyer: LocatedUser;
  seller: LocatedUser & SellerDeliveryRates;
  // Kept for signature stability; ignored in the resolver.
  sellerHasRider?: boolean;
  // Kept for analytics — surfaces in the cart's "delivering to" label.
  zoneOverride?: "WITHIN_CITY" | "OUTSIDE_CITY";
}): Promise<DeliveryQuote> {
  const { buyer, seller, zoneOverride } = args;
  void args.sellerHasRider; // intentionally unused — kept for back-compat

  if (!buyer.country || !seller.country) {
    return {
      zone: "UNKNOWN",
      fulfiller: "BLOCKED",
      feeCents: 0,
      blockedReason: "Add your country and city in Account settings before checking out.",
    };
  }

  // 1) International lock — cross-border still refused.
  if (buyer.country !== seller.country) {
    return {
      zone: "OUTSIDE_COUNTRY",
      fulfiller: "BLOCKED",
      feeCents: 0,
      blockedReason:
        "International orders aren't supported yet. Look for sellers in your country to check out.",
    };
  }

  // Compute the zone tag (analytics + UI labelling only — does not affect
  // who fulfils the order or what the buyer is charged).
  const autoSameCity =
    !!buyer.city &&
    !!seller.city &&
    normalisedCity(buyer.city) === normalisedCity(seller.city);
  const sameCity =
    zoneOverride === "WITHIN_CITY"
      ? true
      : zoneOverride === "OUTSIDE_CITY"
        ? false
        : autoSameCity;

  return {
    zone: sameCity ? "WITHIN_CITY" : "OUTSIDE_CITY",
    fulfiller: "PLATFORM",
    // 0 is a placeholder — the checkout flow replaces it with the actual
    // courier quote the buyer picks from the Shipbubble rate list.
    feeCents: 0,
  };
}

// Cut (basis points) the platform takes off every delivery fee before
// crediting the seller's wallet. Default 15% if the admin hasn't set one.
export async function platformDeliveryCutBps(): Promise<number> {
  return getSettingNumber("DELIVERY_PLATFORM_CUT_BPS", 1500);
}

function normalisedCity(s: string): string {
  return s.trim().toLowerCase();
}
