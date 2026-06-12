import { NextResponse } from "next/server";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";

// GET /api/dashboard/admin -- compact platform overview for the mobile
// admin dashboard. Returns headline KPIs plus the count of items in each
// triage queue so the admin can spot pending workload from the lock
// screen of their phone.
export async function GET() {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    sellerCount,
    designerCount,
    productCount,
    activeProducts,
    activeOrders,
    completedOrders,
    pendingVerifications,
    pendingPayouts,
    pendingPromotions,
    pendingRoleChanges,
    pendingBusinessNames,
    salesLast30d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isSeller: true } }),
    prisma.user.count({ where: { isDesigner: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.order.count({
      where: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED] } },
    }),
    prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.payoutRequest.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }).catch(() => 0),
    prisma.promotion.count({ where: { status: "PENDING_REVIEW" } }).catch(() => 0),
    prisma.roleChangeRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.businessNameChangeRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.order
      .aggregate({
        where: { status: OrderStatus.COMPLETED, completedAt: { gte: since30d } },
        _sum: { totalPrice: true },
      })
      .catch(() => ({ _sum: { totalPrice: 0 } })),
  ]);

  return NextResponse.json({
    stats: {
      userCount,
      sellerCount,
      designerCount,
      productCount,
      activeProducts,
      activeOrders,
      completedOrders,
      salesLast30dCents: salesLast30d._sum.totalPrice ?? 0,
    },
    queues: {
      pendingVerifications,
      pendingPayouts,
      pendingPromotions,
      pendingRoleChanges,
      pendingBusinessNames,
    },
  });
}