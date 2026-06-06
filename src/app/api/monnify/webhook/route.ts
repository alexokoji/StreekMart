import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PromotionStatus } from "@/lib/enums";
import { verifyWebhookHash } from "@/lib/monnify";
import { cancelPendingOrders, finalizePaidOrders } from "@/lib/orders";
import { notifyAdminsOfPromotionReview } from "@/lib/adminNotifications";
import { markDesignPaid } from "@/app/api/preorders/route";
import { markDeliveryPaid } from "@/app/api/preorders/[id]/pay-delivery/route";

// `node:crypto` (used by verifyWebhookHash) is unavailable on the Edge
// runtime, so pin this route to Node.
export const runtime = "nodejs";

// POST /api/monnify/webhook
//
// Monnify dashboard → Notification URL → this endpoint. Configure the
// webhook hash secret in MONNIFY_WEBHOOK_HASH; Monnify signs each delivery
// with HMAC-SHA512 over the raw body and sends it as `monnify-signature`.
//
// We currently handle:
//   SUCCESSFUL_TRANSACTION   — buyer paid → finalise the order group.
//   FAILED_TRANSACTION       — buyer abandoned → cancel pending orders.
//   SUCCESSFUL_DISBURSEMENT  — payout reached the bank → mark PayoutRequest PAID.
//   FAILED_DISBURSEMENT      — payout bounced → mark PayoutRequest FAILED.
//
// Anything else is acknowledged with 200 so Monnify stops retrying, but we
// log the event for diagnostics.

export async function POST(req: Request) {
  // We need the *raw* body for signature verification — once parsed by
  // .json() the whitespace is lost and the HMAC won't match.
  const raw = await req.text();
  const sig =
    req.headers.get("monnify-signature") ??
    req.headers.get("transaction-hash") ??
    "";

  if (!verifyWebhookHash(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.eventType ?? event.event;
  const data = event.eventData ?? event.data ?? {};

  switch (eventType) {
    case "SUCCESSFUL_TRANSACTION": {
      const ref = data.paymentReference;
      if (!ref) return NextResponse.json({ ok: true, ignored: "missing paymentReference" });
      // Promotion fees use the `PROMO_<random>` reference prefix — route
      // them to the promotion-review queue instead of the order finaliser.
      if (ref.startsWith("PROMO_")) {
        const updated = await prisma.promotion.updateMany({
          where: { paymentReference: ref, status: PromotionStatus.PENDING_PAYMENT },
          data: {
            status: PromotionStatus.PENDING_REVIEW,
            paymentTxnRef: data.transactionReference ?? null,
            paidAt: new Date(),
          },
        });
        // Ping admins only when the update actually flipped a row — the
        // webhook can fire multiple times for the same reference (Monnify
        // retries on non-2xx) and we don't want a duplicate alert per hit.
        if (updated.count > 0) void notifyAdminsOfPromotionReview(ref);
        return NextResponse.json({ ok: true, promotion: updated.count });
      }
      // Preorder design payment — flips PENDING_PAYMENT → AWAITING_READY
      // and credits the designer wallet (skip-hold for verified designers).
      if (ref.startsWith("PREORDER_DESIGN_")) {
        const preorderId = ref.replace("PREORDER_DESIGN_", "");
        await markDesignPaid(preorderId, ref, data.transactionReference ?? `TX_${ref}`);
        return NextResponse.json({ ok: true, preorder: "design-paid" });
      }
      // Preorder delivery payment — flips READY → AWAITING_SHIPMENT.
      if (ref.startsWith("PREORDER_DELIVERY_")) {
        const preorderId = ref.replace("PREORDER_DELIVERY_", "");
        await markDeliveryPaid(preorderId, ref, data.transactionReference ?? `TX_${ref}`);
        return NextResponse.json({ ok: true, preorder: "delivery-paid" });
      }
      const result = await finalizePaidOrders({
        paymentReference: ref,
        paymentTxnRef: data.transactionReference,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    case "FAILED_TRANSACTION": {
      const ref = data.paymentReference;
      if (!ref) return NextResponse.json({ ok: true, ignored: "missing paymentReference" });
      if (ref.startsWith("PROMO_")) {
        const updated = await prisma.promotion.updateMany({
          where: { paymentReference: ref, status: PromotionStatus.PENDING_PAYMENT },
          data: { status: PromotionStatus.CANCELLED, active: false },
        });
        return NextResponse.json({ ok: true, promotion: updated.count });
      }
      const cancelled = await cancelPendingOrders(ref);
      return NextResponse.json({ ok: true, cancelled });
    }
    case "SUCCESSFUL_DISBURSEMENT": {
      const ref = data.reference;
      if (!ref) return NextResponse.json({ ok: true, ignored: "missing reference" });
      await prisma.payoutRequest.updateMany({
        where: { id: ref, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PAID", externalRef: data.transactionReference ?? null },
      });
      return NextResponse.json({ ok: true });
    }
    case "FAILED_DISBURSEMENT":
    case "REVERSED_DISBURSEMENT": {
      const ref = data.reference;
      if (!ref) return NextResponse.json({ ok: true, ignored: "missing reference" });
      // Refund the wallet if the payout came back. Wallet refund logic lives
      // in the payout route's refundFailedPayout — for webhook-driven failures
      // we just flip the row and let an admin decide the refund.
      await prisma.payoutRequest.updateMany({
        where: { id: ref, status: { in: ["PENDING", "PROCESSING", "PAID"] } },
        data: {
          status: "FAILED",
          failureReason: data.failureReason ?? "Disbursement failed",
        },
      });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ ok: true, ignored: eventType ?? "unknown" });
  }
}

type WebhookEvent = {
  eventType?: string;
  event?: string;
  eventData?: WebhookData;
  data?: WebhookData;
};

type WebhookData = {
  paymentReference?: string;
  transactionReference?: string;
  reference?: string;
  failureReason?: string;
};
