import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { deliveryCodesMatch } from "@/lib/deliveryCode";
import { releaseHeldFundsForOrder } from "@/lib/wallet";
import { sendPush } from "@/lib/notifications";

// POST /api/orders/[id]/confirm-by-code  { code }
//
// Dispatch riders confirm delivery here. The endpoint is intentionally
// unauthenticated — the rider doesn't have an UpClo account and only knows
// the order id (printed on the packing slip / shared by the seller) and the
// 4-char code (told by the buyer at the door).
//
// Security:
//   - Code is a 29-char alphabet × 4 positions ≈ 707k combinations per order.
//   - Constant-time compare blocks timing-based brute force (see deliveryCode.ts).
//   - We rate-limit by failing-attempts via a count on Order to be added if
//     needed; for V1 the code uniqueness + the COMPLETED guard are enough.
//   - Status guards: only PAID / SHIPPED orders are confirmable; COMPLETED /
//     CANCELLED return 409.

const Body = z.object({
  code: z.string().min(4).max(4),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A 4-character code is required." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === OrderStatus.COMPLETED) {
    return NextResponse.json({ error: "This order is already marked delivered." }, { status: 409 });
  }
  if (order.status === OrderStatus.CANCELLED) {
    return NextResponse.json({ error: "This order was cancelled." }, { status: 409 });
  }
  if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.SHIPPED) {
    return NextResponse.json(
      { error: "This order isn't ready for delivery confirmation yet." },
      { status: 409 },
    );
  }
  if (!order.deliveryCode) {
    return NextResponse.json(
      { error: "No delivery code on file for this order." },
      { status: 409 },
    );
  }

  if (!deliveryCodesMatch(order.deliveryCode, parsed.data.code)) {
    return NextResponse.json({ error: "Code doesn't match." }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.COMPLETED, completedByRider: true },
  });
  // Releases the held funds + stamps completedAt on the order.
  await releaseHeldFundsForOrder(order.id);

  // Seller-side push: funds are now in their wallet. Buyer-side push is
  // skipped because they're physically holding the package — they don't
  // need a phone buzz to know it arrived.
  void sendPush({
    userId: order.sellerId,
    title: "✓ Delivery confirmed",
    body: `Order #${order.id.slice(0, 8)} · payment released to your wallet.`,
    link: `/seller/orders/${order.id}`,
    data: { type: "order-completed", orderId: order.id },
  }).catch((err) =>
    console.error("[push:order-completed] threw", { orderId: order.id, err }),
  );

  return NextResponse.json({ ok: true });
}
