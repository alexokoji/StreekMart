// Pure (client-safe) helpers for the case-insensitive, space-allowed
// business-name field. NO `prisma` import here — this file is dragged
// into the client bundle by displaySellerName usage in client components
// (CartClient, etc.), so pulling in @/lib/db would also pull the whole
// libsql adapter and its non-JS files (README.md, LICENSE) which webpack
// can't parse.
//
// The DB-touching helper (`isBusinessNameTaken`) lives in
// `lib/businessNameServer.ts` next door. Server code that needs both
// pure helpers and the uniqueness check imports from both files.

// Loose phone validation — accepts the formats sellers in NG / GH / KE / etc.
// realistically type. Strict E.164 is too brittle for buyers entering numbers
// from a phone keyboard.
const PHONE_RE = /^[+]?[\d\s().-]{7,20}$/;

export function isValidPhone(raw: unknown): raw is string {
  return typeof raw === "string" && PHONE_RE.test(raw.trim());
}

export function normalisePhone(raw: string): string {
  return raw.trim();
}

// Collapse runs of whitespace, trim, and lowercase. Spaces are preserved
// (just deduped) so "My Tailor   Shop" and "my tailor shop" collide as
// duplicates while still letting the seller render their preferred casing.
export function normaliseBusinessName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

// What the user sees on cards / profile: trim + collapse whitespace, keep
// their casing. Empty string → null so the UI can fall back to `name`.
export function canonicaliseBusinessNameDisplay(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length === 0 ? null : t;
}

export function isValidBusinessName(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  return t.length >= 2 && t.length <= 80;
}

// Pick the display name for a seller — businessName when set, else the
// personal `name`. Used everywhere a product card or storefront link
// renders the seller's identity.
export function displaySellerName(seller: {
  name: string;
  businessName?: string | null;
}): string {
  return seller.businessName?.trim() || seller.name;
}
