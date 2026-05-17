// Location & delivery-fee primitives.
//
// All currency math is in USD-cents (the same canonical unit as the wallet
// and product price). Strings on User.country are ISO-3166 alpha-2; city is
// free-text we normalise on comparison.

export type DeliveryZone =
  | "WITHIN_CITY"
  | "OUTSIDE_CITY"
  | "OUTSIDE_COUNTRY"
  | "UNKNOWN";

// Who's responsible for the actual delivery.
//   "PLATFORM" — same city in the platform-supported list AND the seller
//                doesn't have their own rider. Platform riders pick up.
//   "SELLER"   — seller's own rider does the delivery (either because we
//                don't serve their city, or because they have a rider on
//                file even in a supported city — fee still goes to their
//                wallet minus the platform cut).
//   "BLOCKED"  — international order, or the seller is outside supported
//                cities and has no rider. Cart refuses checkout.
export type DeliveryFulfiller = "PLATFORM" | "SELLER" | "BLOCKED";

export type DeliveryQuote = {
  zone: DeliveryZone;
  fulfiller: DeliveryFulfiller;
  feeCents: number;
  // Reason text for UI when fulfiller=BLOCKED.
  blockedReason?: string;
};

export type LocatedUser = {
  country: string | null;
  city: string | null;
  region?: string | null;
};

export type SellerDeliveryRates = {
  deliveryWithinCityCents: number;
  deliveryOutsideCityCents: number;
  deliveryOutsideCountryCents: number;
};

// Curated, comma-separated for display name. ISO-3166 alpha-2 codes.
// Big enough to cover global users, short enough to avoid scrolling fatigue
// on the registration form.
export const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CM", name: "Cameroon" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "TR", name: "Türkiye" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
] as const;

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export function isValidCountryCode(code: string | null | undefined): boolean {
  return !!code && COUNTRY_CODES.has(code as (typeof COUNTRIES)[number]["code"]);
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// City names get loosely normalised so "Lagos" and "lagos " match.
// Intentionally minimal — case + whitespace, nothing fancier (no diacritic
// stripping, since e.g. "Yaoundé" should not collide with "Yaounde").
function normCity(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// Decide which delivery rate applies based on buyer/seller addresses.
// Falls back to UNKNOWN when either side hasn't set a country.
export function deliveryZoneFor(buyer: LocatedUser, seller: LocatedUser): DeliveryZone {
  if (!buyer.country || !seller.country) return "UNKNOWN";
  if (buyer.country !== seller.country) return "OUTSIDE_COUNTRY";
  // Same country — check city.
  if (!buyer.city || !seller.city) return "OUTSIDE_CITY";
  if (normCity(buyer.city) === normCity(seller.city)) return "WITHIN_CITY";
  return "OUTSIDE_CITY";
}

// Pick the seller's quoted rate for the given zone. UNKNOWN falls back to
// the highest configured rate so we don't accidentally underbill.
export function deliveryFeeCentsFor(seller: SellerDeliveryRates, zone: DeliveryZone): number {
  switch (zone) {
    case "WITHIN_CITY":
      return seller.deliveryWithinCityCents;
    case "OUTSIDE_CITY":
      return seller.deliveryOutsideCityCents;
    case "OUTSIDE_COUNTRY":
      return seller.deliveryOutsideCountryCents;
    default:
      return Math.max(
        seller.deliveryWithinCityCents,
        seller.deliveryOutsideCityCents,
        seller.deliveryOutsideCountryCents,
      );
  }
}

export function deliveryZoneLabel(zone: DeliveryZone): string {
  switch (zone) {
    case "WITHIN_CITY":
      return "Within city";
    case "OUTSIDE_CITY":
      return "Outside city";
    case "OUTSIDE_COUNTRY":
      return "International";
    default:
      return "Unspecified";
  }
}

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

  // Lazy-import prisma + settings to keep this file usable from places
  // that don't always have a DB connection (e.g. some test setups).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require("./db") as typeof import("./db");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSettingNumber } = require("./settings") as typeof import("./settings");

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
      // Platform-served city — admin sets the fee.
      const cutBps = await getSettingNumber("DELIVERY_PLATFORM_CUT_BPS", 1500); // 15% default
      const adminFee = matched.feeCents;
      return {
        zone: "WITHIN_CITY",
        // Either fulfiller is OK; the cart endpoint uses this to decide
        // wallet routing. Fee is the same either way (admin sets it).
        fulfiller: sellerHasRider ? "SELLER" : "PLATFORM",
        feeCents: adminFee,
        // Stash the cut on the quote via a side-channel — callers that need
        // it for wallet credit math use platformDeliveryCutBps below.
        blockedReason: undefined,
        // We don't put cutBps on the quote type itself to keep it minimal;
        // callers re-read it via platformDeliveryCutBps when they need it.
      } satisfies DeliveryQuote;
      // (cutBps used by callers via platformDeliveryCutBps helper below.)
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

// Convenience for callers that want the cut BPS (e.g. to compute how much
// of the delivery fee goes to the platform vs the seller's wallet).
export async function platformDeliveryCutBps(): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSettingNumber } = require("./settings") as typeof import("./settings");
  return getSettingNumber("DELIVERY_PLATFORM_CUT_BPS", 1500);
}

function normalisedCity(s: string): string {
  return s.trim().toLowerCase();
}
