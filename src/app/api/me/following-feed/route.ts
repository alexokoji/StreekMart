import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";

// GET /api/me/following-feed -- products from sellers/designers the
// caller follows, ordered by newest listing. Caps at 12 so the home rail
// stays snappy.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const follows = await prisma.follow.findMany({
    where: { followerId: guard.session.sub },
    select: { designerId: true },
    take: 50,
  });
  if (follows.length === 0) return NextResponse.json({ items: [] });
  const ids = follows.map((f) => f.designerId);
  const products = await prisma.product.findMany({
    where: { sellerId: { in: ids }, status: ProductStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { seller: { select: { id: true, name: true, businessName: true } } },
  });
  return NextResponse.json({
    items: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.salePrice,
      image: parseJsonArray(p.imagesJson)[0] ?? null,
      sellerName: p.seller.businessName ?? p.seller.name,
    })),
  });
}