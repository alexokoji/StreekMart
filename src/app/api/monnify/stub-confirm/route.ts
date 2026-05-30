import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PromotionStatus } from "@/lib/enums";
import { getGatewaySelector } from "@/lib/gatewaySelector";
import { finalizePaidOrders, cancelPendingOrders } from "@/lib/orders";
import { notifyAdminsOfPromotionReview } from "@/lib/adminNotifications";

// POST /api/monnify/stub-confirm { paymentReference, outcome }
//
// Dev-only helper for stub mode. When the payment gateway is in stub mode,
// the checkout flow lands buyers on /cart/checkout/return, which can call
// this endpoint to simulate payment confirmation. Lets us exercise the full
// init → redirect → webhook → finalise pipeline without real gateway keys.
//
// In live mode this endpoint is a no-op so a stray client cannot bypass the
// real gateway by hand-crafting a request.

const Body = z.object({
  paymentReference: z.string().min(4).max(120),
  outcome: z.enum(["paid", "failed"]).default("paid"),
});

export async function POST(req: Request) {
  const gateway = getGatewaySelector();
  if (!gateway.isStubMode()) {
    return NextResponse.json({ error: "Disabled in live mode." }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ref = parsed.data.paymentReference;

  if (parsed.data.outcome === "failed") {
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

  if (ref.startsWith("PROMO_")) {
    const updated = await prisma.promotion.updateMany({
      where: { paymentReference: ref, status: PromotionStatus.PENDING_PAYMENT },
      data: {
        status: PromotionStatus.PENDING_REVIEW,
        paymentTxnRef: `STUB_${ref}`,
        paidAt: new Date(),
      },
    });
    if (updated.count > 0) void notifyAdminsOfPromotionReview(ref);
    return NextResponse.json({ ok: true, promotion: updated.count });
  }

  const result = await finalizePaidOrders({
    paymentReference: ref,
    paymentTxnRef: `STUB_${ref}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
