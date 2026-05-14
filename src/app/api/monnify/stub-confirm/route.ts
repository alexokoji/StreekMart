import { NextResponse } from "next/server";
import { z } from "zod";
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

  if (parsed.data.outcome === "failed") {
    const cancelled = await cancelPendingOrders(parsed.data.paymentReference);
    return NextResponse.json({ ok: true, cancelled });
  }
  const result = await finalizePaidOrders({
    paymentReference: parsed.data.paymentReference,
    paymentTxnRef: `STUB_${parsed.data.paymentReference}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
