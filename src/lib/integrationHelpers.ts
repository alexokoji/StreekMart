// src/lib/integrationHelpers.ts
/**
 * Helper functions for integrating Sendbox logistics into existing flows.
 * Use these in checkout, seller dashboard, and order pages.
 */

import { prisma } from "@/lib/db";

/**
 * Save shipping rate quotes after fetching from provider.
 * Call this during checkout to snapshot the rates shown to buyer.
 */
export async function saveShippingRateQuotes(args: {
  orderId: string;
  provider: string;
  rates: Array<{
    id: string;
    name: string;
    code: string;
    estimatedDays?: number;
    price: number; // in cents
  }>;
  selectedRateId?: string;
}) {
  const rates = await Promise.all(
    args.rates.map((rate) =>
      prisma.shippingRate.create({
        data: {
          orderId: args.orderId,
          provider: args.provider,
          courierName: rate.name,
          amountCents: rate.price,
          estimatedDays: rate.estimatedDays,
          selected: rate.id === args.selectedRateId,
        },
      }),
    ),
  );

  return rates;
}

/**
 * Get shipping rates for an order (useful for displaying historical quotes).
 */
export async function getOrderShippingRates(orderId: string) {
  return prisma.shippingRate.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get shipment details with all related info.
 */
export async function getShipmentDetails(shipmentId: string) {
  return prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: {
        include: {
          product: { select: { name: true, price: true } },
          buyer: { select: { name: true, email: true, phone: true, city: true } },
          seller: { select: { name: true, businessName: true, phone: true } },
        },
      },
    },
  });
}

/**
 * Get all active shipments for a seller.
 */
export async function getSellerActiveShipments(sellerId: string) {
  return prisma.shipment.findMany({
    where: {
      order: { sellerId },
      status: { not: "DELIVERED" },
    },
    include: {
      order: {
        select: {
          id: true,
          buyerId: true,
          buyer: { select: { name: true } },
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get shipping statistics for admin dashboard.
 */
export async function getShippingStats(args?: { days?: number }) {
  const days = args?.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalShipments, shippedShipments, deliveredShipments, failedShipments, shipmentsByProvider] =
    await Promise.all([
      prisma.shipment.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.shipment.count({
        where: { createdAt: { gte: since }, status: { in: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] } },
      }),
      prisma.shipment.count({
        where: { createdAt: { gte: since }, status: "DELIVERED" },
      }),
      prisma.shipment.count({
        where: { createdAt: { gte: since }, status: "FAILED" },
      }),
      prisma.shipment.groupBy({
        by: ["provider"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

  const successRate =
    totalShipments > 0 ? ((deliveredShipments / totalShipments) * 100).toFixed(2) : "0";

  return {
    total: totalShipments,
    inTransit: shippedShipments,
    delivered: deliveredShipments,
    failed: failedShipments,
    successRate: parseFloat(successRate),
    byProvider: shipmentsByProvider.map((s) => ({
      provider: s.provider,
      count: s._count._all,
    })),
  };
}

/**
 * Get failed deliveries for admin review.
 */
export async function getFailedDeliveries(args?: { limit?: number; offset?: number }) {
  const limit = args?.limit || 50;
  const offset = args?.offset || 0;

  return prisma.shipment.findMany({
    where: { status: "FAILED" },
    include: {
      order: {
        include: {
          buyer: { select: { name: true, email: true, phone: true } },
          seller: { select: { name: true, businessName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Calculate average delivery time.
 */
export async function getAverageDeliveryTime(args?: { provider?: string; days?: number }) {
  const lookbackDays = args?.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const deliveries = await prisma.shipment.findMany({
    where: {
      createdAt: { gte: since },
      status: "DELIVERED",
      provider: args?.provider,
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  if (deliveries.length === 0) return null;

  const totalHours = deliveries.reduce((sum, d) => {
    const hours = (d.updatedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  const averageHours = totalHours / deliveries.length;
  const averageDays = (averageHours / 24).toFixed(2);

  return parseFloat(averageDays);
}

/**
 * Get shipments needing attention (stuck, delayed, etc.).
 */
export async function getProblematicShipments() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return prisma.shipment.findMany({
    where: {
      OR: [
        // Shipments stuck in pending/in-transit for over a week
        {
          status: { in: ["PENDING", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
          createdAt: { lt: oneWeekAgo },
        },
        // Failed shipments not yet resolved
        {
          status: "FAILED",
          updatedAt: { lt: oneWeekAgo },
        },
      ],
    },
    include: {
      order: {
        include: {
          buyer: { select: { name: true, email: true, phone: true } },
          seller: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Record a delivery issue for an order.
 * Creates an OrderUpdate entry so buyer is notified.
 */
export async function recordDeliveryIssue(args: {
  orderId: string;
  issue: string;
  resolvedByUserId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: { sellerId: true },
  });

  if (!order) throw new Error("Order not found");

  return prisma.orderUpdate.create({
    data: {
      orderId: args.orderId,
      kind: "NOTE",
      message: `Delivery issue: ${args.issue}. We're working to resolve this.`,
      createdById: args.resolvedByUserId,
    },
  });
}

/**
 * Mark an order as delivered (manual override if webhook fails).
 */
export async function markOrderDelivered(orderId: string, adminId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { sellerId: true, deliveryFeeCents: true },
  });

  if (!order) throw new Error("Order not found");

  // Update order status
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Update shipment status
  await prisma.shipment.updateMany({
    where: { orderId },
    data: { status: "DELIVERED", updatedAt: new Date() },
  });

  // Record the action
  await prisma.orderUpdate.create({
    data: {
      orderId,
      kind: "STATUS",
      message: "Order marked as delivered (admin override)",
      createdById: adminId,
    },
  });

  return updated;
}
