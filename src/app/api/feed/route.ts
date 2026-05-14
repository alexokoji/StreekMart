import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { rankScore } from "@/lib/ranking";

// GET /api/feed — combined products + posts feed, ranked by exposure score.
// Active promotions boost their item's score; high-exposure owners get a lift.
export async function GET() {
  const now = new Date();
  const [products, posts] = await Promise.all([
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: {
        seller: { select: { id: true, name: true, exposureScore: true } },
        promotions: { where: { active: true, endsAt: { gt: now } } },
      },
      take: 200,
    }),
    prisma.post.findMany({
      include: {
        author: { select: { id: true, name: true, exposureScore: true } },
        promotions: { where: { active: true, endsAt: { gt: now } } },
      },
      take: 200,
    }),
  ]);

  type FeedItem = {
    kind: "product" | "post";
    id: string;
    score: number;
    promoted: boolean;
    payload: unknown;
  };

  const items: FeedItem[] = [];

  for (const p of products) {
    const promoBoost = p.promotions[0]?.boost ?? 1;
    items.push({
      kind: "product",
      id: p.id,
      promoted: p.promotions.length > 0,
      score: rankScore({
        createdAt: p.createdAt,
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        saveCount: p.saveCount,
        salesCount: p.salesCount,
        ownerExposureScore: p.seller.exposureScore,
        promotionBoost: promoBoost,
      }),
      payload: p,
    });
  }

  for (const p of posts) {
    const promoBoost = p.promotions[0]?.boost ?? 1;
    items.push({
      kind: "post",
      id: p.id,
      promoted: p.promotions.length > 0,
      score: rankScore({
        createdAt: p.createdAt,
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        saveCount: p.saveCount,
        ownerExposureScore: p.author.exposureScore,
        promotionBoost: promoBoost,
      }),
      payload: p,
    });
  }

  items.sort((a, b) => b.score - a.score);
  return NextResponse.json({ items: items.slice(0, 100) });
}
