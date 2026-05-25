// POST /api/orders/[id]/shipping
// Sellers create a shipment for an order and get tracking code + label.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { createJumiaProvider } from "@/lib/logisticsProviders/jumia";
import { getSendboxProvider } from "@/lib/providers/sendbox";

const CreateShipmentBody = z.object({
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  specialHandling: z.string().optional(),
});

export async function POST(req: Request, context: { params: { id: string } }) {
  const orderId = context.params.id;
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = CreateShipmentBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Fetch order and verify seller ownership
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { name: true, phone: true } },
      product: true,
      seller: { select: { sellerVerified: true, businessName: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.sellerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Check if shipment already exists
  const existing = await prisma.shipment.findFirst({
    where: { orderId },
  });

  if (existing) {
    return NextResponse.json({ error: "Shipment already created for this order" }, { status: 400 });
  }

  // Check order status is PAID or SHIPPED
  if (order.status !== "PAID" && order.status !== "SHIPPED") {
    return NextResponse.json(
      { error: `Cannot create shipment for order with status ${order.status}` },
      { status: 400 }
    );
  }

  if (!order.shippingAddress) {
    return NextResponse.json({ error: "Order missing shipping address" }, { status: 400 });
  }

  try {
    const useTrustedCourier = order.seller?.sellerVerified === true;
    const provider = useTrustedCourier ? createJumiaProvider() : getSendboxProvider();
    const shipmentResult = await provider.createShipment({
      orderId,
      recipientName: order.buyer.name,
      recipientPhone: order.buyer.phone || "",
      recipientAddress: order.shippingAddress,
      weight: parsed.data.weight,
      dimensions: parsed.data.dimensions,
      description: order.product.name,
      specialHandling: parsed.data.specialHandling,
    });

    // Save shipment to database
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        provider: provider.getName(),
        externalId: shipmentResult.externalId,
        trackingCode: shipmentResult.trackingCode,
        labelUrl: shipmentResult.labelUrl,
        receiptUrl: shipmentResult.receiptUrl,
        status: "PENDING",
      },
    });

    // Update order with tracking code and move to SHIPPED
    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: shipmentResult.trackingCode,
        logisticsProvider: provider.getName(),
        status: "SHIPPED",
        updatedAt: new Date(),
      },
    });

    // Create an order update notification for the buyer
    await prisma.orderUpdate.create({
      data: {
        orderId,
        kind: "DISPATCHED",
        message: `Your order is on the way! Track it with code: ${shipmentResult.trackingCode}`,
        createdById: guard.session.sub,
      },
    });

    return NextResponse.json({
      ok: true,
      shipment: {
        id: shipment.id,
        trackingCode: shipment.trackingCode,
        labelUrl: shipment.labelUrl,
        receiptUrl: shipment.receiptUrl,
      },
    });
  } catch (error: any) {
    console.error("[Shipping] Error creating shipment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create shipment" },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/shipping
// Retrieve shipment details for an order
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
    return NextResponse.json({ shipment: null });
  }

  return NextResponse.json({ shipment });
}
