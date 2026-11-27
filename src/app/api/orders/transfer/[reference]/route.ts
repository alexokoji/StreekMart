import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";
import { BANKS } from "@/lib/banks";
import { transferTotal } from "@/lib/directTransfer";

// GET /api/orders/transfer/:reference
// Everything the buyer needs to pay (seller's bank details, exact amount,
// reference) and everything the seller needs to verify (receipt, sender name,
// the items this transfer covers). Visible to that buyer, that seller and
// their managers only.
export async function GET(_req: Request, { params }: { params: { reference: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const orders = await prisma.order.findMany({
    where: { transferReference: params.reference },
    include: {
      product: { select: { id: true, name: true, imagesJson: true } },
      seller: {
        select: {
          id: true,
          name: true,
          directBankCode: true,
          directAccountNumber: true,
          directAccountName: true,
        },
      },
      buyer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (orders.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const first = orders[0];
  const isBuyer = first.buyerId === guard.session.sub;
  const isSeller =
    first.sellerId === guard.session.sub ||
    (await hasManagerPermission(guard.session.sub, first.sellerId, "manage_orders"));
  if (!isBuyer && !isSeller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    reference: params.reference,
    role: isBuyer ? "buyer" : "seller",
    status: first.transferStatus,
    rejectReason: first.transferRejectReason,
    proofUrl: first.transferProofUrl,
    senderName: first.transferSenderName,
    proofAt: first.transferProofAt,
    amount: transferTotal(orders),
    buyer: first.buyer,
    seller: {
      id: first.seller.id,
      name: first.seller.name,
      bankCode: first.seller.directBankCode,
      bankName: BANKS.find((b) => b.value === first.seller.directBankCode)?.label ?? first.seller.directBankCode,
      accountNumber: first.seller.directAccountNumber,
      accountName: first.seller.directAccountName,
    },
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      quantity: o.quantity,
      totalPrice: o.totalPrice,
      deliveryFeeCents: o.deliveryFeeCents,
      product: {
        id: o.product.id,
        name: o.product.name,
        image: (() => {
          try {
            const a = JSON.parse(o.product.imagesJson || "[]");
            return Array.isArray(a) ? a[0] ?? null : null;
          } catch {
            return null;
          }
        })(),
      },
    })),
  });
}
