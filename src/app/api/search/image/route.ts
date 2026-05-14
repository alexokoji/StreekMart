import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import {
  namedColorsFromHex,
  parseQuery,
  rank,
  normalizeQuery,
  type RankableProduct,
  type ViewerSignal,
} from "@/lib/searchBot";
import { parseJsonArray } from "@/lib/utils";
import { getSession } from "@/lib/auth";

// POST /api/search/image { hexColors, hint? }
//
// Image-mode search. The client extracts dominant hex colors from the user's
// uploaded photo (canvas downscaling + k-means in extractColors.ts) and posts
// them here with an optional text "hint" that further narrows the category.
// We never receive the raw image — the bot works purely on the color palette
// + the user's words.

const Body = z.object({
  hexColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  hint: z.string().max(200).optional(),
});

const RESULT_THRESHOLD = 4;

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsedBody = Body.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { hexColors, hint = "" } = parsedBody.data;
  // Convert image colors to named-color tokens so the rest of the pipeline
  // is identical to text search.
  const colorNames = namedColorsFromHex(hexColors);
  const queryText = `${hint} ${colorNames.join(" ")}`.trim();
  const parsed = parseQuery(queryText, colorNames);
  const queryNorm = normalizeQuery(`image:${queryText}`);

  // Pull active products that have at least one image and a tagged color
  // palette OR match the hint's category.
  const candidates = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(parsed.categories.length > 0
        ? { category: { in: parsed.categories } }
        : {}),
    },
    include: {
      seller: { select: { id: true, name: true, exposureScore: true, sellerVerified: true } },
      promotions: { where: { active: true, endsAt: { gt: new Date() } } },
    },
    take: 200,
  });

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentClicks = await prisma.searchLog.findMany({
    where: { queryNorm, clickedProductId: { not: null }, createdAt: { gte: since } },
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

  const viewer = await buildViewerSignal();
  const ranked = rank({ parsed, products: rankable, clickHistory, imageMode: true, viewer });
  const results = ranked.filter((r) => r.score >= 1).slice(0, 18);

  await prisma.searchLog
    .create({ data: { queryNorm, source: "image" } })
    .catch(() => {});

  // Designer fallback whenever image mode comes back thin.
  let designerFallback: { id: string; name: string; bio: string | null; matchingTags: string[]; postCount: number }[] = [];
  if (results.length < RESULT_THRESHOLD) {
    designerFallback = await suggestDesigners(parsed.categories, colorNames);
  }

  const productById = new Map(candidates.map((c) => [c.id, c]));
  return NextResponse.json({
    parsedColors: colorNames,
    parsed: {
      categories: parsed.categories,
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
        seller: { id: c.seller.id, name: c.seller.name, verified: c.seller.sellerVerified },
        score: Math.round(r.score * 100) / 100,
        reasons: r.reasons,
      };
    }),
    designerFallback,
  });
}

async function suggestDesigners(
  categories: string[],
  colorNames: string[],
): Promise<{ id: string; name: string; bio: string | null; matchingTags: string[]; postCount: number }[]> {
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
        select: { category: true, dominantColorsJson: true, tagsJson: true },
      },
    },
  });

  const lowerCats = categories.map((c) => c.toLowerCase());
  const lowerColors = colorNames.map((c) => c.toLowerCase());

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
        for (const cn of lowerColors) {
          if (text.includes(cn)) {
            hits += 0.5;
            matchingTags.add(cn);
          }
        }
        for (const tag of parseJsonArray(post.tagsJson)) {
          if (lowerCats.includes(tag.toLowerCase()) || lowerColors.includes(tag.toLowerCase())) {
            hits += 0.5;
            matchingTags.add(tag);
          }
        }
      }
      for (const p of d.products) {
        if (categories.includes(p.category)) {
          hits += 1;
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

// Same viewer-signal builder as /api/search. Duplicated to avoid pulling
// /api/search's whole route module into the image one.
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
