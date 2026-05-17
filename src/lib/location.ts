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

// The DB-touching helpers (resolveDeliveryQuote, platformDeliveryCutBps)
// live in src/lib/locationServer.ts. Server callers import from there;
// client components like RegisterForm only ever need the data + types
// above. Keeping them split is what stops Webpack from trying to bundle
// @libsql/client into the browser.
