// Consistent seller display name across the app.
//
// Rule: always prefer the business name buyers see. Fall back to the
// person's real name only when the business name is missing OR an
// empty string (the server sends empty strings often enough that a
// plain `??` falls through to blank text). Final fallback is "Shop"
// so a row never renders empty.

export function sellerDisplayName(
  seller:
    | {
        name?: string | null;
        businessName?: string | null;
      }
    | null
    | undefined,
  fallback = "Shop",
): string {
  if (!seller) return fallback;
  const business = (seller.businessName ?? "").trim();
  if (business) return business;
  const name = (seller.name ?? "").trim();
  if (name) return name;
  return fallback;
}
