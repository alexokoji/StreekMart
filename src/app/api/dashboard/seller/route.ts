import { NextResponse } from "next/server";
import { OrderStatus, Permission, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/dashboard/seller -- summary used by both the web seller
// dashboard and the mobile SellerDashboardScreen. Returns KPIs + the 5
// most recent orders. Designed to be one round-trip from the mobile so
// the dashboard renders without spinners.
export async function GET() {
  const guard = await requireApiUser(Permission.SELLER);
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  const [
    productCount,
    activeProducts,
    activeOrders,
    completedOrders,
    recentOrders,
    pendingPayouts,
  ] = await Promise.all([
    prisma.product.count({ where: { sellerId: userId } }),
    prisma.product.count({ where: { sellerId: userId, status: ProductStatus.ACTIVE } }),
    prisma.order.count({
      where: {
        sellerId: userId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED] },
      },
    }),
    prisma.order.count({ where: { sellerId: userId, status: OrderStatus.COMPLETED } }),
    prisma.order.findMany({
      where: { sellerId: userId },
      include: {
        product: { select: { id: true, name: true, imagesJson: true } },
        buyer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.payoutRequest
      .count({ where: { userId, status: { in: ["PENDING", "PROCESSING"] } } })
      .catch(() => 0),
  ]);

  return NextResponse.json({
    stats: {
      productCount,
      activeProducts,
      activeOrders,
      completedOrders,
      pendingPayouts,
    },
    recentOrders: recentOrders.map((o) => {
      let firstImage: string | null = null;
      try {
        const parsed = JSON.parse(o.product?.imagesJson ?? "[]");
        if (Array.isArray(parsed) && typeof parsed[0] === "string") firstImage = parsed[0];
      } catch {
        firstImage = null;
      }
      return {
        id: o.id,
        status: o.status,
        totalPrice: o.totalPrice,
        createdAt: o.createdAt.toISOString(),
        product: { id: o.product?.id ?? "", name: o.product?.name ?? "", image: firstImage },
        buyer: o.buyer ? { id: o.buyer.id, name: o.buyer.name } : null,
      };
    }),
  });
}