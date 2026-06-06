import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { RECS_SYSTEM, chat, isAiEnabled } from "@/lib/ai";
import { parseJsonArray } from "@/lib/utils";

// Personalized "For You" — Claude curates 6 picks from a candidate set,
// using the user's likes/saves as taste signal.

const Picks = z.object({
  picks: z
    .array(
      z.object({
        kind: z.enum(["product", "post"]),
        id: z.string(),
        reason: z.string().min(5).max(200),
      }),
    )
    .max(8),
});

export async function GET() {
  if (!isAiEnabled()) {
    return NextResponse.json({ error: "AI features are disabled." }, { status: 503 });
  }
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  // Buyer preferences (gender + interests) declared at signup. We treat
  // missing values as "no opinion" — they don't filter, just bias.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { gender: true, interestsJson: true },
  });
  const stated = {
    gender: me?.gender ?? null,
    interests: parseJsonArray(me?.interestsJson ?? "[]"),
  };

  // 1. Build the user's taste signal from their recent activity.
  const [likes, favorites] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      include: {
        product: { select: { name: true, category: true } },
        post: { select: { title: true, tagsJson: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: {
        product: { select: { name: true, category: true } },
        post: { select: { title: true, tagsJson: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const signals = [
    // Stated preferences come first so Claude weights them appropriately
    // even when there's no like/save history yet.
    stated.gender ? `shopping for: ${stated.gender}` : null,
    stated.interests.length > 0 ? `stated interests: ${stated.interests.join(", ")}` : null,
    ...likes.map((l) =>
      l.product
        ? `liked product: "${l.product.name}" (${l.product.category})`
        : l.post
          ? `liked post: "${l.post.title}" (tags: ${parseJsonArray(l.post.tagsJson).join(", ")})`
          : null,
    ),
    ...favorites.map((f) =>
      f.product
        ? `saved product: "${f.product.name}" (${f.product.category})`
        : f.post
          ? `saved post: "${f.post.title}" (tags: ${parseJsonArray(f.post.tagsJson).join(", ")})`
          : null,
    ),
  ].filter(Boolean) as string[];

  // 2. Build a candidate pool. Fresh + popular, excluding what they already saved/liked.
  const seenProductIds = new Set(
    [...likes.map((l) => l.productId), ...favorites.map((f) => f.productId)].filter(
      (x): x is string => !!x,
    ),
  );
  const seenPostIds = new Set(
    [...likes.map((l) => l.postId), ...favorites.map((f) => f.postId)].filter(
      (x): x is string => !!x,
    ),
  );

  // Verification filter — recommendations only surface verified accounts.
  // For products: seller must be verified-seller OR verified-designer (a
  // designer who also sells). For posts: author must be a verified designer.
  // Reads the trust line in src/lib/auth — unverified accounts simply don't
  // appear in the candidate pool.
  //
  // Stated-interest bias — when the buyer told us their interest categories
  // at signup, we still pull a wide candidate set (Claude makes the final
  // call) but prefer matching categories first by ordering them above
  // non-matches in the same popularity tier.
  const [candidateProducts, candidatePosts] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        id: { notIn: Array.from(seenProductIds) },
        seller: {
          OR: [
            { sellerVerified: true },
            { designerVerified: true },
          ],
        },
        ...(stated.interests.length > 0 ? { category: { in: stated.interests } } : {}),
      },
      include: { seller: { select: { id: true, name: true, businessName: true } } },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.post.findMany({
      where: {
        id: { notIn: Array.from(seenPostIds) },
        author: { designerVerified: true },
      },
      include: { author: { select: { id: true, name: true } } },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ]);

  // No signal yet → return popular items without an LLM call.
  if (signals.length === 0) {
    const items = [
      ...candidateProducts.slice(0, 4).map((p) => ({
        kind: "product" as const,
        id: p.id,
        reason: "Popular on StreekMart right now",
        data: shapeProduct(p),
      })),
      ...candidatePosts.slice(0, 2).map((p) => ({
        kind: "post" as const,
        id: p.id,
        reason: "Trending designer post",
        data: shapePost(p),
      })),
    ];
    return NextResponse.json({ items, cold: true });
  }

  // 3. Ask Claude to pick 6.
  const candidateBrief = JSON.stringify({
    products: candidateProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description.slice(0, 140),
    })),
    posts: candidatePosts.map((p) => ({
      id: p.id,
      title: p.title,
      tags: parseJsonArray(p.tagsJson),
      excerpt: p.body.slice(0, 140),
    })),
  });

  const userPrompt = `User taste signals (most recent first):
${signals.slice(0, 30).map((s) => `- ${s}`).join("\n")}

Candidate pool:
${candidateBrief}`;

  const { text } = await chat({
    system: RECS_SYSTEM,
    maxTokens: 1200,
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
    return NextResponse.json({ items: [], cold: false }, { status: 200 });
  }

  // 4. Hydrate picks with the actual item data.
  const productById = new Map(candidateProducts.map((p) => [p.id, p]));
  const postById = new Map(candidatePosts.map((p) => [p.id, p]));

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
    // Surface the seller's shop name to buyers; falls back to the personal
    // name for sellers who haven't set a business name yet.
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
