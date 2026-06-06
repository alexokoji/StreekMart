import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getGatewaySelector } from "@/lib/gatewaySelector";
import { PreorderStatus } from "@/lib/preorders";

// POST /api/preorders/[id]/pay-delivery { addressLine, feeCents }
//
// Buyer-only. Initialises the SECOND payment — the delivery fee — once
// the designer has marked the piece READY. The webhook flips status to
// AWAITING_SHIPMENT when the payment clears.
//
// For V1 we accept the fee as part of the request body and trust the
// quote that came out of the rates UI on the page. Future hardening:
// re-quote against Shipbubble server-side here so a fiddled fee can't
// land a discounted shipment.

const Body = z.object({
  shippingAddress: z.string().trim().min(8).max(500),
  shippingFormattedAddress: z.string().trim().max(500).optional(),
  shippingLatitude: z.number().optional(),
  shippingLongitude: z.number().optional(),
  shippingPlaceId: z.string().trim().max(500).optional(),
  feeCents: z.number().int().positive().max(1_000_000_000),
});

function buildRedirectUrl(req: Request, preorderId: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/account/preorders/${preorderId}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const preorder = await prisma.preorder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      post: { select: { title: true } },
    },
  });
  if (!preorder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (preorder.buyerId !== guard.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (preorder.status !== PreorderStatus.READY) {
    return NextResponse.json(
      { error: "The designer hasn't marked this ready yet." },
      { status: 400 },
    );
  }

  const ref = `PREORDER_DELIVERY_${preorder.id}`;

  // Persist the address + fee snapshot up front so a payment retry doesn't
  // lose the buyer's typed address.
  await prisma.preorder.update({
    where: { id: preorder.id },
    data: {
      shippingAddress: parsed.data.shippingAddress,
      shippingFormattedAddress: parsed.data.shippingFormattedAddress,
      shippingLatitude: parsed.data.shippingLatitude,
      shippingLongitude: parsed.data.shippingLongitude,
      shippingPlaceId: parsed.data.shippingPlaceId,
      deliveryFeeCents: parsed.data.feeCents,
      deliveryPaymentRef: ref,
    },
  });

  const gateway = getGatewaySelector();
  try {
    const init = await gateway.initCheckout({
      amountCents: parsed.data.feeCents,
      customerEmail: preorder.buyer.email,
      customerName: preorder.buyer.name,
      description: `Preorder delivery · ${preorder.post?.title?.slice(0, 50) ?? "design"}`,
      paymentReference: ref,
      redirectUrl: buildRedirectUrl(req, preorder.id),
    });

    if (gateway.isStubMode()) {
      await markDeliveryPaid(preorder.id, ref, `STUB_${ref}`);
      return NextResponse.json({
        checkoutUrl: buildRedirectUrl(req, preorder.id),
        stub: true,
      });
    }

    return NextResponse.json({ checkoutUrl: init.checkoutUrl });
  } catch (err) {
    console.error("[preorder:pay-delivery] gateway failed", { err });
    return NextResponse.json(
      { error: "Couldn't start delivery payment. Try again in a minute." },
      { status: 502 },
    );
  }
}

// Exported so the webhook + stub-confirm can call the same code path.
export async function markDeliveryPaid(
  preorderId: string,
  paymentRef: string,
  txnRef: string,
): Promise<void> {
  const p = await prisma.preorder.findUnique({
    where: { id: preorderId },
    include: {
      designer: { select: { id: true, name: true, email: true } },
      buyer: { select: { id: true, name: true, email: true } },
      post: { select: { title: true } },
    },
  });
  if (!p) return;
  if (p.status !== PreorderStatus.READY) return;

  await prisma.preorder.update({
    where: { id: p.id },
    data: {
      status: PreorderStatus.AWAITING_SHIPMENT,
      deliveryPaymentRef: paymentRef,
      deliveryPaymentTxnRef: txnRef,
      deliveryPaidAt: new Date(),
    },
  });

  // Lazy-import the notification helpers to keep the module graph tight.
  const { sendPush } = await import("@/lib/notifications");
  const { sendEmail } = await import("@/lib/email");

  void sendPush({
    userId: p.designerId,
    title: "Delivery paid — ship the piece",
    body: `${p.buyer.name}'s preorder of "${p.post?.title ?? "the design"}" is ready to ship.`,
    link: `/designer/preorders/${p.id}`,
    data: { type: "preorder-delivery-paid", preorderId: p.id },
  }).catch(() => {});
  void sendEmail({
    to: p.designer.email,
    subject: "Preorder delivery paid — time to ship",
    html: `<p>Hi ${p.designer.name},</p><p>The buyer paid delivery for the preorder. Open your dashboard, add a tracking code, and we'll send the delivery code to the buyer.</p>`,
    text: "Delivery paid. Ship the piece.",
  }).catch(() => {});
}
