import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { RECS_SYSTEM, chat, isAiEnabled } from "@/lib/ai";
import { parseJsonArray } from "@/lib/utils";

// Personalized "For You" — the LLM curates 8 picks from a candidate
// pool, using a rich set of activity signals (likes, saves, follows,
// cart, orders, search clicks) plus stated preferences. The candidate
// pool itself is pre-ranked deterministically by engagement + stated-
// interest match so the LLM picks from a tilted-but-not-filtered set.

const Picks = z.object({
  picks: z
    .array(
      z.object({
        kind: z.enum(["product", "post"]),
        id: z.string(),
        reason: z.string().min(5).max(200),
      }),
    )
    .max(10),
});

const SIGNAL_WINDOW_DAYS = 30;
const MAX_CANDIDATE_PRODUCTS = 50;
const MAX_CANDIDATE_POSTS = 20;
const TARGET_PICKS = 8;

export async function GET() {
  if (!isAiEnabled()) {
    return NextResponse.json({ error: "AI features are disabled." }, { status: 503 });
  }
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ── 1. Gather signals in parallel ──
  const [
    me,
    likes,
    favorites,
    follows,
    cartItems,
    orders,
    searchClicks,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true, interestsJson: true },
    }),
    prisma.like.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, category: true, sellerId: true } },
        post: { select: { id: true, title: true, tagsJson: true, authorId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, category: true, sellerId: true } },
        post: { select: { id: true, title: true, tagsJson: true, authorId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { designerId: true, designer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.cart
      .findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, category: true, sellerId: true } },
            },
          },
        },
      })
      .then((c) => c?.items ?? []),
    prisma.order.findMany({
      where: { buyerId: userId, createdAt: { gte: since } },
      include: {
        product: { select: { id: true, name: true, category: true, sellerId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Search clicks within the last window — what they searched for and which
    // product they tapped. The strongest "I'm actually looking for X" signal.
    // SearchLog has no FK relation on clickedProductId (it's a loose string
    // so deleted products don't break the log), so we hydrate the clicked
    // products separately below after this batch resolves.
    prisma.searchLog.findMany({
      where: {
        userId,
        clickedProductId: { not: null },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const stated = {
    gender: me?.gender ?? null,
    interests: parseJsonArray(me?.interestsJson ?? "[]"),
  };

  // Hydrate the clicked-product ids in search history.
  const clickedProductIds = searchClicks
    .map((s) => s.clickedProductId)
    .filter((x): x is string => !!x);
  const clickedProducts = clickedProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: clickedProductIds } },
        select: { id: true, name: true, category: true, sellerId: true },
      })
    : [];
  const clickedById = new Map(clickedProducts.map((p) => [p.id, p]));

  // ── 2. Build the "seen" set so we don't recommend stuff they already engaged with ──
  const seenProductIds = new Set<string>();
  const seenPostIds = new Set<string>();
  const recentSellerIds = new Set<string>(); // sellers the user has touched

  for (const l of likes) {
    if (l.productId) seenProductIds.add(l.productId);
    if (l.postId) seenPostIds.add(l.postId);
    if (l.product?.sellerId) recentSellerIds.add(l.product.sellerId);
    if (l.post?.authorId) recentSellerIds.add(l.post.authorId);
  }
  for (const f of favorites) {
    if (f.productId) seenProductIds.add(f.productId);
    if (f.postId) seenPostIds.add(f.postId);
    if (f.product?.sellerId) recentSellerIds.add(f.product.sellerId);
    if (f.post?.authorId) recentSellerIds.add(f.post.authorId);
  }
  for (const ci of cartItems) {
    seenProductIds.add(ci.productId);
    if (ci.product?.sellerId) recentSellerIds.add(ci.product.sellerId);
  }
  for (const o of orders) {
    seenProductIds.add(o.productId);
    if (o.product?.sellerId) recentSellerIds.add(o.product.sellerId);
  }
  for (const s of searchClicks) {
    if (s.clickedProductId) seenProductIds.add(s.clickedProductId);
    const c = s.clickedProductId ? clickedById.get(s.clickedProductId) : undefined;
    if (c?.sellerId) recentSellerIds.add(c.sellerId);
  }
  for (const f of follows) recentSellerIds.add(f.designerId);

  // Categories the user has engaged with recently — used to bias the
  // candidate pool's pre-rank.
  const engagedCategories = new Set<string>();
  for (const l of likes) {
    if (l.product?.category) engagedCategories.add(l.product.category);
  }
  for (const f of favorites) {
    if (f.product?.category) engagedCategories.add(f.product.category);
  }
  for (const o of orders) {
    if (o.product?.category) engagedCategories.add(o.product.category);
  }
  for (const c of clickedProducts) engagedCategories.add(c.category);
  for (const i of stated.interests) {
    if (typeof i === "string") engagedCategories.add(i);
  }

  // ── 3. Build LLM-facing signals (one line each, most recent first) ──
  const signals: string[] = [];
  if (stated.gender) signals.push(`shopping for: ${stated.gender}`);
  if (stated.interests.length > 0) {
    signals.push(`stated interests: ${stated.interests.join(", ")}`);
  }
  for (const f of follows.slice(0, 5)) {
    if (f.designer?.name) signals.push(`follows designer: ${f.designer.name}`);
  }
  for (const o of orders.slice(0, 5)) {
    if (o.product) {
      signals.push(`purchased: "${o.product.name}" (${o.product.category})`);
    }
  }
  for (const ci of cartItems.slice(0, 5)) {
    if (ci.product) {
      signals.push(`added to cart: "${ci.product.name}" (${ci.product.category})`);
    }
  }
  for (const s of searchClicks.slice(0, 5)) {
    const p = s.clickedProductId ? clickedById.get(s.clickedProductId) : undefined;
    if (p) {
      signals.push(`searched and clicked: "${s.queryNorm}" → "${p.name}" (${p.category})`);
    }
  }
  for (const l of likes.slice(0, 10)) {
    if (l.product) {
      signals.push(`liked product: "${l.product.name}" (${l.product.category})`);
    } else if (l.post) {
      signals.push(
        `liked post: "${l.post.title}" (tags: ${parseJsonArray(l.post.tagsJson).join(", ")})`,
      );
    }
  }
  for (const f of favorites.slice(0, 10)) {
    if (f.product) {
      signals.push(`saved product: "${f.product.name}" (${f.product.category})`);
    } else if (f.post) {
      signals.push(
        `saved post: "${f.post.title}" (tags: ${parseJsonArray(f.post.tagsJson).join(", ")})`,
      );
    }
  }

  // ── 4. Candidate pool — wide, no hard interest filter ──
  // Drop the old `category: { in: stated.interests }` clause. That filter
  // killed diversity (a buyer who said "Dresses" at signup never saw bags
  // again). Instead we score by engaged-category match in JS below.
  const [candidateProducts, candidatePosts] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        id: { notIn: Array.from(seenProductIds) },
        seller: { OR: [{ sellerVerified: true }, { designerVerified: true }] },
      },
      include: {
        seller: { select: { id: true, name: true, businessName: true, exposureScore: true } },
      },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.post.findMany({
      where: {
        id: { notIn: Array.from(seenPostIds) },
        author: { designerVerified: true },
      },
      include: { author: { select: { id: true, name: true, exposureScore: true } } },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
  ]);

  // ── 5. Pre-rank candidates so the LLM sees the most promising ones ──
  // Score = engagement + engaged-category match + recent-seller match.
  function scoreProduct(p: (typeof candidateProducts)[number]): number {
    let s = 0;
    s += Math.log1p(p.likeCount) * 0.3;
    s += Math.log1p(p.saveCount) * 0.4;
    s += Math.log1p(p.salesCount) * 0.5;
    s += Math.log1p(p.seller.exposureScore) * 0.2;
    if (engagedCategories.has(p.category)) s += 1.5;
    if (recentSellerIds.has(p.seller.id)) s += 1.0;
    return s;
  }
  function scorePost(p: (typeof candidatePosts)[number]): number {
    let s = 0;
    s += Math.log1p(p.likeCount) * 0.3;
    s += Math.log1p(p.saveCount) * 0.4;
    s += Math.log1p(p.author.exposureScore) * 0.2;
    if (recentSellerIds.has(p.author.id)) s += 1.5;
    return s;
  }

  const rankedProducts = [...candidateProducts]
    .map((p) => ({ p, score: scoreProduct(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATE_PRODUCTS)
    .map((x) => x.p);
  const rankedPosts = [...candidatePosts]
    .map((p) => ({ p, score: scorePost(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATE_POSTS)
    .map((x) => x.p);

  // ── 6. Cold-start branch — no signals → popular items, no LLM ──
  if (signals.length === 0) {
    const items = [
      ...rankedProducts.slice(0, 6).map((p) => ({
        kind: "product" as const,
        id: p.id,
        reason: "Popular on StreekMart right now",
        data: shapeProduct(p),
      })),
      ...rankedPosts.slice(0, 2).map((p) => ({
        kind: "post" as const,
        id: p.id,
        reason: "Trending designer post",
        data: shapePost(p),
      })),
    ];
    return NextResponse.json({ items, cold: true });
  }

  // ── 7. Ask the LLM to pick TARGET_PICKS ──
  const candidateBrief = JSON.stringify({
    products: rankedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      seller: p.seller.businessName?.trim() || p.seller.name,
      description: p.description.slice(0, 140),
    })),
    posts: rankedPosts.map((p) => ({
      id: p.id,
      title: p.title,
      tags: parseJsonArray(p.tagsJson),
      excerpt: p.body.slice(0, 140),
    })),
  });

  const userPrompt = `User signals (most recent first):
${signals.slice(0, 40).map((s) => `- ${s}`).join("\n")}

Candidate pool (already filtered to items the user hasn't seen):
${candidateBrief}

Pick ${TARGET_PICKS} items.`;

  const { text } = await chat({
    system: RECS_SYSTEM,
    maxTokens: 1400,
    messages: [{ role: "user", content: userPrompt }],
    responseJsonSchema: {
      type: "object",
      properties: {
        picks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["product", "post"] },
              id: { type: "string" },
              reason: { type: "string" },
            },
            required: ["kind", "id", "reason"],
          },
        },
      },
      required: ["picks"],
    },
  });

  let picks: z.infer<typeof Picks>;
  try {
    picks = Picks.parse(JSON.parse(text));
  } catch {
    // LLM gave back something unparseable. Fall back to the pre-ranked
    // candidates so the user sees something useful rather than an empty
    // panel — the pre-rank already weights their engaged categories.
    const items = [
      ...rankedProducts.slice(0, 6).map((p) => ({
        kind: "product" as const,
        id: p.id,
        reason: engagedCategories.has(p.category)
          ? `Matches your interest in ${p.category.toLowerCase()}`
          : "Popular pick for you",
        data: shapeProduct(p),
      })),
      ...rankedPosts.slice(0, 2).map((p) => ({
        kind: "post" as const,
        id: p.id,
        reason: recentSellerIds.has(p.author.id)
          ? `From a designer you follow`
          : "Trending designer post",
        data: shapePost(p),
      })),
    ];
    return NextResponse.json({ items, cold: false, fallback: true });
  }

  // ── 8. Hydrate picks ──
  const productById = new Map(rankedProducts.map((p) => [p.id, p]));
  const postById = new Map(rankedPosts.map((p) => [p.id, p]));

  const items = picks.picks
    .map((pk) => {
      if (pk.kind === "product") {
        const p = productById.get(pk.id);
        if (!p) return null;
        return { kind: "product" as const, id: p.id, reason: pk.reason, data: shapeProduct(p) };
      }
      const p = postById.get(pk.id);
      if (!p) return null;
      return { kind: "post" as const, id: p.id, reason: pk.reason, data: shapePost(p) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ items, cold: false });
}

function shapeProduct(p: {
  id: string;
  name: string;
  price: number;
  category: string;
  imagesJson: string;
  seller: { id: string; name: string; businessName: string | null };
}) {
  return {
    name: p.name,
    price: p.price,
    category: p.category,
    image: parseJsonArray(p.imagesJson)[0] ?? null,
    seller: p.seller.businessName?.trim() || p.seller.name,
    href: `/products/${p.id}`,
  };
}

function shapePost(p: {
  id: string;
  title: string;
  imagesJson: string;
  author: { id: string; name: string };
}) {
  return {
    title: p.title,
    image: parseJsonArray(p.imagesJson)[0] ?? null,
    author: p.author.name,
    href: `/posts/${p.id}`,
  };
}
