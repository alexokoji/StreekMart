// Pays a direct-pay order straight out to the seller's bank.
//
// Called from finalizePaidOrders once the buyer's payment is confirmed. The
// order's money has landed with the platform's payment gateway; for a normal
// seller it would sit in escrow until delivery. For a direct-pay seller we
// skip escrow: credit the wallet (so there is a ledger entry), then
// immediately debit it and send the transfer to the seller's saved bank
// account. If the transfer fails the debit is reversed, leaving the money in
// the seller's wallet to withdraw by hand.

import { prisma } from "@/lib/db";
import { disburse } from "@/lib/monnify";
import { PLATFORM_FEE_BPS } from "@/lib/monnify";
import { recordTransaction } from "@/lib/wallet";
import { directPayoutBreakdown, maskAccount } from "@/lib/directPay";

export async function payOutDirectOrder(orderId: string): Promise<
  | { ok: true; status: "PAID" | "PROCESSING"; payoutId: string }
  | { ok: false; reason: string }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { name: true } },
      seller: {
        select: {
          id: true,
          directBankCode: true,
          directAccountNumber: true,
          directAccountName: true,
          directFeeBps: true,
        },
      },
    },
  });
  if (!order || !order.directPayout) return { ok: false, reason: "Not a direct-pay order" };
  const s = order.seller;
  if (!s.directBankCode || !s.directAccountNumber || !s.directAccountName) {
    return { ok: false, reason: "Seller has no bank details on file" };
  }
  // One automatic payout per order, ever (webhooks can fire twice).
  const existing = await prisma.payoutRequest.findUnique({ where: { orderId } });
  if (existing) return { ok: false, reason: "Already paid out" };

  const totalCents = Math.round(order.totalPrice * 100);
  const productCents = totalCents - order.deliveryFeeCents;
  const { feeCents, payoutCents } = directPayoutBreakdown({
    productCents,
    deliveryFeeCents: order.deliveryFeeCents,
    feeBps: s.directFeeBps,
    defaultBps: PLATFORM_FEE_BPS,
  });
  if (payoutCents <= 0) return { ok: false, reason: "Nothing to pay out" };

  // Ledger: gross in, platform cut out, payout out. Net zero, so the wallet
  // stays clean and the seller's history shows exactly what happened.
  const reqRow = await prisma.$transaction(async (tx) => {
    const row = await tx.payoutRequest.create({
      data: {
        userId: s.id,
        orderId,
        amountCents: payoutCents,
        destinationJson: JSON.stringify({
          bankCode: s.directBankCode,
          accountNumber: s.directAccountNumber,
          accountName: s.directAccountName,
        }),
        status: "PROCESSING",
      },
    });
    await recordTransaction({
      tx,
      userId: s.id,
      amountCents: totalCents,
      type: "SALE_CREDIT",
      description: `Direct sale: ${order.product.name}`,
      refType: "order",
      refId: orderId,
    });
    if (feeCents > 0) {
      await recordTransaction({
        tx,
        userId: s.id,
        amountCents: -feeCents,
        type: "PLATFORM_FEE",
        description: "Platform fee (direct sale)",
        refType: "order",
        refId: orderId,
      });
    }
    // Anything beyond fee + payout is zero by construction (total − fee −
    // payout = 0); record the payout leg so the wallet nets out.
    await recordTransaction({
      tx,
      userId: s.id,
      amountCents: -(totalCents - feeCents),
      type: "WITHDRAWAL",
      description: `Direct payout to ${s.directAccountName} · ${maskAccount(s.directAccountNumber!)}`,
      refType: "payout",
      refId: row.id,
    });
    return row;
  });

  try {
    const result = await disburse({
      amountCents: payoutCents,
      destinationAccountNumber: s.directAccountNumber,
      destinationBankCode: s.directBankCode,
      reference: reqRow.id,
      narration: `StreekMart order ${orderId.slice(-6).toUpperCase()}`,
    });
    const status = result.status === "PAID" ? "PAID" : result.status === "FAILED" ? "FAILED" : "PROCESSING";
    await prisma.payoutRequest.update({
      where: { id: reqRow.id },
      data: { status, externalRef: result.externalReference, failureReason: result.message ?? null },
    });
    if (status === "FAILED") {
      await returnToWallet(s.id, totalCents - feeCents, reqRow.id);
      return { ok: false, reason: result.message ?? "Transfer failed; money returned to the seller's wallet" };
    }
    return { ok: true, status, payoutId: reqRow.id };
  } catch (err) {
    await prisma.payoutRequest.update({
      where: { id: reqRow.id },
      data: { status: "FAILED", failureReason: err instanceof Error ? err.message.slice(0, 300) : "Transfer error" },
    });
    await returnToWallet(s.id, totalCents - feeCents, reqRow.id);
    return { ok: false, reason: "Transfer error; money returned to the seller's wallet" };
  }
}

// A failed transfer puts the money back in the seller's wallet (withdrawable,
// not held) so nothing is lost and they can withdraw it manually.
async function returnToWallet(userId: string, cents: number, payoutId: string) {
  await prisma.$transaction(async (tx) => {
    await recordTransaction({
      tx,
      userId,
      amountCents: cents,
      type: "REFUND",
      description: "Direct payout failed. Returned to your wallet",
      refType: "payout",
      refId: payoutId,
    });
  });
}
