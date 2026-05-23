import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLogisticsService } from "@/lib/services/logistics";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/webhooks/sendbox
 * Handle Sendbox webhook events for shipment status updates.
 * Verifies webhook signature and updates shipment status in the database.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-sendbox-signature") || "";

  try {
    const logistics = getLogisticsService();

    // Verify webhook signature
    const isValid = logistics.verifyWebhookSignature("SENDBOX", rawBody, signature);
    if (!isValid) {
      console.warn("Invalid Sendbox webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // Map Sendbox event types to internal status
    const statusMap: Record<string, string> = {
      shipment_created: "PENDING",
      shipment_picked_up: "PICKED",
      shipment_in_transit: "IN_TRANSIT",
      shipment_out_for_delivery: "OUT_FOR_DELIVERY",
      shipment_delivered: "DELIVERED",
      shipment_failed: "FAILED",
      shipment_cancelled: "CANCELLED",
    };

    const newStatus = statusMap[event.event_type];
    if (!newStatus) {
      console.warn(`Unknown Sendbox event type: ${event.event_type}`);
      return NextResponse.json({ ok: true }); // Acknowledge but ignore
    }

    // Find shipment by tracking code or external ID
    const shipment = await prisma.shipment.findFirst({
      where: {
        provider: "SENDBOX",
        trackingCode: event.tracking_code || event.shipment_id,
      },
      include: {
        order: {
          include: {
            buyer: { select: { email: true, name: true } },
            seller: { select: { name: true } },
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!shipment) {
      console.warn(`Shipment not found for tracking code: ${event.tracking_code}`);
      return NextResponse.json({ ok: true });
    }

    // Update shipment status
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: newStatus,
        lastSyncedAt: new Date(),
        estimatedDeliveryAt: event.estimated_delivery
          ? new Date(event.estimated_delivery)
          : undefined,
      },
    });

    // Send email notification to buyer on status changes
    const shouldNotify = [
      "PICKED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "FAILED",
    ].includes(newStatus);

    if (shouldNotify && shipment.order.buyer?.email) {
      const messages: Record<string, string> = {
        PICKED: "Your order has been picked up and is on its way!",
        IN_TRANSIT: "Your order is in transit.",
        OUT_FOR_DELIVERY: "Your order is out for delivery today!",
        DELIVERED: "Your order has been delivered!",
        FAILED: "There was an issue delivering your order. Our team will contact you soon.",
      };

      const message = messages[newStatus] || "Your shipment status has been updated.";

      // Fire-and-forget email
      sendEmail({
        to: shipment.order.buyer.email,
        subject: `Order Update: ${shipment.order.id.slice(0, 8)} - ${newStatus}`,
        html: `
          <p>Hi ${shipment.order.buyer.name},</p>
          <p>${message}</p>
          <p>Tracking: ${shipment.trackingCode}</p>
          <p>Thank you for shopping with UpClo!</p>
        `,
      }).catch((err) => {
        console.error("Failed to send shipment update email:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Sendbox webhook error:", err);
    // Acknowledge the webhook even on error so Sendbox doesn't retry
    return NextResponse.json({ ok: true });
  }
}
