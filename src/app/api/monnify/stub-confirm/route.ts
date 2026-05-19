import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PromotionStatus } from "@/lib/enums";
import { isLiveMode } from "@/lib/monnify";
import { finalizePaidOrders, cancelPendingOrders } from "@/lib/orders";

// POST /api/monnify/stub-confirm { paymentReference, outcome }
//
// Dev-only helper for the stub Monnify mode. The stub `initTransaction` mints
// a checkoutUrl that lands buyers on /cart/checkout/return, which (in stub
// mode) auto-finalises by calling this endpoint. Lets us exercise the full
// init → redirect → webhook → finalise pipeline without real Monnify keys.
//
// In live mode this endpoint is a no-op so a stray client cannot bypass the
// real gateway by hand-crafting a request.

const Body = z.object({
  paymentReference: z.string().min(4).max(120),
  outcome: z.enum(["paid", "failed"]).default("paid"),
});

export async function POST(req: Request) {
  if (isLiveMode()) {
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
    return NextResponse.json({ ok: true, promotion: updated.count });
  }

  const result = await finalizePaidOrders({
    paymentReference: ref,
    paymentTxnRef: `STUB_${ref}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
