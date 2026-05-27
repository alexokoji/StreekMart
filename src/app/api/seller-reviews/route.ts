import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { OrderStatus } from "@/lib/enums";

// POST /api/seller-reviews { orderId, rating, body? }
//
// Buyer rates the seller of a COMPLETED order. Upserts on orderId — a
// buyer can revise their rating until 30 days after completion, after
// which the row is frozen.
//
// After every write the seller's User.sellerRatingAvg / sellerRatingCount
// cache is recomputed so the home rails, public profile, and the rank
// algorithm read fresh aggregates without a per-page aggregation query.

const RATING_EDIT_WINDOW_DAYS = 30;

const Body = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { orderId, rating, body: text } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { sellerReview: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.buyerId !== guard.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== OrderStatus.COMPLETED) {
    return NextResponse.json(
      { error: "You can only rate a seller after the order is completed." },
      { status: 400 },
    );
  }
  if (order.sellerId === order.buyerId) {
    return NextResponse.json({ error: "Can't rate yourself." }, { status: 400 });
  }

  // Window: revisable for 30 days after completion. Use completedAt when set,
  // fall back to updatedAt for legacy rows that completed before completedAt
  // started being populated.
  const completionRef = order.completedAt ?? order.updatedAt;
  const ageMs = Date.now() - new Date(completionRef).getTime();
  const windowMs = RATING_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const isUpdate = !!order.sellerReview;
  if (isUpdate && ageMs > windowMs) {
    return NextResponse.json(
      { error: "Rating edit window has closed." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.sellerReview.upsert({
      where: { orderId },
      create: {
        orderId,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
        rating,
        body: text,
      },
      update: {
        rating,
        body: text,
        edited: true,
      },
    });

    // Recompute the seller's rating aggregates from the live SellerReview
    // rows. Cheaper than maintaining a delta because aggregates can drift
    // if a row is ever deleted or the schema changes.
    const agg = await tx.sellerReview.aggregate({
      where: { sellerId: order.sellerId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.user.update({
      where: { id: order.sellerId },
      data: {
        sellerRatingAvg: agg._avg.rating ?? 0,
        sellerRatingCount: agg._count._all,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

// GET /api/seller-reviews?sellerId=<id>&limit=20
//
// Lists a seller's reviews, newest first. Public — anyone can read a
// seller's reviews to inform their purchase.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sellerId = url.searchParams.get("sellerId");
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId required" }, { status: 400 });
  }
  const reviews = await prisma.sellerReview.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      buyer: { select: { id: true, name: true, slug: true } },
    },
  });
  return NextResponse.json({ reviews });
}
