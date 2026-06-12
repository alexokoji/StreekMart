import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";

const PostBody = z.object({ productId: z.string().min(1) });
const ROLLING_CAP = 50;

// GET /api/recently-viewed -- the calling user's last N viewed products.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const rows = await prisma.recentlyViewed.findMany({
    where: { userId: guard.session.sub },
    orderBy: { viewedAt: "desc" },
    take: 20,
    include: {
      product: {
        include: { seller: { select: { id: true, name: true, businessName: true } } },
      },
    },
  });
  const items = rows
    .filter((r) => r.product && r.product.status === "ACTIVE")
    .map((r) => {
      const images = parseJsonArray(r.product.imagesJson);
      return {
        id: r.product.id,
        name: r.product.name,
        price: r.product.price,
        salePrice: r.product.salePrice,
        image: images[0] ?? null,
        sellerName: r.product.seller.businessName?.trim() || r.product.seller.name,
      };
    });
  return NextResponse.json({ items });
}

// POST /api/recently-viewed { productId } -- record a view. Upserts so a
// repeat view bumps viewedAt rather than inserting. After write we prune
// older rows down to ROLLING_CAP per user.
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const userId = guard.session.sub;
  await prisma.recentlyViewed.upsert({
    where: { userId_productId: { userId, productId: parsed.data.productId } },
    create: { userId, productId: parsed.data.productId },
    update: {},
  });

  // Prune to ROLLING_CAP. Cheap because of the (userId, viewedAt) index.
  const all = await prisma.recentlyViewed.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    select: { id: true },
  });
  if (all.length > ROLLING_CAP) {
    const toDelete = all.slice(ROLLING_CAP).map((x) => x.id);
    await prisma.recentlyViewed.deleteMany({ where: { id: { in: toDelete } } });
  }
  return NextResponse.json({ ok: true });
}