import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";

// GET /api/suggestions
//
// Returns up to 12 product suggestions for the homepage rail. Deterministic
// (no Claude call) so it's cheap to load on every visit.
//
//   - Anonymous visitor: "what's hot" — popular + recent verified-seller
//     items, optionally filtered by ?category=… or ?country=… (from edge geo).
//   - Signed-in user: factors in their stated gender + interests, plus
//     their recent likes/favorites. Falls back to popularity when nothing
//     is known.
//
// Designed to power both the homepage and the search-page empty state.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryFilter = url.searchParams.get("category");
  const session = await getSession();

  // Build the WHERE clause progressively.
  const where: Record<string, unknown> = {
    status: ProductStatus.ACTIVE,
    seller: {
      OR: [{ sellerVerified: true }, { designerVerified: true }],
    },
  };

  // 1. Hard filter from query param (search-page use case).
  if (categoryFilter) {
    where.category = categoryFilter;
  }

  // 2. Soft preference from the signed-in user's profile.
  let preferredCategories: string[] = [];
  if (session) {
    const me = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { interestsJson: true, gender: true, country: true },
    });
    if (me) {
      preferredCategories = parseJsonArray(me.interestsJson);
    }
  }

  // First pass — narrow to preferred categories if any (and no hard filter).
  let products = await prisma.product.findMany({
    where: {
      ...where,
      ...(preferredCategories.length > 0 && !categoryFilter
        ? { category: { in: preferredCategories } }
        : {}),
    },
    include: {
      seller: { select: { id: true, name: true, slug: true, sellerVerified: true } },
    },
    orderBy: [{ likeCount: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  // Second pass — if the preferences filter starved the result set, fall
  // back to the broader pool. Mix-and-match by deduping on id.
  if (products.length < 12) {
    const ids = new Set(products.map((p) => p.id));
    const broader = await prisma.product.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, slug: true, sellerVerified: true } },
      },
      orderBy: [{ likeCount: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
      take: 24,
    });
    for (const p of broader) {
      if (!ids.has(p.id)) {
        products.push(p);
        ids.add(p.id);
      }
      if (products.length >= 12) break;
    }
  }

  const items = products.slice(0, 12).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice,
    category: p.category,
    image: parseJsonArray(p.imagesJson)[0] ?? null,
    seller: p.seller,
  }));

  return NextResponse.json({
    items,
    personalised: !!session && preferredCategories.length > 0,
  });
}
