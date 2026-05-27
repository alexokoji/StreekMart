import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";
import { getLogisticsService } from "@/lib/services/logistics";

const Body = z.object({
  orderId: z.string(),
  provider: z.enum(["SHIPBUBBLE", "KWIK"]).default("SHIPBUBBLE"),
  courierId: z.string().optional(),
  courierCode: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  description: z.string().optional(),
});

/**
 * POST /api/logistics/create-shipment
 * Create a shipment with a logistics provider.
 * Only sellers can create shipments for their orders.
 */
export async function POST(req: Request) {
  const guard = await requireApiUser(Permission.SELLER);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    // Fetch the order with buyer and seller details. Pull the seller's default
    // PICKUP address (Google-validated) so the Shipbubble pickup leg uses a
    // formatted string the validator accepts.
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: {
        product: { select: { name: true } },
        buyer: { select: { name: true, phone: true, country: true, city: true, region: true } },
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            country: true,
            city: true,
            region: true,
            addresses: {
              where: { kind: "PICKUP", isDefault: true },
              take: 1,
            },
          },
        },
        shipment: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify this seller owns the order
    if (order.sellerId !== guard.session.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if shipment already exists
    if (order.shipment) {
      return NextResponse.json(
        { error: "Shipment already exists for this order" },
        { status: 400 },
      );
    }

    // Validate buyer and seller have required fields
    if (!order.buyer.phone || !order.buyer.city) {
      return NextResponse.json(
        { error: "Buyer location or phone is incomplete" },
        { status: 400 },
      );
    }
    if (!order.seller.phone || !order.seller.city) {
      return NextResponse.json(
        { error: "Seller location or phone is incomplete" },
        { status: 400 },
      );
    }

    const logistics = getLogisticsService();
    const sellerPickup = order.seller.addresses?.[0];
    const buyerFormatted = order.shippingFormattedAddress;

    // Create shipment with provider (features auto-fallback to Kwik if Shipbubble fails)
    const shipmentResult = await logistics.createShipment({
      provider: parsed.data.provider,
      orderId: order.id,
      pickupAddress: {
        name: order.seller.name,
        phone: sellerPickup?.phone || order.seller.phone,
        address:
          sellerPickup?.formattedAddress ||
          `${order.seller.city}, ${order.seller.region || ""}`,
        city: order.seller.city,
        state: order.seller.region || "Lagos",
        country: order.seller.country || "NG",
        formattedAddress: sellerPickup?.formattedAddress,
        placeId: sellerPickup?.placeId ?? undefined,
        latitude: sellerPickup?.latitude ?? undefined,
        longitude: sellerPickup?.longitude ?? undefined,
      },
      deliveryAddress: {
        name: order.buyer.name,
        phone: order.buyer.phone,
        address:
          buyerFormatted ||
          order.shippingAddress ||
          `${order.buyer.city}, ${order.buyer.region || ""}`,
        city: order.buyer.city,
        state: order.buyer.region || "Lagos",
        country: order.buyer.country || "NG",
        formattedAddress: buyerFormatted ?? undefined,
        placeId: order.shippingPlaceId ?? undefined,
        latitude: order.shippingLatitude ?? undefined,
        longitude: order.shippingLongitude ?? undefined,
      },
      courierId: parsed.data.courierId,
      courierCode: parsed.data.courierCode,
      weight: parsed.data.weight,
      dimensions: parsed.data.dimensions,
      description: parsed.data.description || `${order.product.name} (Qty: ${order.quantity})`,
    });

    // Save shipment to database with all requested columns
    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        provider: shipmentResult.finalProvider,
        externalId: shipmentResult.externalId,
        trackingCode: shipmentResult.trackingCode,
        labelUrl: shipmentResult.labelUrl,
        receiptUrl: shipmentResult.receiptUrl,
        estimatedDeliveryAt: shipmentResult.estimatedDelivery,
        senderName: order.seller.name,
        senderPhone: order.seller.phone,
        senderAddress: order.seller.city,
        recipientName: order.buyer.name,
        recipientPhone: order.buyer.phone,
        recipientAddress: order.shippingAddress,
        status: "PENDING",
        shippingFeeCents: shipmentResult.shippingFeeCents || 0,

        // New database updates columns
        courier: shipmentResult.courierName || parsed.data.courierCode || "Standard",
        courier_id: shipmentResult.courierId || parsed.data.courierId || "",
        tracking_number: shipmentResult.trackingCode,
        request_token: shipmentResult.requestToken || "",
        shipping_fee: shipmentResult.shippingFeeCents ? shipmentResult.shippingFeeCents / 100 : 0,
        eta: shipmentResult.estimatedDelivery,
        shipment_status: "PENDING",
        tracking_history: JSON.stringify([
          {
            status: "pending",
            lastUpdate: new Date(),
            message: "Shipment record created in system.",
          },
        ]),
      },
    });

    // Update order with tracking info and provider
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingCode: shipmentResult.trackingCode,
        logisticsProvider: shipmentResult.finalProvider,
        status: "SHIPPED",
      },
    });

    // Create an order update notification for the buyer
    await prisma.orderUpdate.create({
      data: {
        orderId: order.id,
        kind: "DISPATCHED",
        message: `Your order has been booked with ${shipment.courier}. Tracking code: ${shipmentResult.trackingCode}`,
        createdById: guard.session.sub,
      },
    });

    return NextResponse.json({
      ok: true,
      shipment: {
        id: shipment.id,
        provider: shipment.provider,
        externalId: shipment.externalId,
        trackingCode: shipment.trackingCode,
        labelUrl: shipment.labelUrl,
        estimatedDelivery: shipment.estimatedDeliveryAt,
        courierName: shipment.courier,
      },
    });
  } catch (err) {
    console.error("[Create Shipment] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create shipment" },
      { status: 500 },
    );
  }
}
