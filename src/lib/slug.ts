// Slug helpers for memorable shareable profile URLs.
//
//   /u/seoul-threads       (good — readable, brandable, easy to print)
//   /u/cmen8sxrs0001wsnq…  (still works as a fallback)
//
// The store's source of truth is User.slug (unique, optional). Generators
// here normalise free-text to URL-safe characters and resolve collisions.

import { prisma } from "./db";

const RESERVED = new Set([
  "admin",
  "account",
  "api",
  "cart",
  "checkout",
  "feed",
  "favorites",
  "wishlist",
  "messages",
  "search",
  "sketch",
  "login",
  "logout",
  "register",
  "products",
  "posts",
  "u",
  "unauthorized",
  "seller",
  "designer",
  "settings",
]);

const MIN_LEN = 3;
const MAX_LEN = 30;

// Normalise free-text → ASCII slug. Strips diacritics, drops everything that
// isn't [a-z0-9-], collapses runs of `-`, trims leading/trailing dashes.
export function slugify(input: string): string {
  const lowered = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase();
  const replaced = lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return replaced.slice(0, MAX_LEN);
}

// Validate a user-typed slug. Returns null if OK, otherwise an error string.
export function validateSlug(s: string): string | null {
  if (s.length < MIN_LEN) return `Handle must be at least ${MIN_LEN} characters.`;
  if (s.length > MAX_LEN) return `Handle must be at most ${MAX_LEN} characters.`;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)) {
    return "Use only lowercase letters, numbers, and dashes (no leading/trailing dash).";
  }
  if (RESERVED.has(s)) return "That handle is reserved.";
  return null;
}

// Find a unique slug derived from the given seed. Adds -2, -3, … on collision.
// `excludeUserId` lets the same user keep their existing slug while validating.
export async function uniqueSlugFrom(seed: string, excludeUserId?: string): Promise<string> {
  let base = slugify(seed) || "user";
  if (base.length < MIN_LEN) base = `user-${base}`;
  if (RESERVED.has(base)) base = `${base}-1`;

  let candidate = base;
  let suffix = 1;
  // Tight loop; bail at 50 attempts (effectively never hit in practice).
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.user.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeUserId) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  // Last-ditch: append a random tail so we don't loop forever.
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
