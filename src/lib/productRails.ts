// Shared rail-fetch logic used by both the landing-page server components
// (initial SSR batch) and the /api/products/list endpoint (subsequent
// client-side "load more" calls). Centralising it here keeps the two paths
// from drifting apart and ensures the same sort/filter is applied to every
// page of a given rail.

import { prisma } from "./db";
import { ProductKind, ProductStatus, PromotionStatus } from "./enums";
import { shapeProductForCard, rankScore } from "./productShape";
import type { ProductCardData } from "@/components/storefront/ProductCard";

export type RailKey =
  | "flash-sales"
  | "featured"
  | "new-arrivals"
  | "trending-fabrics"
  | "best-sellers";

export const VALID_RAILS: ReadonlyArray<RailKey> = [
  "flash-sales",
  "featured",
  "new-arrivals",
  "trending-fabrics",
  "best-sellers",
];

export function isValidRail(value: string | null | undefined): value is RailKey {
  return !!value && (VALID_RAILS as readonly string[]).includes(value);
}

// Seller include shape every rail needs. Kept as a const so it stays in
// sync with what shapeProductForCard expects.
const sellerInclude = {
  seller: {
    select: {
      id: true,
      name: true,
      businessName: true,
      sellerVerified: true,
      exposureScore: true,
    },
  },
} as const;

type RailResult = {
  items: ProductCardData[];
  hasMore: boolean;
};

export async function fetchRailPage(
  rail: RailKey,
  opts: { offset: number; limit: number },
): Promise<RailResult> {
  const offset = Math.max(0, opts.offset);
  const limit = Math.min(48, Math.max(1, opts.limit));

  switch (rail) {
    case "new-arrivals":
      return fetchNewArrivals(offset, limit);
    case "trending-fabrics":
      return fetchTrendingFabrics(offset, limit);
    case "best-sellers":
      return fetchBestSellers(offset, limit);
    case "flash-sales":
      return fetchFlashSales(offset, limit);
    case "featured":
      return fetchFeatured(offset, limit);
  }
}

async function fetchNewArrivals(offset: number, limit: number): Promise<RailResult> {
  const where = { status: ProductStatus.ACTIVE } as const;
  const rows = await prisma.product.findMany({
    where,
    include: sellerInclude,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    skip: offset,
  });
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit).map(shapeProductForCard), hasMore };
}

async function fetchTrendingFabrics(offset: number, limit: number): Promise<RailResult> {
  const where = { status: ProductStatus.ACTIVE, kind: ProductKind.MATERIAL } as const;
  const rows = await prisma.product.findMany({
    where,
    include: sellerInclude,
    orderBy: { likeCount: "desc" },
    take: limit + 1,
    skip: offset,
  });
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit).map(shapeProductForCard), hasMore };
}

async function fetchBestSellers(offset: number, limit: number): Promise<RailResult> {
  const where = { status: ProductStatus.ACTIVE, salesCount: { gt: 0 } } as const;
  const rows = await prisma.product.findMany({
    where,
    include: sellerInclude,
    orderBy: { salesCount: "desc" },
    take: limit + 1,
    skip: offset,
  });
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit).map(shapeProductForCard), hasMore };
}

// SQLite can't compare two columns in a type-safe `where`, so we fetch every
// product with a non-null salePrice, filter `salePrice < price` in JS, and
// slice the page. The narrow predicate keeps the working set small even at
// marketplace scale.
async function fetchFlashSales(offset: number, limit: number): Promise<RailResult> {
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, salePrice: { not: null } },
    include: sellerInclude,
  });
  const onSale = products
    .filter((p) => p.salePrice !== null && p.salePrice < p.price)
    .sort(
      (a, b) =>
        (b.price - (b.salePrice ?? b.price)) -
        (a.price - (a.salePrice ?? a.price)),
    );
  const slice = onSale.slice(offset, offset + limit);
  return {
    items: slice.map(shapeProductForCard),
    hasMore: offset + limit < onSale.length,
  };
}

// Featured = the six-factor rank score. Can't be expressed in Prisma orderBy
// so we fetch every active product (cap at 500 so a runaway catalogue can't
// blow lambda memory), rank in memory, and slice.
async function fetchFeatured(offset: number, limit: number): Promise<RailResult> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    include: {
      ...sellerInclude,
      promotions: {
        where: {
          active: true,
          status: PromotionStatus.APPROVED,
          endsAt: { gt: now },
        },
      },
    },
    take: 500,
  });
  const ranked = [...products].sort(
    (a, b) =>
      rankScore({
        createdAt: b.createdAt,
        viewCount: b.viewCount,
        likeCount: b.likeCount,
        saveCount: b.saveCount,
        salesCount: b.salesCount,
        ownerExposureScore: b.seller.exposureScore,
        promotionBoost: b.promotions[0]?.boost ?? 1,
      }) -
      rankScore({
        createdAt: a.createdAt,
        viewCount: a.viewCount,
        likeCount: a.likeCount,
        saveCount: a.saveCount,
        salesCount: a.salesCount,
        ownerExposureScore: a.seller.exposureScore,
        promotionBoost: a.promotions[0]?.boost ?? 1,
      }),
  );
  const slice = ranked.slice(offset, offset + limit);
  return {
    items: slice.map(shapeProductForCard),
    hasMore: offset + limit < ranked.length,
  };
}

// Lightweight saved-IDs lookup: scoped to the current page's product ids so
// the query stays tiny even on infinite scroll.
export async function fetchSavedIdsFor(
  userId: string | null | undefined,
  productIds: string[],
): Promise<string[]> {
  if (!userId || productIds.length === 0) return [];
  const favs = await prisma.favorite.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  return favs.map((f) => f.productId!).filter(Boolean);
}
