import { NextResponse } from "next/server";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";

// GET /api/me/buy-again -- products from the caller's COMPLETED orders,
// deduped, ordered by most recent purchase first. Skips items that are
// no longer ACTIVE on the storefront so users can't tap into a stale
// product page.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const orders = await prisma.order.findMany({
    where: { buyerId: guard.session.sub, status: OrderStatus.COMPLETED },
    orderBy: { completedAt: "desc" },
    take: 50,
    include: {
      product: {
        include: { seller: { select: { id: true, name: true, businessName: true } } },
      },
    },
  });
  const seen = new Set<string>();
  const items: Array<{
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    image: string | null;
    sellerName: string;
  }> = [];
  for (const o of orders) {
    if (!o.product || seen.has(o.product.id)) continue;
    if (o.product.status !== ProductStatus.ACTIVE) continue;
    seen.add(o.product.id);
    items.push({
      id: o.product.id,
      name: o.product.name,
      price: o.product.price,
      salePrice: o.product.salePrice,
      image: parseJsonArray(o.product.imagesJson)[0] ?? null,
      sellerName: o.product.seller.businessName ?? o.product.seller.name,
    });
    if (items.length >= 12) break;
  }
  return NextResponse.json({ items });
}