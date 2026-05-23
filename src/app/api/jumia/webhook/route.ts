// POST /api/jumia/webhook
// Receives tracking updates from Jumia Logistics.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createJumiaProvider } from "@/lib/logisticsProviders/jumia";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headerSignature = req.headers.get("x-jumia-signature") || "";

    // Verify webhook signature
    const provider = createJumiaProvider();
    if (!provider.verifyWebhookSignature?.(rawBody, headerSignature)) {
      console.warn("[Jumia] Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { shipment_id, status, current_location, estimated_delivery, message } = body;

    if (!shipment_id) {
      return NextResponse.json({ error: "Missing shipment_id" }, { status: 400 });
    }

    // Find shipment and update status
    const shipment = await prisma.shipment.findFirst({
      where: { externalId: shipment_id },
    });

    if (!shipment) {
      console.warn(`[Jumia] No shipment found for externalId: ${shipment_id}`);
      return NextResponse.json({ status: "ok" });
    }

    // Map status and update
    const mappedStatus = mapJumiaStatus(status);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: mappedStatus,
        lastSyncedAt: new Date(),
      },
    });

    // If delivered, mark order as COMPLETED
    if (mappedStatus === "DELIVERED") {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Create order update notification
      await prisma.orderUpdate.create({
        data: {
          orderId: shipment.orderId,
          kind: "STATUS",
          message: "Your order has been delivered!",
          createdById: "system",
        },
      });
    }

    // Create order update for tracking change
    if (current_location || message) {
      await prisma.orderUpdate.create({
        data: {
          orderId: shipment.orderId,
          kind: "NOTE",
          message: message || `Package at ${current_location}`,
          createdById: "system",
        },
      });
    }

    console.log(`[Jumia] Processed tracking update for shipment: ${shipment_id}, status: ${mappedStatus}`);
    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("[Jumia] Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function mapJumiaStatus(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case "pending":
      return "PENDING";
    case "picked":
    case "picked_up":
      return "PICKED";
    case "in_transit":
    case "in_delivery":
      return "IN_TRANSIT";
    case "delivered":
      return "DELIVERED";
    case "failed":
    case "cancelled":
      return "FAILED";
    default:
      return "PENDING";
  }
}
