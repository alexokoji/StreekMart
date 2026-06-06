import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { CATEGORIES, SMART_SEARCH_SYSTEM, chat, isAiEnabled } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import {
  rank,
  normalizeQuery,
  type ParsedQuery,
  type RankableProduct,
  type ViewerSignal,
} from "@/lib/searchBot";

// Smart search now delegates intent extraction to the LLM and the scoring
// to the same deterministic ranker that /api/search uses. The LLM only
// expands the query into structured intent (synonyms, categories,
// materials, colors, occasion, max_price); the ranker turns that into
// scored matches using engagement, click history, follow boost, and
// material/color biases.

const AllowedOccasions = [
  "wedding", "beach", "office", "party", "casual",
  "formal", "gym", "date", "sleep", "rain", "winter", "summer",
] as const;

const SearchPlan = z.object({
  categories: z.array(z.enum(CATEGORIES)).max(3),
  keywords: z.array(z.string().min(2).max(40)).max(12),
  materials: z.array(z.string().min(2).max(40)).max(6).optional().default([]),
  colors: z.array(z.string().min(2).max(40)).max(6).optional().default([]),
  occasion: z.enum(AllowedOccasions).nullable().optional().default(null),
  max_price: z.number().positive().nullable().optional().default(null),
  rationale: z.string().max(220),
});

const Body = z.object({ query: z.string().min(2).max(300) });

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are disabled. Set GROQ_API_KEY in .env." },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const rawQuery = parsed.data.query;

  // 1. Ask the LLM to extract structured intent.
  const { text } = await chat({
    system: SMART_SEARCH_SYSTEM,
    maxTokens: 600,
    messages: [{ role: "user", content: rawQuery }],
    responseJsonSchema: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
        keywords: { type: "array", items: { type: "string" } },
        materials: { type: "array", items: { type: "string" } },
        colors: { type: "array", items: { type: "string" } },
        occasion: { type: ["string", "null"], enum: [...AllowedOccasions, null] },
        max_price: { type: ["number", "null"] },
        rationale: { type: "string" },
      },
      required: ["categories", "keywords", "rationale"],
    },
  });

  let plan: z.infer<typeof SearchPlan>;
  try {
    plan = SearchPlan.parse(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { error: "Couldn't interpret that query. Try rephrasing?" },
      { status: 422 },
    );
  }

  // 2. Synthesize a ParsedQuery the existing ranker understands. Lowercase
  // everything so substring matching is case-insensitive (the ranker
  // already lowercases the haystack).
  const lowerKeywords = Array.from(
    new Set(
      [
        ...plan.keywords.map((k) => k.toLowerCase().trim()),
        ...plan.materials.map((m) => m.toLowerCase().trim()),
      ].filter(Boolean),
    ),
  );
  const queryParsed: ParsedQuery = {
    rawQuery,
    normalized: rawQuery.toLowerCase(),
    tokens: lowerKeywords,
    categories: plan.categories,
    colors: plan.colors.map((c) => c.toLowerCase()),
    materials: plan.materials.map((m) => m.toLowerCase()),
    maxPrice: plan.max_price ?? undefined,
    occasion: plan.occasion ?? undefined,
    keywords: lowerKeywords,
  };

  // 3. Pull a wide candidate pool. We don't pre-filter on categories — the
  // ranker scores off-category items lower but doesn't drop them, so a
  // miscategorised gem still ranks well if keywords/colors line up. We
  // DO honour the price ceiling cheaply at the DB layer with a generous
  // 1.5x buffer so "under $50" still surfaces a $55 dress.
  const candidates = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(plan.max_price ? { price: { lte: plan.max_price * 1.5 } } : {}),
      ...(plan.categories.length > 0
        ? { category: { in: plan.categories } }
        : {}),
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          businessName: true,
          exposureScore: true,
          sellerVerified: true,
        },
      },
      promotions: { where: { active: true, endsAt: { gt: new Date() } } },
    },
    take: 200,
  });

  // 4. Click-history bias — same as deterministic /api/search.
  const queryNorm = normalizeQuery(rawQuery);
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

  // 5. Viewer personalisation — follows + recently-liked categories.
  const viewer = await buildViewerSignal();

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

  const ranked = rank({
    parsed: queryParsed,
    products: rankable,
    clickHistory,
    viewer,
  });

  // 6. Drop the long tail and shape for the client. Lower threshold than
  // /api/search (0.5 vs 1.0) because AI-driven keywords are richer — a
  // single-hit match here is more meaningful than a single-hit on the
  // tokenizer's raw word list.
  const results = ranked.filter((r) => r.score >= 0.5).slice(0, 24);

  // 7. Log the served query so the click endpoint can record a clicked
  // product against it and improve future ranking.
  await prisma.searchLog.create({ data: { queryNorm, source: "text" } }).catch(() => {});

  const productById = new Map(candidates.map((c) => [c.id, c]));
  return NextResponse.json({
    plan: {
      categories: plan.categories,
      keywords: lowerKeywords,
      materials: plan.materials,
      colors: plan.colors,
      occasion: plan.occasion,
      max_price: plan.max_price,
      rationale: plan.rationale,
    },
    items: results.map((r) => {
      const c = productById.get(r.product.id)!;
      return {
        id: r.product.id,
        name: r.product.name,
        price: r.product.price,
        salePrice: r.product.salePrice,
        category: r.product.category,
        description: c.description,
        image: parseJsonArray(c.imagesJson)[0] ?? null,
        seller: {
          id: c.seller.id,
          name: c.seller.businessName?.trim() || c.seller.name,
        },
        likeCount: c.likeCount,
        score: Math.round(r.score * 100) / 100,
        reasons: r.reasons,
      };
    }),
  });
}

// Same shape as /api/search's viewer signal — follows + recent liked
// categories. Anonymous requests skip this and the ranker no-ops the
// personalisation bumps.
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
  return {
    followedSellerIds: new Set(follows.map((f) => f.designerId)),
    recentLikedCategories: new Set(
      recent.map((l) => l.product?.category).filter((c): c is string => !!c),
    ),
  };
}
