// Smart cohorts the email-marketing campaigns target.
//
// Each segment is a Prisma `where` clause + a friendly label. The campaign
// API resolves the segment once at send time so the recipient set matches
// the moment the admin hit "send" (not the moment they picked the segment
// in the UI). Counts shown in the preview are live too.

import { ProductStatus } from "./enums";
import { prisma } from "./db";

export const AUDIENCE_SEGMENTS = {
  // ─── Sellers ───────────────────────────────────────────────────────────
  "sellers-no-products": {
    label: "Sellers with 0 active listings",
    description: "Joined as sellers but never put anything live.",
  },
  "sellers-active": {
    label: "Sellers with ≥1 active listing",
    description: "Anyone running a storefront, regardless of tier.",
  },
  "sellers-verified-multiple": {
    label: "Verified sellers with ≥3 listings",
    description: "Tier 2/3 sellers who already have a real catalog.",
  },

  // ─── Designers ─────────────────────────────────────────────────────────
  "designers-no-posts": {
    label: "Designers with 0 posts",
    description: "Designer accounts with an empty feed presence.",
  },
  "designers-no-commissions": {
    label: "Verified designers with no commission requests yet",
    description: "Visible designers who haven't been briefed by buyers.",
  },
  "designers-no-lookbooks": {
    label: "Designers with ≥3 posts but no look-books",
    description: "Have enough content to bundle into a curated set.",
  },

  // ─── Buyers ────────────────────────────────────────────────────────────
  "buyers-all": {
    label: "All buyers",
    description:
      "Every non-suspended account. Implicit buyer permission means everyone qualifies.",
  },
  "buyers-abandoned-cart": {
    label: "Buyers with items in cart for ≥2 days",
    description: "Showed intent; haven't completed checkout.",
  },
  "buyers-inactive": {
    label: "Buyers inactive for ≥14 days",
    description: "Haven't been seen in two weeks (no lastSeenAt bump).",
  },
} as const;

export type AudienceSegmentKey = keyof typeof AUDIENCE_SEGMENTS;
export const ALL_AUDIENCE_SEGMENT_KEYS = Object.keys(
  AUDIENCE_SEGMENTS,
) as AudienceSegmentKey[];

export type SegmentRecipient = {
  id: string;
  email: string;
  name: string;
};

// 14-day inactivity window for the "welcome back" segment. Pulled to a
// constant so future tuning (10? 21? 30?) is a single change.
const INACTIVE_WINDOW_DAYS = 14;
const ABANDONED_CART_DAYS = 2;

/**
 * Resolve a segment key to the actual list of recipients. Runs at send
 * time so the cohort reflects the very latest state — a buyer who just
 * abandoned a cart yesterday is included on today's campaign.
 *
 * All resolvers exclude suspended accounts unconditionally — they can't
 * sign in and emailing them just generates bounce / unsubscribe noise.
 */
export async function resolveSegmentRecipients(
  key: AudienceSegmentKey,
): Promise<SegmentRecipient[]> {
  const select = { id: true, email: true, name: true } as const;
  const baseExcludeSuspended = { suspendedAt: null };

  switch (key) {
    case "sellers-no-products":
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isSeller: true,
          products: { none: { status: ProductStatus.ACTIVE } },
        },
        select,
      });

    case "sellers-active":
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isSeller: true,
          products: { some: { status: ProductStatus.ACTIVE } },
        },
        select,
      });

    case "sellers-verified-multiple": {
      // SQLite via Prisma doesn't let us filter "has at least 3 products"
      // in a single query, so we pull the verified-seller candidates and
      // gate in JS. Cheap because the verified cohort is bounded.
      const candidates = await prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isSeller: true,
          sellerVerified: true,
        },
        select: {
          ...select,
          _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } },
        },
      });
      return candidates
        .filter((c) => c._count.products >= 3)
        .map(({ id, email, name }) => ({ id, email, name }));
    }

    case "designers-no-posts":
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isDesigner: true,
          posts: { none: {} },
        },
        select,
      });

    case "designers-no-commissions":
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isDesigner: true,
          designerVerified: true,
          commissionsAsDesigner: { none: {} },
        },
        select,
      });

    case "designers-no-lookbooks": {
      const candidates = await prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          isDesigner: true,
          collections: { none: {} },
        },
        select: {
          ...select,
          _count: { select: { posts: true } },
        },
      });
      return candidates
        .filter((c) => c._count.posts >= 3)
        .map(({ id, email, name }) => ({ id, email, name }));
    }

    case "buyers-all":
      return prisma.user.findMany({ where: baseExcludeSuspended, select });

    case "buyers-abandoned-cart": {
      const cutoff = new Date(
        Date.now() - ABANDONED_CART_DAYS * 24 * 60 * 60 * 1000,
      );
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          cart: {
            items: { some: { createdAt: { lte: cutoff } } },
          },
        },
        select,
      });
    }

    case "buyers-inactive": {
      const cutoff = new Date(
        Date.now() - INACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      return prisma.user.findMany({
        where: {
          ...baseExcludeSuspended,
          // Either never seen at all, or last seen before the cutoff.
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
        },
        select,
      });
    }

    default: {
      // exhaustiveness check — TS catches new keys at compile time.
      const _exhaustive: never = key;
      void _exhaustive;
      return [];
    }
  }
}
