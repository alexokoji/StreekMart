import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";
import { finalizePaidOrders } from "@/lib/orders";
import { sendPush } from "@/lib/notifications";

const Body = z.object({
  action: z.enum(["confirm", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

// POST /api/orders/transfer/:reference/review — the seller (or a manager)
// confirms the money reached their account, or rejects the receipt.
export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const orders = await prisma.order.findMany({ where: { transferReference: params.reference } });
  if (orders.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { sellerId, buyerId } = orders[0];
  if (!(await hasManagerPermission(guard.session.sub, sellerId, "manage_orders"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (orders.some((o) => o.status !== "PENDING")) {
    return NextResponse.json({ error: "Already handled." }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    if (!parsed.data.reason) return NextResponse.json({ error: "Tell the buyer why (e.g. amount didn't arrive)." }, { status: 400 });
    await prisma.order.updateMany({
      where: { transferReference: params.reference },
      data: { transferStatus: "REJECTED", transferRejectReason: parsed.data.reason },
    });
    void sendPush({
      userId: buyerId,
      title: "Payment not confirmed",
      body: `${params.reference}: ${parsed.data.reason}`,
      link: `/pay/transfer/${params.reference}`,
      data: { type: "transfer-rejected", reference: params.reference },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  await prisma.order.updateMany({
    where: { transferReference: params.reference },
    data: { transferStatus: "CONFIRMED", transferRejectReason: null },
  });
  // Marks the orders PAID, issues delivery codes and emails the buyer.
  await finalizePaidOrders({
    paymentReference: params.reference,
    paymentTxnRef: `TRANSFER_${params.reference}`,
  });
  void sendPush({
    userId: buyerId,
    title: "Payment confirmed",
    body: `${params.reference}: the seller confirmed your payment.`,
    link: `/account/orders/${orders[0].id}`,
    data: { type: "transfer-confirmed", reference: params.reference },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
