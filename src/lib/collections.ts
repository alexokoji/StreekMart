// Helpers for the Collection / look-book feature.
//
// Slug rules: lowercase, kebab-case, ≤ 48 chars, no leading/trailing dashes.
// We auto-derive from the title on create and let the owner override later.

const MAX_SLUG_LEN = 48;

export function slugifyCollectionTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
}

// Resolve a unique slug for an owner. If `requestedSlug` collides with an
// existing collection on this owner, suffix with -2, -3, … until clear.
export async function resolveUniqueCollectionSlug(args: {
  prisma: import("@prisma/client").PrismaClient;
  ownerId: string;
  desired: string;
  excludeId?: string;
}): Promise<string> {
  const base = slugifyCollectionTitle(args.desired) || "untitled";
  let candidate = base;
  let n = 2;
  while (true) {
    const clash = await args.prisma.collection.findFirst({
      where: {
        ownerId: args.ownerId,
        slug: candidate,
        ...(args.excludeId ? { id: { not: args.excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`.slice(0, MAX_SLUG_LEN);
    n++;
  }
}

export const CollectionStatus = {
  DRAFT: "DRAFT",
  PUBLIC: "PUBLIC",
} as const;
export type CollectionStatusValue = (typeof CollectionStatus)[keyof typeof CollectionStatus];
