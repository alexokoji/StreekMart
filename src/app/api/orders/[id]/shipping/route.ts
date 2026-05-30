// POST /api/orders/[id]/shipping
// Sellers create a shipment for an order and get tracking code + label.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";
import { sendPush } from "@/lib/notifications";

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
      buyer: { select: { name: true, phone: true, email: true, country: true, city: true, region: true } },
      product: true,
      seller: { select: { id: true, name: true, phone: true, country: true, city: true, region: true, businessName: true, sellerVerified: true } },
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
    // If delivery is within seller's city the seller delivers themselves —
    // create a local shipment record without calling external provider.
    if (order.deliveryZone === "WITHIN_CITY") {
      const shipment = await prisma.shipment.create({
        data: {
          orderId,
          provider: "LOCAL_SELLER",
          externalId: `LOCAL-${Date.now()}`,
          trackingCode: "",
          courierName: null,
          labelUrl: null,
          receiptUrl: null,
          status: "PENDING",
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          logisticsProvider: "LOCAL_SELLER",
          status: "SHIPPED",
          updatedAt: new Date(),
        },
      });

      await prisma.orderUpdate.create({
        data: {
          orderId,
          kind: "DISPATCHED",
          message: `Seller will deliver within city`,
          createdById: guard.session.sub,
        },
      });

      // In-city delivery → push the buyer that the seller's on the way.
      void sendPush({
        userId: order.buyerId,
        title: "📦 Your order is on the way",
        body: `${order.product.name} · seller delivering within city`,
        link: `/account/orders/${orderId}`,
        data: { type: "order-shipped", orderId },
      }).catch((err) =>
        console.error("[push:order-shipped] threw", { orderId, err }),
      );

      return NextResponse.json({ ok: true, shipment: { id: shipment.id } });
    }

    const logistics = getLogisticsService();
    const shipmentResult = await logistics.createShipment({
      orderId,
      pickupAddress: {
        name: order.seller.name || order.seller.businessName || "Seller",
        phone: order.seller.phone || "",
        address: `${order.seller.city || ""}, ${order.seller.region || ""}`,
        city: order.seller.city || "",
        state: order.seller.region || "Lagos",
        country: order.seller.country || "NG",
      },
      deliveryAddress: {
        name: order.buyer.name,
        phone: order.buyer.phone || "",
        address: order.shippingAddress,
        city: order.buyer.city || "",
        state: order.buyer.region || "Lagos",
        country: order.buyer.country || "NG",
      },
      weight: parsed.data.weight,
      dimensions: parsed.data.dimensions,
      description: order.product.name,
    });

    // Save shipment to database with all requested columns
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        provider: shipmentResult.finalProvider,
        externalId: shipmentResult.externalId,
        trackingCode: shipmentResult.trackingCode,
        labelUrl: shipmentResult.labelUrl,
        receiptUrl: shipmentResult.receiptUrl,
        estimatedDeliveryAt: shipmentResult.estimatedDelivery,
        senderName: order.seller.name || order.seller.businessName,
        senderPhone: order.seller.phone,
        senderAddress: order.seller.city,
        recipientName: order.buyer.name,
        recipientPhone: order.buyer.phone,
        recipientAddress: order.shippingAddress,
        status: "PENDING",
        shippingFeeCents: shipmentResult.shippingFeeCents || 0,

        // New database updates columns
        courier: shipmentResult.courierName || "Standard",
        courier_id: shipmentResult.courierId || "",
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

    // Update order with tracking code and move to SHIPPED
    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: shipmentResult.trackingCode,
        logisticsProvider: shipmentResult.finalProvider,
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

    // Push the buyer too — this path skips the /updates endpoint that
    // would normally fan the push out, so we send directly here.
    void sendPush({
      userId: order.buyerId,
      title: "📦 Your order is on the way",
      body: `${order.product.name} · tracking ${shipmentResult.trackingCode}`,
      link: `/account/orders/${orderId}`,
      data: {
        type: "order-shipped",
        orderId,
        trackingCode: shipmentResult.trackingCode,
      },
    }).catch((err) =>
      console.error("[push:order-shipped] threw", { orderId, err }),
    );

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
