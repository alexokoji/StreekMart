// POST /api/korapay/webhook
// Receives payment confirmations from Korapay.
//
// Webhook spec: https://korapay.com/docs
// - Signature header: x-korapay-signature
// - Signature is HMAC-SHA256 of body.data (NOT full body)
// - Secret key: Your KORAPAY_SECRET_KEY (sk_test_ or sk_live_)
// - Setup: Dashboard → Settings → API Configuration → Notification URL

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { finalizePaidOrders } from "@/lib/orders";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-korapay-signature");

    // Verify webhook signature using secret key
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) {
      console.error("[Korapay] KORAPAY_SECRET_KEY not set");
      return NextResponse.json(
        { error: "Secret key not configured" },
        { status: 500 }
      );
    }

    // Korapay signs ONLY the data object, not the full payload
    const hash = crypto
      .createHmac("sha256", secretKey)
      .update(JSON.stringify(body.data))
      .digest("hex");

    if (hash !== signature) {
      console.warn("[Korapay] Webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Extract event and transaction data
    const { event, data } = body;

    // Only process successful charge events
    if (event !== "charge.success") {
      console.log(`[Korapay] Webhook event: ${event}, reference: ${data?.reference}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!data || !data.reference) {
      console.warn("[Korapay] Webhook missing transaction reference");
      return NextResponse.json(
        { error: "Missing reference" },
        { status: 400 }
      );
    }

    const paymentReference = data.reference;

    // Find orders with this payment reference
    const orders = await prisma.order.findMany({
      where: { paymentReference },
    });

    if (!orders.length) {
      console.warn(`[Korapay] No orders found for reference: ${paymentReference}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Update orders with payment gateway info
    await Promise.all(
      orders.map((order) =>
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentGateway: "KORAPAY",
            paymentTxnRef: paymentReference,
          },
        })
      )
    );

    // Finalize paid orders (move to PAID status, credit wallet, etc.)
    await finalizePaidOrders({ paymentReference });

    console.log(`[Korapay] Processed charge.success for reference: ${paymentReference}`);

    // Return 200 immediately to prevent Korapay retries
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Korapay] Webhook error:", error);
    // Return 500 to trigger Korapay retry if processing failed
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}


