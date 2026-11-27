import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { canSubmitProof } from "@/lib/directTransfer";
import { sendPush } from "@/lib/notifications";

const Body = z.object({
  proofUrl: z.string().url().max(2000),
  senderName: z.string().trim().max(120).optional(),
});

// POST /api/orders/transfer/:reference/proof — the buyer uploads their receipt
// (image URL from /api/upload) after paying the seller's bank account.
export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload a photo or screenshot of your receipt." }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { transferReference: params.reference, buyerId: guard.session.sub },
    include: { product: { select: { name: true } } },
  });
  if (orders.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canSubmitProof(orders[0].transferStatus) || orders.some((o) => o.status !== "PENDING")) {
    return NextResponse.json({ error: "This payment has already been confirmed." }, { status: 400 });
  }

  await prisma.order.updateMany({
    where: { transferReference: params.reference, buyerId: guard.session.sub },
    data: {
      transferStatus: "PROOF_SUBMITTED",
      transferProofUrl: parsed.data.proofUrl,
      transferSenderName: parsed.data.senderName || null,
      transferProofAt: new Date(),
      transferRejectReason: null,
    },
  });

  void sendPush({
    userId: orders[0].sellerId,
    title: "Payment receipt to check",
    body: `${params.reference}: a buyer says they've paid for ${orders[0].product.name}. Confirm it against your bank alert.`,
    link: `/seller/orders/${orders[0].id}`,
    data: { type: "transfer-proof", reference: params.reference, orderId: orders[0].id },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
