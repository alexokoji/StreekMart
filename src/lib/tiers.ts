import { prisma } from "./db";

// Verification tiers for sellers and designers. Stored as int on User so
// they sort naturally and existing boolean callers can still derive the
// boolean by checking `tier >= 2`. Gold is sticky once granted — it
// reflects an explicit admin decision rather than a derived state.
export type Tier = 1 | 2 | 3;

/**
 * Recompute the seller tier for a user based on:
 *   - sellerVerified flag (set by admin verification approval)
 *   - presence of a default PICKUP address
 *
 * Never downgrades Gold (Tier 3) — that requires an explicit admin call.
 * Updates the row only when the tier actually changes, so this is safe to
 * call from "anything that might have moved the needle" hooks.
 */
export async function recomputeSellerTier(userId: string): Promise<Tier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sellerTier: true, sellerVerified: true },
  });
  if (!user) return 1;
  if (user.sellerTier === 3) return 3; // sticky

  const hasPickup = await prisma.address.findFirst({
    where: { userId, kind: "PICKUP" },
    select: { id: true },
  });

  const next: Tier = user.sellerVerified && hasPickup ? 2 : 1;
  if (next !== user.sellerTier) {
    await prisma.user.update({
      where: { id: userId },
      data: { sellerTier: next },
    });
  }
  return next;
}

/**
 * Designer tier mirrors seller, minus the pickup requirement — designers
 * don't ship physical goods through us yet, so Tier 2 just needs the admin
 * verification flag. Gold is sticky.
 */
export async function recomputeDesignerTier(userId: string): Promise<Tier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { designerTier: true, designerVerified: true },
  });
  if (!user) return 1;
  if (user.designerTier === 3) return 3;

  const next: Tier = user.designerVerified ? 2 : 1;
  if (next !== user.designerTier) {
    await prisma.user.update({
      where: { id: userId },
      data: { designerTier: next },
    });
  }
  return next;
}

/**
 * Convenience: returns whichever of (sellerTier, designerTier) is highest.
 * Used by UI badges where we want to show the user's "best" verification
 * status without caring which role it came from.
 */
export function topTier(user: { sellerTier?: number | null; designerTier?: number | null }): Tier {
  const s = (user.sellerTier ?? 1) as Tier;
  const d = (user.designerTier ?? 1) as Tier;
  return (Math.max(s, d) as Tier) || 1;
}

/**
 * Bumps a coerced int into the Tier union. Used at boundaries where Prisma
 * hands back a plain `number` but we want the narrow type.
 */
export function asTier(n: number | null | undefined): Tier {
  if (n === 3) return 3;
  if (n === 2) return 2;
  return 1;
}
