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
// the checkout endpoint to decide who delivers and what the buyer pays.
//
// Rules (highest precedence first):
//   1. International (different country)  → BLOCKED.
//   2. Within same city AND city is on the platform's supported list:
//        a. Seller has a rider on file    → SELLER pays delivery via their
//           rider; gets the admin-set fee credited to their wallet minus
//           the platform cut.
//        b. Seller has NO rider           → PLATFORM delivers; full fee
//           stays with the platform.
//   3. Outside city (same country) — seller MUST have a rider; otherwise
//      BLOCKED. Fee uses the seller's own outsideCity rate.
//   4. Within same city but NOT on the supported list — seller MUST have a
//      rider; otherwise BLOCKED. Fee uses the seller's own withinCity rate.
//
// Caller passes `sellerHasRider` because the rider lookup needs the prisma
// client — this keeps the helper pure-ish + easy to unit test.
export async function resolveDeliveryQuote(args: {
  buyer: LocatedUser;
  seller: LocatedUser & SellerDeliveryRates;
  sellerHasRider: boolean;
}): Promise<DeliveryQuote> {
  const { buyer, seller, sellerHasRider } = args;

  if (!buyer.country || !seller.country) {
    return {
      zone: "UNKNOWN",
      fulfiller: "BLOCKED",
      feeCents: 0,
      blockedReason: "Add your country and city in Account settings before checking out.",
    };
  }

  // 1) International lock — every cross-country order is refused. Buyer is
  // shown a "find local sellers" prompt in the UI.
  if (buyer.country !== seller.country) {
    return {
      zone: "OUTSIDE_COUNTRY",
      fulfiller: "BLOCKED",
      feeCents: 0,
      blockedReason:
        "International orders aren't supported yet. Look for sellers in your country to check out.",
    };
  }

  const sameCity =
    !!buyer.city && !!seller.city && normalisedCity(buyer.city) === normalisedCity(seller.city);

  // 2) Same city → check supported list.
  if (sameCity) {
    // Prisma SQLite doesn't support `mode: "insensitive"`, so we pull every
    // active city in the buyer's country and compare in JS via normalisedCity.
    // Cities-per-country is bounded (admin manages the list), so this is cheap.
    const allInCountry = await prisma.deliveryCity.findMany({
      where: { active: true, country: buyer.country },
    });
    const matched = allInCountry.find(
      (c) => normalisedCity(c.name) === normalisedCity(seller.city ?? ""),
    );

    if (matched) {
      // Platform-served city — admin sets the fee. Cut is read by callers
      // separately via platformDeliveryCutBps() when crediting the seller.
      return {
        zone: "WITHIN_CITY",
        fulfiller: sellerHasRider ? "SELLER" : "PLATFORM",
        feeCents: matched.feeCents,
      };
    }
    // Same city but NOT supported by platform — seller delivers with their
    // own rider using their own fee, or we block.
    if (!sellerHasRider) {
      return {
        zone: "WITHIN_CITY",
        fulfiller: "BLOCKED",
        feeCents: 0,
        blockedReason:
          "This seller's city isn't a platform delivery zone yet, and they don't have an in-house rider.",
      };
    }
    return {
      zone: "WITHIN_CITY",
      fulfiller: "SELLER",
      feeCents: seller.deliveryWithinCityCents,
    };
  }

  // 3) Cross-city (same country) — seller's rider only.
  if (!sellerHasRider) {
    return {
      zone: "OUTSIDE_CITY",
      fulfiller: "BLOCKED",
      feeCents: 0,
      blockedReason:
        "Cross-city orders need the seller's own delivery person. This seller hasn't set one up.",
    };
  }
  return {
    zone: "OUTSIDE_CITY",
    fulfiller: "SELLER",
    feeCents: seller.deliveryOutsideCityCents,
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
