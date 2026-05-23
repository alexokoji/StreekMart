import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";

const Query = z.object({
  orderId: z.string(),
});

/**
 * GET /api/logistics/track?orderId=<orderId>
 * Get tracking information for a shipment.
 * Buyers can track their orders, sellers can track their shipments.
 */
export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { shipment: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify buyer or seller access
    const isBuyer = order.buyerId === guard.session.sub;
    const isSeller = order.sellerId === guard.session.sub;
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!order.shipment) {
      return NextResponse.json({ error: "No shipment found for this order" }, { status: 404 });
    }

    const logistics = getLogisticsService();
    const tracking = await logistics.getTracking({
      provider: order.shipment.provider as any,
      externalId: order.shipment.externalId,
      trackingCode: order.shipment.trackingCode,
    });

    // Update last synced time
    await prisma.shipment.update({
      where: { id: order.shipment.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      tracking: {
        status: tracking.status,
        lastUpdate: tracking.lastUpdate,
        currentLocation: tracking.currentLocation,
        estimatedDelivery: tracking.estimatedDelivery,
        message: tracking.message,
      },
    });
  } catch (err) {
    console.error("Tracking error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tracking" },
      { status: 500 },
    );
  }
}
