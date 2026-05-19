// Helpers for the case-insensitive, space-allowed business-name field.
//
// SQLite has no case-insensitive UNIQUE collation, so the schema carries
// two columns: `businessName` (case-as-typed, shown to users) and
// `businessNameLower` (normalised mirror, the actual @unique). Every code
// path that reads/writes the field should go through these helpers so the
// two columns can never diverge.

import { prisma } from "./db";

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

// Returns true if someone other than `selfId` already owns this name.
// Self-collision (the same user re-saving the same value) returns false.
export async function isBusinessNameTaken(
  lower: string,
  selfId?: string,
): Promise<boolean> {
  const owner = await prisma.user.findUnique({
    where: { businessNameLower: lower },
    select: { id: true },
  });
  if (!owner) return false;
  return owner.id !== selfId;
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
