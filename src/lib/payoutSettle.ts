// Settles a payout that was still PROCESSING when we sent it, using the final
// result Korapay reports through its webhook (transfer.success / failed).
// Idempotent: a payout already PAID or FAILED is left alone.

import { prisma } from "@/lib/db";
import { recordTransaction } from "@/lib/wallet";

export async function settlePayout(reference: string, outcome: "PAID" | "FAILED", reason?: string) {
  const row = await prisma.payoutRequest.findUnique({ where: { id: reference } });
  if (!row) return { found: false as const };
  if (row.status === "PAID" || row.status === "FAILED") return { found: true as const, changed: false };

  if (outcome === "PAID") {
    await prisma.payoutRequest.update({ where: { id: row.id }, data: { status: "PAID" } });
    return { found: true as const, changed: true };
  }

  // Failed: mark it and put the money (and any withdrawal fee) back in the
  // seller's wallet so nothing is lost.
  const feeTxn = await prisma.walletTransaction.findFirst({
    where: { refType: "payout", refId: row.id, type: "WITHDRAWAL_FEE" },
  });
  const feeCents = feeTxn ? Math.abs(feeTxn.amountCents) : 0;
  await prisma.$transaction(async (tx) => {
    await tx.payoutRequest.update({
      where: { id: row.id },
      data: { status: "FAILED", failureReason: reason?.slice(0, 300) ?? "Transfer failed" },
    });
    await recordTransaction({
      tx,
      userId: row.userId,
      amountCents: row.amountCents,
      type: "REFUND",
      description: "Refund — payout failed",
      refType: "payout",
      refId: row.id,
    });
    if (feeCents > 0) {
      await recordTransaction({
        tx,
        userId: row.userId,
        amountCents: feeCents,
        type: "REFUND",
        description: "Refund — payout fee",
        refType: "payout",
        refId: row.id,
      });
    }
  });
  return { found: true as const, changed: true };
}
