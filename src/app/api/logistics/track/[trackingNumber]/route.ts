import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";

/**
 * GET /api/logistics/track/[trackingNumber]
 * Fetch shipment tracking details from logistics provider and sync to database.
 */
export async function GET(
  req: Request,
  context: { params: { trackingNumber: string } }
) {
  const trackingNumber = context.params.trackingNumber;

  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  try {
    // Find the shipment record
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingCode: trackingNumber },
          { tracking_number: trackingNumber },
          { externalId: trackingNumber },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            sellerId: true,
            buyerId: true,
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Verify authorized user: must be the buyer, seller, or an admin
    const userId = guard.session.sub;
    const isSeller = shipment.order.sellerId === userId;
    const isBuyer = shipment.order.buyerId === userId;
    const isAdmin = guard.session.role === "admin"; // Check if role exists or fall back to flag checks

    if (!isSeller && !isBuyer && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized access to tracking" }, { status: 403 });
    }

    const logistics = getLogisticsService();

    // Query active status updates from the courier provider
    let updates = [];
    try {
      updates = await logistics.getTracking({
        provider: shipment.provider as any,
        externalId: shipment.externalId,
        trackingCode: shipment.trackingCode,
      });
    } catch (apiErr) {
      console.warn(`[Logistics Tracking API] Error fetching from provider ${shipment.provider}:`, apiErr);
      // Fallback: If API call fails, return cached database tracking history if available
      if (shipment.tracking_history) {
        try {
          updates = JSON.parse(shipment.tracking_history);
        } catch (_) {}
      }
    }

    // If we fetched new updates, sync them to database
    if (updates && updates.length > 0) {
      // Find latest update status
      const latestUpdate = updates[updates.length - 1];
      const newStatus = latestUpdate.status.toUpperCase(); // e.g. "IN_TRANSIT"

      // Sync status and history
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: newStatus,
          shipment_status: latestUpdate.rawStatus || newStatus,
          lastSyncedAt: new Date(),
          tracking_history: JSON.stringify(updates),
          estimatedDeliveryAt: latestUpdate.estimatedDelivery || shipment.estimatedDeliveryAt,
          eta: latestUpdate.estimatedDelivery || shipment.eta,
        },
      });

      // Update Order model as well if delivered or failed
      if (newStatus === "DELIVERED" || newStatus === "FAILED" || newStatus === "CANCELLED") {
        const orderStatus = newStatus === "DELIVERED" ? "COMPLETED" : newStatus;
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            status: orderStatus,
            completedAt: newStatus === "DELIVERED" ? new Date() : undefined,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      provider: shipment.provider,
      trackingCode: shipment.trackingCode,
      courierName: shipment.courier,
      status: shipment.status,
      lastSyncedAt: shipment.lastSyncedAt,
      updates: updates || [],
    });
  } catch (err) {
    console.error("[Tracking Endpoint] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve tracking details" },
      { status: 500 },
    );
  }
}
