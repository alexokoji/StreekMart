import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";
import { getLogisticsService } from "@/lib/services/logistics";

const Body = z.object({
  orderId: z.string(),
  provider: z.enum(["SENDBOX", "JUMIA", "DELLYMAN"]).default("SENDBOX"),
  courierCode: z.string().optional(),
});

/**
 * POST /api/logistics/create
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
    // Fetch the order with buyer details
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: {
        product: { select: { name: true } },
        buyer: { select: { name: true, phone: true, country: true, city: true } },
        seller: { select: { id: true, name: true, phone: true, country: true, city: true } },
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

    // Create shipment with provider
    const shipmentResult = await logistics.createShipment({
      provider: parsed.data.provider as any,
      orderId: order.id,
      recipientName: order.buyer.name,
      recipientPhone: order.buyer.phone,
      recipientAddress: order.shippingAddress || order.buyer.city,
      weight: 1, // Default 1kg for fashion items
      description: `${order.product.name} (Qty: ${order.quantity})`,
    });

    // Save shipment to database
    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        provider: parsed.data.provider,
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
      },
    });

    // Update order with tracking info and provider
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingCode: shipmentResult.trackingCode,
        logisticsProvider: parsed.data.provider,
        status: "SHIPPED",
      },
    });

    return NextResponse.json({
      ok: true,
      shipment: {
        id: shipment.id,
        externalId: shipment.externalId,
        trackingCode: shipment.trackingCode,
        labelUrl: shipment.labelUrl,
        estimatedDelivery: shipment.estimatedDeliveryAt,
      },
    });
  } catch (err) {
    console.error("Create shipment error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create shipment" },
      { status: 500 },
    );
  }
}
