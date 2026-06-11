// Runtime category list — the source of truth is the DB Category table,
// not the legacy const in src/lib/enums.ts. The const still ships as the
// SEED (so a fresh dev DB still has all the original categories) but
// admins can add new ones from /admin/categories without a code change.
//
// Pattern:
//   - readCategories() returns the active list, cached for CACHE_TTL_MS
//   - invalidateCategoryCache() bumps the cache when admin writes
//   - z-validators use a pre-loaded snapshot; refresh on mutation
//
// Synchronous consumers (Zod enum factories that need the values at
// module init) fall back to the const so SSR/route compilation never
// blocks on a DB hit.

import { prisma } from "@/lib/db";
import { CATEGORY_GROUPS, ProductKind } from "@/lib/enums";

export type Category = {
  id: string;
  name: string;
  groupName: string;
  displayOrder: number;
  enabled: boolean;
  kind: "MATERIAL" | "PRODUCT";
};

const CACHE_TTL_MS = 60_000;
let cache: { data: Category[]; expiresAt: number } | null = null;

export function invalidateCategoryCache(): void {
  cache = null;
}

export async function readCategories(): Promise<Category[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  const rows = await prisma.category.findMany({
    orderBy: [{ groupName: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  const data = rows.map<Category>((r) => ({
    id: r.id,
    name: r.name,
    groupName: r.groupName,
    displayOrder: r.displayOrder,
    enabled: r.enabled,
    kind: r.kind === "MATERIAL" ? "MATERIAL" : "PRODUCT",
  }));
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

// Active = enabled. Used for buyer-facing surfaces (search filters, AI
// prompts, product create dropdowns).
export async function readActiveCategoryNames(): Promise<string[]> {
  const all = await readCategories();
  return all.filter((c) => c.enabled).map((c) => c.name);
}

export async function readCategoryGroups(): Promise<Record<string, string[]>> {
  const all = (await readCategories()).filter((c) => c.enabled);
  const grouped: Record<string, string[]> = {};
  for (const c of all) {
    (grouped[c.groupName] ??= []).push(c.name);
  }
  return grouped;
}

// Whether a value is currently a valid product category. Cached so
// validators don't blow up DB QPS on every product write.
export async function isValidCategory(name: string): Promise<boolean> {
  const names = await readActiveCategoryNames();
  return names.includes(name);
}

export async function kindForCategoryAsync(name: string): Promise<"MATERIAL" | "PRODUCT"> {
  const rows = await readCategories();
  const match = rows.find((c) => c.name === name);
  if (match) return match.kind;
  // Fallback: derive from legacy const so a category that exists in the
  // user's product table but somehow not in DB still resolves.
  return (CATEGORY_GROUPS.Materials as readonly string[]).includes(name)
    ? ProductKind.MATERIAL
    : ProductKind.PRODUCT;
}

// Seed the Category table from the legacy const. Idempotent — upserts by
// `name`. Called from the prebuild script so prod DBs always have the
// base set even if the admin hasn't logged in yet.
export async function seedCategoriesFromConst(): Promise<{ inserted: number; total: number }> {
  let inserted = 0;
  for (const [groupName, names] of Object.entries(CATEGORY_GROUPS)) {
    let order = 0;
    for (const name of names as readonly string[]) {
      const kind = (CATEGORY_GROUPS.Materials as readonly string[]).includes(name)
        ? "MATERIAL"
        : "PRODUCT";
      const existing = await prisma.category.findUnique({ where: { name } });
      if (existing) {
        // Repair group/order/kind drift on existing rows so re-seeding
        // after a const edit re-aligns them.
        await prisma.category.update({
          where: { name },
          data: { groupName, displayOrder: order, kind },
        });
      } else {
        await prisma.category.create({
          data: { name, groupName, displayOrder: order, kind, enabled: true },
        });
        inserted++;
      }
      order += 10;
    }
  }
  invalidateCategoryCache();
  const total = await prisma.category.count();
  return { inserted, total };
}
