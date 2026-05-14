import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { ensureWallet } from "@/lib/wallet";

// GET /api/wallet — return the wallet balance + last 50 transactions for
// the calling user. Read-only. Auth required.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const wallet = await ensureWallet(guard.session.sub);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Pending withdrawals are useful to surface separately so users see
  // "you've requested $X, processing".
  const pendingWithdrawalsCents = transactions
    .filter((t) => t.type === "WITHDRAWAL" && t.status === "PENDING")
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  // Available = total ledger balance minus funds held against undelivered
  // orders. The withdrawal endpoint enforces the same rule server-side.
  const heldCents = wallet.heldCents ?? 0;
  const availableCents = Math.max(0, wallet.balanceCents - heldCents);

  return NextResponse.json({
    balanceCents: wallet.balanceCents,
    availableCents,
    heldCents,
    pendingWithdrawalsCents,
    currencyCode: wallet.currencyCode,
    transactions,
  });
}
