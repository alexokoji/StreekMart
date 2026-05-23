// GET /api/orders/[id]/tracking
// Fetch live tracking updates for an order's shipment.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { createJumiaProvider } from "@/lib/logisticsProviders/jumia";

export async function GET(req: Request, context: { params: { id: string } }) {
  const orderId = context.params.id;
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Check access: seller or buyer
  if (order.sellerId !== guard.session.sub && order.buyerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
  });

  if (!shipment) {
    return NextResponse.json({ tracking: null });
  }

  try {
    // Fetch live tracking from Jumia
    const provider = createJumiaProvider();
    const tracking = await provider.getTracking({
      externalId: shipment.externalId,
      trackingCode: shipment.trackingCode,
    });

    // Update shipment status and sync time
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: tracking.status.toUpperCase(),
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      tracking: {
        status: tracking.status,
        lastUpdate: tracking.lastUpdate,
        currentLocation: tracking.currentLocation,
        estimatedDelivery: tracking.estimatedDelivery,
        message: tracking.message,
        labelUrl: tracking.labelUrl,
      },
    });
  } catch (error: any) {
    console.error("[Tracking] Error fetching tracking:", error);

    // Return cached shipment data if live fetch fails
    return NextResponse.json({
      ok: true,
      tracking: {
        status: shipment.status.toLowerCase(),
        lastUpdate: shipment.updatedAt,
        labelUrl: shipment.labelUrl,
        cached: true,
      },
    });
  }
}
