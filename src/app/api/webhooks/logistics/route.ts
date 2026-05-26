import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLogisticsService } from "@/lib/services/logistics";
import { sendEmail } from "@/lib/email";

type LogisticsWebhookStatus =
  | "PENDING"
  | "PICKED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

/**
 * POST /api/webhooks/logistics
 * Unified webhook handler for both Shipbubble and Kwik Delivery status updates.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  // Detect provider from query param or header signatures
  const { searchParams } = new URL(req.url);
  let provider: "SHIPBUBBLE" | "KWIK" = "SHIPBUBBLE";
  let signature = "";

  const queryProvider = searchParams.get("provider")?.toUpperCase();
  if (queryProvider === "SHIPBUBBLE" || queryProvider === "KWIK") {
    provider = queryProvider;
    signature = req.headers.get(provider === "SHIPBUBBLE" ? "x-shipbubble-signature" : "x-kwik-signature") || "";
  } else if (req.headers.has("x-shipbubble-signature")) {
    provider = "SHIPBUBBLE";
    signature = req.headers.get("x-shipbubble-signature") || "";
  } else if (req.headers.has("x-kwik-signature")) {
    provider = "KWIK";
    signature = req.headers.get("x-kwik-signature") || "";
  } else {
    // Check if x-signature is present
    signature = req.headers.get("x-signature") || "";
  }

  try {
    const logistics = getLogisticsService();

    // Verify signature
    const isValid = logistics.verifyWebhookSignature(provider, rawBody, signature);
    if (!isValid) {
      console.warn(`[Webhook] Invalid signature received for provider: ${provider}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log(`[Webhook] Payload parsed successfully for provider: ${provider}`, event);

    let trackingCode = "";
    let externalId = "";
    let statusText = "";
    let messageText = "";
    let locationText = "";
    let etaVal: string | undefined = undefined;

    // Map provider status events to internal status
    let internalStatus: LogisticsWebhookStatus = "PENDING";

    if (provider === "SHIPBUBBLE") {
      const type = event.event_type || event.event || "";
      trackingCode = event.tracking_code || event.waybill || "";
      externalId = event.shipment_id || event.id || "";
      statusText = type;
      messageText = event.message || event.description || `Shipbubble event: ${type}`;
      locationText = event.current_location || "";
      etaVal = event.estimated_delivery;

      const shipbubbleMap: Record<string, LogisticsWebhookStatus> = {
        shipment_created: "PENDING",
        created: "PENDING",
        shipment_picked_up: "PICKED",
        picked_up: "PICKED",
        shipment_in_transit: "IN_TRANSIT",
        in_transit: "IN_TRANSIT",
        shipment_out_for_delivery: "OUT_FOR_DELIVERY",
        out_for_delivery: "OUT_FOR_DELIVERY",
        shipment_delivered: "DELIVERED",
        delivered: "DELIVERED",
        shipment_failed: "FAILED",
        failed: "FAILED",
        shipment_cancelled: "CANCELLED",
        cancelled: "CANCELLED",
      };
      internalStatus = shipbubbleMap[type.toLowerCase()] || "IN_TRANSIT";
    } else {
      // KWIK Delivery
      const type = event.event || event.status || "";
      externalId = event.task_id || event.id || "";
      trackingCode = event.tracking_number || event.tracking_code || `KWIK-${externalId}`;
      statusText = type;
      messageText = event.message || event.description || `Kwik event: ${type}`;
      locationText = event.current_location || "";

      const kwikMap: Record<string, LogisticsWebhookStatus> = {
        task_assigned: "PENDING",
        assigned: "PENDING",
        accepted: "PENDING",
        task_started: "PICKED",
        started: "PICKED",
        arrived_at_pickup: "PICKED",
        picked_up: "PICKED",
        in_transit: "IN_TRANSIT",
        arrived_at_delivery: "OUT_FOR_DELIVERY",
        out_for_delivery: "OUT_FOR_DELIVERY",
        task_delivered: "DELIVERED",
        delivered: "DELIVERED",
        task_cancelled: "CANCELLED",
        cancelled: "CANCELLED",
        failed: "FAILED",
      };
      internalStatus = kwikMap[type.toLowerCase()] || "IN_TRANSIT";
    }

    // Find the shipment record
    const shipment = await prisma.shipment.findFirst({
      where: {
        provider,
        OR: [
          ...(trackingCode ? [{ trackingCode }] : []),
          ...(externalId ? [{ externalId }] : []),
        ],
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
      console.warn(`[Webhook] Shipment record not found for query parameters: trackingCode=${trackingCode}, externalId=${externalId}`);
      return NextResponse.json({ ok: true }); // Acknowledge so provider doesn't keep retrying
    }

    // Process new tracking updates history list
    let history: any[] = [];
    if (shipment.tracking_history) {
      try {
        history = JSON.parse(shipment.tracking_history);
      } catch (_) {
        history = [];
      }
    }

    // Append the new status update
    history.push({
      status: internalStatus.toLowerCase(),
      lastUpdate: new Date(),
      currentLocation: locationText,
      message: messageText,
      rawStatus: statusText,
    });

    // Update shipment details in database
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: internalStatus,
        shipment_status: statusText,
        lastSyncedAt: new Date(),
        tracking_history: JSON.stringify(history),
        estimatedDeliveryAt: etaVal ? new Date(etaVal) : shipment.estimatedDeliveryAt,
        eta: etaVal ? new Date(etaVal) : shipment.eta,
      },
    });

    // Sync status change to Order model if state change warrants it
    const orderStatusMap: Record<string, string> = {
      DELIVERED: "COMPLETED",
      FAILED: "CANCELLED",
      CANCELLED: "CANCELLED",
    };

    if (orderStatusMap[internalStatus]) {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: {
          status: orderStatusMap[internalStatus],
          completedAt: internalStatus === "DELIVERED" ? new Date() : undefined,
        },
      });
    }

    // Create an order update log entry
    await prisma.orderUpdate.create({
      data: {
        orderId: shipment.orderId,
        kind: internalStatus === "DELIVERED" ? "STATUS" : "ARRIVING",
        message: messageText,
        createdById: "SYSTEM", // SYSTEM generated webhook update
      },
    });

    // Notify buyer on important transit steps via email
    const shouldNotify = ["PICKED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(internalStatus);

    if (shouldNotify && shipment.order.buyer?.email) {
      const emailMessages: Record<string, string> = {
        PICKED: `Your order "${shipment.order.product.name}" has been picked up by the courier!`,
        IN_TRANSIT: `Your order "${shipment.order.product.name}" is now in transit.`,
        OUT_FOR_DELIVERY: `Your order "${shipment.order.product.name}" is out for delivery today!`,
        DELIVERED: `Your order "${shipment.order.product.name}" has been successfully delivered!`,
        FAILED: `We encountered an issue while delivering your order "${shipment.order.product.name}". The courier will contact you soon.`,
      };

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Order Update Notification</h2>
          <p>Hi ${shipment.order.buyer.name},</p>
          <p>${emailMessages[internalStatus] || "Your shipment status has been updated."}</p>
          <hr />
          <p><strong>Courier:</strong> ${shipment.courier || provider}</p>
          <p><strong>Tracking Number:</strong> ${shipment.trackingCode}</p>
          <p><strong>Status:</strong> ${internalStatus}</p>
          <p><strong>Last Message:</strong> ${messageText}</p>
          <hr />
          <p>Thank you for shopping with UpClo!</p>
        </div>
      `;

      sendEmail({
        to: shipment.order.buyer.email,
        subject: `UpClo Order Update [${shipment.orderId.slice(0, 8)}]: ${internalStatus}`,
        html: htmlContent,
      }).catch((err) => {
        console.error("[Webhook Email Notification] Failed to send email:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Logistics Webhook Handler] Error:", err);
    // Acknowledge anyway so the courier doesn't spam retries
    return NextResponse.json({ ok: true });
  }
}
