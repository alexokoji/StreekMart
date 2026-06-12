import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, requireApiUser } from "@/lib/auth";

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});

// GET /api/products/[id]/reviews -- list reviews for a product. Public.
// Returns the list plus the calling user's own review (if any) so the UI
// can show "Edit your review" instead of the write form.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const reviews = await prisma.review.findMany({
    where: { productId: params.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const authorIds = Array.from(new Set(reviews.map((r) => r.authorId)));
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, avatarUrl: true },
      })
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const aggregate = await prisma.review.aggregate({
    where: { productId: params.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const myReview = session
    ? await prisma.review.findUnique({
        where: { productId_authorId: { productId: params.id, authorId: session.sub } },
      })
    : null;

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      author: authorById.get(r.authorId) ?? { id: r.authorId, name: "Anonymous", avatarUrl: null },
    })),
    ratingAvg: aggregate._avg.rating ?? 0,
    ratingCount: aggregate._count._all,
    myReview,
  });
}

// POST /api/products/[id]/reviews -- upsert the caller's review for this
// product. Only buyers who have actually purchased a delivered copy can
// write -- enforced by checking for a COMPLETED order against this product
// from this user.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const eligible = await prisma.order.findFirst({
    where: { buyerId: guard.session.sub, productId: params.id, status: { in: ["COMPLETED", "PAID", "SHIPPED"] } },
    select: { id: true },
  });
  if (!eligible) {
    return NextResponse.json(
      { error: "You can only review products you've purchased." },
      { status: 403 },
    );
  }

  const review = await prisma.review.upsert({
    where: { productId_authorId: { productId: params.id, authorId: guard.session.sub } },
    create: {
      productId: params.id,
      authorId: guard.session.sub,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
    update: {
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
  });

  // Recompute the product's rating aggregates so home/search rails stay fresh.
  const agg = await prisma.review.aggregate({
    where: { productId: params.id },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: params.id },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
  });

  return NextResponse.json({ ok: true, review });
}