import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { parseQuery, rank, normalizeQuery, type RankableProduct, type ViewerSignal } from "@/lib/searchBot";
import { parseJsonArray } from "@/lib/utils";
import { getSession } from "@/lib/auth";

// POST /api/search { query, hintColors?, source? }
// Deterministic text search. Returns ranked products and (when results are
// thin) a designer-recommendation fallback so the user can request a
// custom piece from someone whose past work matches the query.

const Body = z.object({
  query: z.string().min(1).max(300),
  hintColors: z.array(z.string()).max(8).optional(),
  source: z.enum(["text", "image"]).optional(),
});

const RESULT_THRESHOLD = 4;

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsedBody = Body.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { query, hintColors = [], source = "text" } = parsedBody.data;
  const parsed = parseQuery(query, hintColors);
  const queryNorm = normalizeQuery(query);

  // Pull a candidate pool. We pre-filter on category if the bot is confident,
  // otherwise we read the broader active set and let the ranker decide.
  const candidates = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(parsed.maxPrice ? { price: { lte: parsed.maxPrice * 1.5 } } : {}),
      ...(parsed.categories.length > 0
        ? {
            OR: [
              { category: { in: parsed.categories } },
              ...parsed.keywords.length > 0
                ? [{ name: { contains: parsed.keywords[0] } }]
                : [],
            ],
          }
        : {}),
    },
    include: {
      seller: { select: { id: true, name: true, businessName: true, exposureScore: true, sellerVerified: true } },
      promotions: { where: { active: true, endsAt: { gt: new Date() } } },
    },
    take: 200,
  });

  // Click-history lookup for this exact normalized query, last 60 days.
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentClicks = await prisma.searchLog.findMany({
    where: {
      queryNorm,
      clickedProductId: { not: null },
      createdAt: { gte: since },
    },
    select: { clickedProductId: true },
  });
  const clickHistory = new Map<string, number>();
  for (const r of recentClicks) {
    if (r.clickedProductId) {
      clickHistory.set(r.clickedProductId, (clickHistory.get(r.clickedProductId) ?? 0) + 1);
    }
  }

  const rankable: RankableProduct[] = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    salePrice: p.salePrice,
    kind: p.kind,
    likeCount: p.likeCount,
    saveCount: p.saveCount,
    salesCount: p.salesCount,
    ratingAvg: p.ratingAvg,
    exposureScore: p.seller.exposureScore,
    dominantColors: parseJsonArray(p.dominantColorsJson),
    tags: parseJsonArray(p.tagsJson).map((t) => t.toLowerCase()),
    promoted: p.promotions.length > 0,
    sellerId: p.seller.id,
    sellerVerified: p.seller.sellerVerified,
  }));

  // Build viewer signal — followed designers + recently-engaged categories.
  // Anonymous requests skip this entirely (the ranker handles undefined).
  const viewer = await buildViewerSignal();

  const ranked = rank({
    parsed,
    products: rankable,
    clickHistory,
    imageMode: source === "image",
    viewer,
  });
  // Drop the long tail — anything below 1 is mostly noise.
  const results = ranked.filter((r) => r.score >= 1).slice(0, 24);

  // Log the served query so future ranking can learn from it.
  // Click-through is recorded separately by /api/search/click.
  await prisma.searchLog
    .create({ data: { queryNorm, source } })
    .catch(() => {});

  // Designer fallback: if we returned almost nothing, look for designers
  // whose recent posts/products match the query's categories.
  let designerFallback: DesignerFallback[] = [];
  if (results.length < RESULT_THRESHOLD && parsed.categories.length > 0) {
    designerFallback = await suggestDesigners(parsed.categories);
  }

  const productById = new Map(candidates.map((c) => [c.id, c]));
  return NextResponse.json({
    parsed: {
      categories: parsed.categories,
      colors: parsed.colors,
      materials: parsed.materials,
      maxPrice: parsed.maxPrice,
      occasion: parsed.occasion,
      keywords: parsed.keywords,
    },
    results: results.map((r) => {
      const c = productById.get(r.product.id)!;
      return {
        id: r.product.id,
        name: r.product.name,
        category: r.product.category,
        price: r.product.price,
        salePrice: r.product.salePrice,
        image: parseJsonArray(c.imagesJson)[0] ?? null,
        seller: {
          id: c.seller.id,
          name: c.seller.businessName?.trim() || c.seller.name,
          verified: c.seller.sellerVerified,
        },
        score: Math.round(r.score * 100) / 100,
        reasons: r.reasons,
      };
    }),
    designerFallback,
    serveCount: ranked.length,
  });
}

type DesignerFallback = {
  id: string;
  name: string;
  bio: string | null;
  matchingTags: string[];
  postCount: number;
};

async function suggestDesigners(categories: string[]): Promise<DesignerFallback[]> {
  // Find designers whose recent posts contain category words (in title or
  // tags). We don't have a Posts.category column so we substring-match
  // against title/body/tags — same approach the bot uses for products.
  const designers = await prisma.user.findMany({
    where: { isDesigner: true },
    orderBy: { exposureScore: "desc" },
    take: 30,
    include: {
      posts: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { title: true, body: true, tagsJson: true },
      },
      products: {
        where: { status: ProductStatus.ACTIVE },
        take: 8,
        select: { category: true, name: true, tagsJson: true },
      },
    },
  });

  const lowerCats = categories.map((c) => c.toLowerCase());

  const scored = designers
    .map((d) => {
      const matchingTags = new Set<string>();
      let hits = 0;
      for (const post of d.posts) {
        const text = (post.title + " " + post.body).toLowerCase();
        for (const c of lowerCats) {
          if (text.includes(c)) {
            hits++;
            matchingTags.add(c);
          }
        }
        for (const tag of parseJsonArray(post.tagsJson)) {
          for (const c of lowerCats) {
            if (tag.toLowerCase().includes(c)) {
              hits++;
              matchingTags.add(tag);
            }
          }
        }
      }
      for (const p of d.products) {
        if (categories.includes(p.category)) {
          hits += 2;
          matchingTags.add(p.category);
        }
      }
      return {
        id: d.id,
        name: d.name,
        bio: d.bio,
        matchingTags: [...matchingTags].slice(0, 5),
        postCount: d.posts.length,
        hits,
      };
    })
    .filter((d) => d.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4);

  return scored.map(({ hits, ...rest }) => rest);
}

// Build a small viewer signal for the ranker. Pulls the follower's followed
// designers and the categories of their last 30 likes/saves. Returns
// undefined for anonymous requests so the ranker stays cheap to call.
async function buildViewerSignal(): Promise<ViewerSignal | undefined> {
  const session = await getSession();
  if (!session) return undefined;

  const [follows, recent] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: session.sub },
      select: { designerId: true },
      take: 200,
    }),
    prisma.like.findMany({
      where: { userId: session.sub, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { product: { select: { category: true } } },
    }),
  ]);

  const followedSellerIds = new Set(follows.map((f) => f.designerId));
  const recentLikedCategories = new Set(
    recent.map((l) => l.product?.category).filter((c): c is string => !!c),
  );
  return { followedSellerIds, recentLikedCategories };
}
